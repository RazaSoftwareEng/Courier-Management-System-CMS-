-- =====================================================================
-- 003: Riders (delivery boys). Admin rider assign karta hai, company ko
-- apne parcel ka rider (naam/phone) aur tracking history live nazar aati hai.
-- 002 ke BAAD Supabase SQL Editor mein ek dafa chalayein.
-- =====================================================================

create table public.riders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  cnic        text,
  vehicle_no  text,
  city        text,
  status      text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger riders_updated_at before update on public.riders for each row execute function public.set_updated_at();

alter table public.parcels add column rider_id uuid references public.riders (id) on delete set null;
create index parcels_rider_idx on public.parcels (rider_id);

alter table public.riders enable row level security;

create policy "riders: admin all" on public.riders for all using (is_admin()) with check (is_admin());
-- Company sirf woh riders dekh sakti hai jo uske parcels par assign hain
create policy "riders: assigned read" on public.riders for select
  using (exists (select 1 from parcels p where p.rider_id = riders.id and p.company_id = my_company_id()));

-- Company rider assign nahi kar sakti
create or replace function public.before_parcel_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if not is_admin() then
    new.status := 'Booked';
    new.delivery_charges := null;
    new.rider_id := null;
  end if;
  if new.delivery_charges is null then
    new.delivery_charges := calc_delivery_charges(new.city, new.weight);
  end if;
  return new;
end $$;

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
  new.rider_id := old.rider_id;
  new.delivery_charges := calc_delivery_charges(new.city, new.weight);
  return new;
end $$;

-- Admin: rider assign / change / hata sakta hai; tracking history mein entry banti hai
create or replace function public.assign_rider(p_parcel_id uuid, p_rider_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_parcel parcels;
  v_rider riders;
begin
  if not is_admin() then
    raise exception 'Rider sirf admin assign kar sakta hai';
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

  update parcels set rider_id = p_rider_id where id = p_parcel_id;
  insert into parcel_history (parcel_id, status, note, created_by)
  values (
    p_parcel_id,
    v_parcel.status,
    case when p_rider_id is null then 'Rider removed'
         else 'Rider assigned: ' || v_rider.name || ' (' || v_rider.phone || ')' end,
    auth.uid()
  );
end $$;

alter publication supabase_realtime add table public.riders;
