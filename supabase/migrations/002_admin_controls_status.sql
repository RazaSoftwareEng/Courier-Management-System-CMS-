-- =====================================================================
-- 002: Parcel ka status sirf admin badal sakta hai + live updates (realtime)
-- schema.sql ke BAAD Supabase SQL Editor mein ek dafa chalayein.
-- =====================================================================

-- Delivery charges hamesha rates table se (company khud charges kam nahi kar sakti)
create or replace function public.calc_delivery_charges(p_city text, p_weight numeric)
returns numeric language sql stable set search_path = public as $$
  select coalesce(r.base_charge, 200) + ceil(p_weight) * coalesce(r.per_kg, 50)
  from (select 1) x
  left join rates r on lower(r.city) = lower(p_city);
$$;

create or replace function public.before_parcel_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if not is_admin() then
    new.status := 'Booked';
    new.delivery_charges := null;
  end if;
  if new.delivery_charges is null then
    new.delivery_charges := calc_delivery_charges(new.city, new.weight);
  end if;
  return new;
end $$;

-- Company sirf 'Booked' parcel edit kar sakti hai, status / charges nahi badal sakti
create or replace function public.guard_parcel_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if old.status <> 'Booked' then
    raise exception 'Parcel ab edit nahi ho sakta (status: %)', old.status;
  end if;
  new.status := old.status;
  new.company_id := old.company_id;
  new.tracking_id := old.tracking_id;
  new.delivery_charges := calc_delivery_charges(new.city, new.weight);
  return new;
end $$;

drop trigger if exists parcels_guard on public.parcels;
create trigger parcels_guard before update on public.parcels for each row execute function public.guard_parcel_update();

-- Status update RPC sirf admin ke liye
create or replace function public.update_parcel_status(p_parcel_id uuid, p_status text, p_note text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Parcel ka status sirf admin badal sakta hai';
  end if;
  update parcels set status = p_status where id = p_parcel_id;
  if not found then
    raise exception 'Parcel nahi mila';
  end if;
  insert into parcel_history (parcel_id, status, note, created_by)
  values (p_parcel_id, p_status, nullif(p_note, ''), auth.uid());
end $$;

-- Company tracking history sirf dekh sakti hai
drop policy if exists "history: own insert" on public.parcel_history;

-- Company sirf Booked parcel delete kar sakti hai
drop policy if exists "parcels: own delete" on public.parcels;
create policy "parcels: own delete" on public.parcels for delete
  using (company_id = my_company_id() and status = 'Booked');

-- Live updates: admin status badle to company ki screen par khud update ho
alter publication supabase_realtime add table
  public.parcels, public.parcel_history, public.payment_requests, public.payments, public.bank_accounts, public.companies;
