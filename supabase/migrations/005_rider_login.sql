-- =====================================================================
-- 005: Rider login + rider dashboard
-- Rider apne assign hue parcels dekhta hai aur khud status aage barhata hai:
-- Booked -> Picked -> In Transit -> Out for Delivery -> Delivered / Returned
-- 004 ke BAAD Supabase SQL Editor mein ek dafa chalayein.
-- =====================================================================

-- Rider ki login email
alter table public.riders add column email text;
create unique index riders_email_key on public.riders (lower(email)) where email is not null;
alter table public.riders
  add constraint riders_email_fmt check (email is null or (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 100)) not valid;

-- profiles mein 'rider' role
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'company', 'rider'));
alter table public.profiles add column rider_id uuid references public.riders (id) on delete set null;

-- Login user ka rider, sirf agar rider Active ho
create or replace function public.my_rider_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.rider_id
  from profiles p join riders r on r.id = p.rider_id
  where p.id = auth.uid() and p.role = 'rider' and r.status = 'Active';
$$;

-- Naya auth user: email rider se match ho to rider, warna company
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rider uuid;
begin
  select id into v_rider from riders where lower(email) = lower(new.email) limit 1;
  insert into profiles (id, email, full_name, role, company_id, rider_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when v_rider is not null then 'rider' else 'company' end,
    case when v_rider is null then (select id from companies where lower(email) = lower(new.email) limit 1) end,
    v_rider
  );
  return new;
end $$;

-- Rider baad mein add ho / email badle to pehle se bane user se link
create or replace function public.link_rider_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null then
    update profiles set role = 'rider', rider_id = new.id
    where lower(email) = lower(new.email) and role <> 'admin' and company_id is null;
  end if;
  return new;
end $$;

create trigger riders_link_profile
  after insert or update of email on public.riders
  for each row execute function public.link_rider_profile();

-- Rider sirf apne parcels aur unse jura data dekh sakta hai
create policy "parcels: rider read" on public.parcels for select using (rider_id = my_rider_id());
create policy "history: rider read" on public.parcel_history for select
  using (exists (select 1 from parcels p where p.id = parcel_id and p.rider_id = my_rider_id()));
create policy "customers: rider read" on public.customers for select
  using (exists (select 1 from parcels p where p.customer_id = customers.id and p.rider_id = my_rider_id()));
create policy "companies: rider read" on public.companies for select
  using (exists (select 1 from parcels p where p.company_id = companies.id and p.rider_id = my_rider_id()));
create policy "riders: own read" on public.riders for select using (id = my_rider_id());

-- Guard: admin sab kuch; rider sirf apne parcel (aur sirf rider_update_status ke zariye,
-- kyun ke rider ki parcels par koi update policy nahi); company sirf Booked parcel
create or replace function public.guard_parcel_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if my_rider_id() is not null and old.rider_id = my_rider_id() then
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

-- Rider ka status update: sirf agla step, sirf apna parcel
create or replace function public.rider_update_status(p_parcel_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rider uuid := my_rider_id();
  v_parcel parcels;
  v_allowed text[];
begin
  if v_rider is null then
    raise exception 'Sirf active rider ye kar sakta hai';
  end if;
  select * into v_parcel from parcels where id = p_parcel_id for update;
  if not found or v_parcel.rider_id is distinct from v_rider then
    raise exception 'Ye parcel aapko assign nahi hai';
  end if;

  v_allowed := case v_parcel.status
    when 'Booked' then array['Picked']
    when 'Picked' then array['In Transit']
    when 'In Transit' then array['Out for Delivery']
    when 'Out for Delivery' then array['Delivered', 'Returned']
    else array[]::text[]
  end;
  if not (p_status = any (v_allowed)) then
    raise exception 'Status % se % nahi ho sakta', v_parcel.status, p_status;
  end if;
  if p_status = 'Returned' and coalesce(trim(p_note), '') = '' then
    raise exception 'Return ki wajah likhein';
  end if;

  update parcels set status = p_status where id = p_parcel_id;
  insert into parcel_history (parcel_id, status, note, created_by)
  values (p_parcel_id, p_status, nullif(trim(p_note), ''), auth.uid());
end $$;
