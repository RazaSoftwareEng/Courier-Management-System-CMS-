-- Statements: admin har company ke liye Excel se statement detail upload karta hai,
-- company My Statements mein dekhti aur download karti hai.

create table if not exists public.statements (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  statement_number text not null check (char_length(statement_number) between 1 and 60),
  period_start     date not null,
  period_end       date not null check (period_end >= period_start),
  line_count       integer not null default 0,
  cod_total        numeric(14, 2) not null default 0,
  fees_total       numeric(14, 2) not null default 0,
  payable_total    numeric(14, 2) not null default 0,
  uploaded_by      uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, statement_number)
);
create index if not exists statements_company_idx on public.statements (company_id, period_end desc);

create table if not exists public.statement_lines (
  id                   uuid primary key default gen_random_uuid(),
  statement_id         uuid not null references public.statements (id) on delete cascade,
  company_id           uuid not null references public.companies (id) on delete cascade,
  tracking_no          text not null,
  original_tracking_no text,
  warehouse_name       text,
  order_type           text,
  order_no             text,
  external_order_no    text,
  order_created_at     text,
  final_status_at      text,
  buyer_name           text,
  buyer_phone          text,
  buyer_province       text,
  dead_weight          text,   -- pkg length x height x width (cm)_weight (kg), jaise 30x20x10_1.5
  billing_weight       text,
  payment_method       text,
  final_status         text,
  cod_amount           numeric(14, 2) not null default 0,
  cod_surcharge_fee    numeric(14, 2) not null default 0,
  paid_shipping_fee    numeric(14, 2) not null default 0,
  shipping_fee         numeric(14, 2) not null default 0,
  shipping_fee_vat     numeric(14, 2) not null default 0,
  return_shipping_fee  numeric(14, 2) not null default 0,
  failed_delivery_fee  numeric(14, 2) not null default 0,
  income_tax           numeric(14, 2) not null default 0,
  sales_tax            numeric(14, 2) not null default 0,
  fuel_surcharge       numeric(14, 2) not null default 0,
  payable_amount       numeric(14, 2) not null default 0,
  note                 text
);
create index if not exists statement_lines_statement_idx on public.statement_lines (statement_id);

drop trigger if exists statements_updated_at on public.statements;
create trigger statements_updated_at before update on public.statements for each row execute function public.set_updated_at();

alter table public.statements      enable row level security;
alter table public.statement_lines enable row level security;

drop policy if exists "statements: admin all" on public.statements;
drop policy if exists "statements: own read" on public.statements;
create policy "statements: admin all" on public.statements for all using (is_admin()) with check (is_admin());
create policy "statements: own read" on public.statements for select using (company_id = my_company_id());

drop policy if exists "statement_lines: admin all" on public.statement_lines;
drop policy if exists "statement_lines: own read" on public.statement_lines;
create policy "statement_lines: admin all" on public.statement_lines for all using (is_admin()) with check (is_admin());
create policy "statement_lines: own read" on public.statement_lines for select using (company_id = my_company_id());

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

-- Live updates
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'statements') then
    alter publication supabase_realtime add table public.statements;
  end if;
end $$;
