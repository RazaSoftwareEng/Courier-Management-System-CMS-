-- =====================================================================
-- 007: Receiver ki maloomat seedha parcel par (customer select karne ki zaroorat nahi)
--      Naam, phone, shehar, qareeb ki mashhoor jagah (landmark), poora address.
-- 006 ke BAAD Supabase SQL Editor mein chalayein. Dobara chalane par bhi safe hai.
-- =====================================================================

alter table public.parcels
  add column if not exists receiver_name     text,
  add column if not exists receiver_phone    text,
  add column if not exists receiver_landmark text,
  add column if not exists receiver_address  text;

-- Purane parcels: customer ki maloomat parcel par copy.
-- Guard trigger SQL Editor (admin login nahi) se update rok deta, is liye thori der hataya.
drop trigger if exists parcels_guard on public.parcels;

update public.parcels p
set receiver_name    = coalesce(p.receiver_name, c.name),
    receiver_phone   = coalesce(p.receiver_phone, c.phone),
    receiver_address = coalesce(p.receiver_address, c.address)
from public.customers c
where c.id = p.customer_id;

create trigger parcels_guard before update on public.parcels for each row execute function public.guard_parcel_update();

-- Pakistan: 03XXXXXXXXX; bahar ka number: +countrycode (8-15 digits)
alter table public.parcels drop constraint if exists parcels_receiver_name_len;
alter table public.parcels drop constraint if exists parcels_receiver_phone_fmt;
alter table public.parcels drop constraint if exists parcels_receiver_landmark_len;
alter table public.parcels drop constraint if exists parcels_receiver_address_len;
alter table public.parcels
  add constraint parcels_receiver_name_len     check (receiver_name is null or char_length(receiver_name) between 2 and 60) not valid,
  add constraint parcels_receiver_phone_fmt    check (receiver_phone is null or receiver_phone ~ '^(03\d{9}|\+\d{8,15})$') not valid,
  add constraint parcels_receiver_landmark_len check (receiver_landmark is null or char_length(receiver_landmark) <= 100) not valid,
  add constraint parcels_receiver_address_len  check (receiver_address is null or char_length(receiver_address) between 5 and 250) not valid;

-- Naye parcel par receiver ki maloomat zaroori
create or replace function public.require_receiver()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(trim(new.receiver_name), '') = '' or coalesce(trim(new.receiver_phone), '') = ''
     or coalesce(trim(new.receiver_address), '') = '' or coalesce(trim(new.city), '') = '' then
    raise exception 'Receiver ka naam, phone, shehar aur address zaroori hai';
  end if;
  return new;
end $$;

drop trigger if exists parcels_require_receiver on public.parcels;
create trigger parcels_require_receiver before insert on public.parcels for each row execute function public.require_receiver();
