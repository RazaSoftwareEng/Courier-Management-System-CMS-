-- =====================================================================
-- 006: Head office (hub) flow, out of city / international parcels,
--      alag pickup aur delivery rider, aur COD "payment received" confirmation.
--
-- Flow:
--   Booked -> Picked (pickup rider) -> At Head Office (admin confirm)
--     Local (hub city):  -> Out for Delivery (delivery rider) -> Delivered / Returned
--     Bahar ka parcel:   -> In Transit (admin dispatch) -> Arrived at Destination (admin)
--                        -> Out for Delivery (delivery rider) -> Delivered / Returned
--
-- 005 ke BAAD Supabase SQL Editor mein chalayein. Ye 002 ka zaroori hissa bhi
-- shamil karta hai (agar 002 nahi chali thi) aur dobara chalane par bhi safe hai.
-- =====================================================================

-- Guard trigger ko pehle hata dein (agar hai); purane data ki safai ke baad aakhir mein dobara banta hai
drop trigger if exists parcels_guard on public.parcels;

-- ---------- Settings: head office ka shehar + bahar ke rates ----------
alter table public.settings
  add column if not exists hub_city             text not null default 'Lahore',
  add column if not exists domestic_base_charge numeric(10, 2) not null default 250  check (domestic_base_charge between 0 and 50000),
  add column if not exists domestic_per_kg      numeric(10, 2) not null default 100  check (domestic_per_kg between 0 and 50000),
  add column if not exists intl_base_charge     numeric(10, 2) not null default 3000 check (intl_base_charge between 0 and 50000),
  add column if not exists intl_per_kg          numeric(10, 2) not null default 1500 check (intl_per_kg between 0 and 50000);

-- ---------- Customer ka mulk ----------
alter table public.customers add column if not exists country text not null default 'Pakistan';
alter table public.customers drop constraint if exists customers_country_len;
alter table public.customers add constraint customers_country_len check (char_length(country) between 2 and 60) not valid;

-- ---------- Parcel: destination, delivery type, pickup rider, COD wasooli ----------
alter table public.parcels
  add column if not exists destination_country text not null default 'Pakistan',
  add column if not exists delivery_type       text not null default 'Local' check (delivery_type in ('Local', 'Domestic', 'International')),
  add column if not exists pickup_rider_id     uuid references public.riders (id) on delete set null,
  add column if not exists cod_received_at     timestamptz,
  add column if not exists cod_received_by     uuid references auth.users (id) on delete set null;
create index if not exists parcels_pickup_rider_idx on public.parcels (pickup_rider_id);

alter table public.parcels drop constraint if exists parcels_status_check;
alter table public.parcels add constraint parcels_status_check check (status in (
  'Booked', 'Picked', 'At Head Office', 'In Transit', 'Arrived at Destination',
  'Out for Delivery', 'Delivered', 'Returned', 'Cancelled'
));

-- Local = hub city, Domestic = Pakistan ka koi aur shehar, International = bahar ka mulk
create or replace function public.parcel_delivery_type(p_city text, p_country text)
returns text language sql stable set search_path = public as $$
  select case
    when lower(coalesce(nullif(trim(p_country), ''), 'Pakistan')) <> 'pakistan' then 'International'
    when lower(trim(p_city)) = lower((select hub_city from settings where id = 1)) then 'Local'
    else 'Domestic'
  end;
$$;

-- Charges: international rate / rates table ka shehar / warna domestic rate
drop function if exists public.calc_delivery_charges(text, numeric);
create or replace function public.calc_delivery_charges(p_city text, p_weight numeric, p_country text)
returns numeric language sql stable set search_path = public as $$
  select case
    when lower(coalesce(nullif(trim(p_country), ''), 'Pakistan')) <> 'pakistan'
      then s.intl_base_charge + ceil(p_weight) * s.intl_per_kg
    when r.id is not null
      then r.base_charge + ceil(p_weight) * r.per_kg
    else s.domestic_base_charge + ceil(p_weight) * s.domestic_per_kg
  end
  from settings s
  left join rates r on lower(r.city) = lower(trim(p_city))
  where s.id = 1;
$$;

create or replace function public.before_parcel_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if not is_admin() then
    new.status := 'Booked';
    new.delivery_charges := null;
    new.rider_id := null;
    new.pickup_rider_id := null;
    new.cod_received_at := null;
    new.cod_received_by := null;
  end if;
  new.destination_country := coalesce(nullif(trim(new.destination_country), ''), 'Pakistan');
  new.delivery_type := parcel_delivery_type(new.city, new.destination_country);
  if new.delivery_charges is null then
    new.delivery_charges := calc_delivery_charges(new.city, new.weight, new.destination_country);
  end if;
  return new;
end $$;

create or replace function public.guard_parcel_update()
returns trigger language plpgsql set search_path = public as $$
begin
  -- COD wasooli ka record: Delivered hote waqt, aur Delivered se hatne par saaf
  if new.status = 'Delivered' and old.status <> 'Delivered' and new.cod_received_at is null then
    new.cod_received_at := now();
    new.cod_received_by := auth.uid();
  elsif new.status <> 'Delivered' then
    new.cod_received_at := null;
    new.cod_received_by := null;
  end if;
  new.destination_country := coalesce(nullif(trim(new.destination_country), ''), 'Pakistan');
  new.delivery_type := parcel_delivery_type(new.city, new.destination_country);

  if is_admin() then
    return new;
  end if;
  -- Rider sirf rider_update_status() ke zariye yahan pohanchta hai
  if my_rider_id() is not null and my_rider_id() in (old.rider_id, old.pickup_rider_id) then
    return new;
  end if;
  if old.status <> 'Booked' then
    raise exception 'Parcel ab edit nahi ho sakta (status: %)', old.status;
  end if;
  new.status := old.status;
  new.company_id := old.company_id;
  new.tracking_id := old.tracking_id;
  new.rider_id := old.rider_id;
  new.pickup_rider_id := old.pickup_rider_id;
  new.cod_received_at := old.cod_received_at;
  new.cod_received_by := old.cod_received_by;
  new.delivery_charges := calc_delivery_charges(new.city, new.weight, new.destination_country);
  return new;
end $$;

-- Purane parcels: jo rider pehle tha wahi pickup rider; delivery type set karna.
-- (Guard trigger upar hata diya gaya hai, warna SQL Editor se ye update ruk jata)
update public.parcels
set pickup_rider_id = coalesce(pickup_rider_id, rider_id),
    delivery_type = parcel_delivery_type(city, destination_country);

create trigger parcels_guard before update on public.parcels for each row execute function public.guard_parcel_update();

-- ---------- Rider assign: pickup ya delivery ----------
drop function if exists public.assign_rider(uuid, uuid);
create or replace function public.assign_rider(p_parcel_id uuid, p_rider_id uuid, p_kind text default 'delivery')
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_parcel parcels;
  v_rider riders;
begin
  if not is_admin() then
    raise exception 'Rider sirf admin assign kar sakta hai';
  end if;
  if p_kind not in ('pickup', 'delivery') then
    raise exception 'Rider type pickup ya delivery hona chahiye';
  end if;
  select * into v_parcel from parcels where id = p_parcel_id for update;
  if not found then
    raise exception 'Parcel nahi mila';
  end if;
  if p_rider_id is not null then
    select * into v_rider from riders where id = p_rider_id;
    if not found or v_rider.status <> 'Active' then
      raise exception 'Rider active nahi hai';
    end if;
  end if;

  if p_kind = 'pickup' then
    update parcels set pickup_rider_id = p_rider_id where id = p_parcel_id;
  else
    update parcels set rider_id = p_rider_id where id = p_parcel_id;
  end if;

  insert into parcel_history (parcel_id, status, note, created_by)
  values (
    p_parcel_id,
    v_parcel.status,
    case when p_rider_id is null then initcap(p_kind) || ' rider removed'
         else initcap(p_kind) || ' rider assigned: ' || v_rider.name || ' (' || v_rider.phone || ')' end,
    auth.uid()
  );
end $$;

-- ---------- Rider ka status update ----------
-- Pickup rider:   Booked -> Picked
-- Delivery rider: At Head Office (sirf Local) / Arrived at Destination -> Out for Delivery
--                 Out for Delivery -> Delivered (COD confirm zaroori) / Returned (wajah zaroori)
drop function if exists public.rider_update_status(uuid, text, text);
create or replace function public.rider_update_status(
  p_parcel_id uuid, p_status text, p_note text default null, p_cod_received boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rider uuid := my_rider_id();
  v_parcel parcels;
  v_ok boolean := false;
  v_note text := nullif(trim(p_note), '');
begin
  if v_rider is null then
    raise exception 'Sirf active rider ye kar sakta hai';
  end if;
  select * into v_parcel from parcels where id = p_parcel_id for update;
  -- "is distinct from" taa ke null rider par check chupke se pass na ho
  if not found or (v_rider is distinct from v_parcel.rider_id and v_rider is distinct from v_parcel.pickup_rider_id) then
    raise exception 'Ye parcel aapko assign nahi hai';
  end if;

  if v_parcel.pickup_rider_id = v_rider and v_parcel.status = 'Booked' and p_status = 'Picked' then
    v_ok := true;
  end if;
  if v_parcel.rider_id = v_rider then
    if p_status = 'Out for Delivery'
       and (v_parcel.status = 'Arrived at Destination' or (v_parcel.status = 'At Head Office' and v_parcel.delivery_type = 'Local')) then
      v_ok := true;
    end if;
    if v_parcel.status = 'Out for Delivery' and p_status in ('Delivered', 'Returned') then
      v_ok := true;
    end if;
  end if;
  if not v_ok then
    raise exception 'Status % se % nahi ho sakta', v_parcel.status, p_status;
  end if;

  if p_status = 'Returned' and v_note is null then
    raise exception 'Return ki wajah likhein';
  end if;
  if p_status = 'Delivered' and v_parcel.cod_amount > 0 then
    if not coalesce(p_cod_received, false) then
      raise exception 'Pehle confirm karein ke customer se payment mil gayi';
    end if;
    v_note := concat_ws(' · ', 'COD Rs ' || v_parcel.cod_amount || ' received', v_note);
  end if;

  update parcels set status = p_status where id = p_parcel_id;
  insert into parcel_history (parcel_id, status, note, created_by)
  values (p_parcel_id, p_status, v_note, auth.uid());
end $$;

-- ---------- Policies: rider pickup aur delivery dono parcels dekhe ----------
drop policy if exists "parcels: rider read" on public.parcels;
create policy "parcels: rider read" on public.parcels for select
  using (my_rider_id() = any (array[rider_id, pickup_rider_id]));

drop policy if exists "history: rider read" on public.parcel_history;
create policy "history: rider read" on public.parcel_history for select
  using (exists (select 1 from parcels p where p.id = parcel_id and my_rider_id() = any (array[p.rider_id, p.pickup_rider_id])));

drop policy if exists "customers: rider read" on public.customers;
create policy "customers: rider read" on public.customers for select
  using (exists (select 1 from parcels p where p.customer_id = customers.id and my_rider_id() = any (array[p.rider_id, p.pickup_rider_id])));

drop policy if exists "companies: rider read" on public.companies;
create policy "companies: rider read" on public.companies for select
  using (exists (select 1 from parcels p where p.company_id = companies.id and my_rider_id() = any (array[p.rider_id, p.pickup_rider_id])));

drop policy if exists "riders: assigned read" on public.riders;
create policy "riders: assigned read" on public.riders for select
  using (exists (select 1 from parcels p where riders.id = any (array[p.rider_id, p.pickup_rider_id]) and p.company_id = my_company_id()));

-- ---------- 002 ka baqi hissa (agar 002 nahi chali thi) ----------

-- Admin ka status update RPC: sirf admin
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

-- Live updates: jo tables realtime mein nahi hain unhein add karna
do $$
declare
  t text;
begin
  foreach t in array array['parcels', 'parcel_history', 'payment_requests', 'payments', 'bank_accounts', 'companies', 'riders'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
