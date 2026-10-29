-- Dead Weight / Billing Weight ab text hain: "pkg length x height x width (cm)_weight (kg)", jaise 30x20x10_1.5
-- (008 pehle chal chuki ho to ye columns number the; ye migration dobara chalana bhi safe hai)

alter table public.statement_lines alter column dead_weight drop default;
alter table public.statement_lines alter column dead_weight drop not null;
alter table public.statement_lines alter column dead_weight type text using dead_weight::text;
alter table public.statement_lines alter column billing_weight drop default;
alter table public.statement_lines alter column billing_weight drop not null;
alter table public.statement_lines alter column billing_weight type text using billing_weight::text;

-- Ek statement ek transaction mein: pehle se ho to us ki purani lines hata kar nayi lagti hain
create or replace function public.import_statement(
  p_company_id uuid,
  p_number     text,
  p_start      date,
  p_end        date,
  p_lines      jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'Sirf admin statement upload kar sakta hai';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'Statement mein koi row nahi';
  end if;

  insert into statements (company_id, statement_number, period_start, period_end, uploaded_by)
  values (p_company_id, trim(p_number), p_start, p_end, auth.uid())
  on conflict (company_id, statement_number) do update
    set period_start = excluded.period_start, period_end = excluded.period_end, uploaded_by = excluded.uploaded_by
  returning id into v_id;

  delete from statement_lines where statement_id = v_id;

  insert into statement_lines (
    statement_id, company_id, tracking_no, original_tracking_no, warehouse_name, order_type, order_no, external_order_no,
    order_created_at, final_status_at, buyer_name, buyer_phone, buyer_province, dead_weight, billing_weight, payment_method,
    final_status, cod_amount, cod_surcharge_fee, paid_shipping_fee, shipping_fee, shipping_fee_vat, return_shipping_fee,
    failed_delivery_fee, income_tax, sales_tax, fuel_surcharge, payable_amount, note
  )
  select
    v_id, p_company_id, x.tracking_no, x.original_tracking_no, x.warehouse_name, x.order_type, x.order_no, x.external_order_no,
    x.order_created_at, x.final_status_at, x.buyer_name, x.buyer_phone, x.buyer_province,
    x.dead_weight, x.billing_weight, x.payment_method, x.final_status, coalesce(x.cod_amount, 0),
    coalesce(x.cod_surcharge_fee, 0), coalesce(x.paid_shipping_fee, 0), coalesce(x.shipping_fee, 0), coalesce(x.shipping_fee_vat, 0),
    coalesce(x.return_shipping_fee, 0), coalesce(x.failed_delivery_fee, 0), coalesce(x.income_tax, 0), coalesce(x.sales_tax, 0),
    coalesce(x.fuel_surcharge, 0), coalesce(x.payable_amount, 0), x.note
  from jsonb_to_recordset(p_lines) as x(
    tracking_no text, original_tracking_no text, warehouse_name text, order_type text, order_no text, external_order_no text,
    order_created_at text, final_status_at text, buyer_name text, buyer_phone text, buyer_province text,
    dead_weight text, billing_weight text, payment_method text, final_status text, cod_amount numeric,
    cod_surcharge_fee numeric, paid_shipping_fee numeric, shipping_fee numeric, shipping_fee_vat numeric,
    return_shipping_fee numeric, failed_delivery_fee numeric, income_tax numeric, sales_tax numeric,
    fuel_surcharge numeric, payable_amount numeric, note text
  );

  update statements s set
    line_count    = t.n,
    cod_total     = t.cod,
    fees_total    = t.fees,
    payable_total = t.payable
  from (
    select count(*) as n,
           coalesce(sum(cod_amount), 0) as cod,
           coalesce(sum(cod_surcharge_fee + paid_shipping_fee + shipping_fee + shipping_fee_vat + return_shipping_fee
                        + failed_delivery_fee + income_tax + sales_tax + fuel_surcharge), 0) as fees,
           coalesce(sum(payable_amount), 0) as payable
    from statement_lines where statement_id = v_id
  ) t
  where s.id = v_id;

  return v_id;
end $$;

grant execute on function public.import_statement(uuid, text, date, date, jsonb) to authenticated;

