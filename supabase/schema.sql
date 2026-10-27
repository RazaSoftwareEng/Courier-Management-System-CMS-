-- =====================================================================
-- Courier Company Management System - Supabase schema
-- Supabase Dashboard > SQL Editor > New query: ye poora file paste karke "Run" karein.
-- Naye (khaali) project par sirf EK dafa chalayein.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_name  text not null,
  email       text not null,                 -- isi email se company login karegi
  phone       text,
  city        text,
  address     text,
  status      text not null default 'Pending' check (status in ('Active', 'Pending', 'Suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index companies_email_key on public.companies (lower(email));

-- Har login user (auth.users) ka ek profile: role admin ya company
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'company' check (role in ('admin', 'company')),
  company_id  uuid references public.companies (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  phone       text not null,
  city        text not null,
  address     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index customers_company_idx on public.customers (company_id);

create table public.rates (
  id          uuid primary key default gen_random_uuid(),
  city        text not null unique,
  base_charge numeric(10, 2) not null default 200 check (base_charge >= 0),
  per_kg      numeric(10, 2) not null default 50 check (per_kg >= 0),
  created_at  timestamptz not null default now()
);

create sequence public.tracking_seq start 100001;

create table public.parcels (
  id               uuid primary key default gen_random_uuid(),
  tracking_id      text not null unique default ('CCM' || nextval('public.tracking_seq')),
  company_id       uuid not null references public.companies (id) on delete cascade,
  customer_id      uuid references public.customers (id) on delete set null,
  city             text not null,
  weight           numeric(6, 2) not null default 1 check (weight > 0),
  cod_amount       numeric(12, 2) not null default 0 check (cod_amount >= 0),
  delivery_charges numeric(12, 2) check (delivery_charges >= 0),   -- null ho to rates se auto
  description      text,
  status           text not null default 'Booked'
                   check (status in ('Booked', 'Picked', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index parcels_company_idx on public.parcels (company_id);
create index parcels_status_idx on public.parcels (status);
create index parcels_created_idx on public.parcels (created_at desc);

create table public.parcel_history (
  id          uuid primary key default gen_random_uuid(),
  parcel_id   uuid not null references public.parcels (id) on delete cascade,
  status      text not null,
  note        text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index parcel_history_parcel_idx on public.parcel_history (parcel_id, created_at);

-- Har company ka ek bank account
create table public.bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null unique references public.companies (id) on delete cascade,
  bank_name      text not null,
  account_title  text not null,
  account_no     text not null,
  iban           text not null,
  verified       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.payment_requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  status      text not null default 'Pending' check (status in ('Pending', 'Approved', 'Paid', 'Rejected')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index payment_requests_company_idx on public.payment_requests (company_id);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  request_id  uuid references public.payment_requests (id) on delete set null,
  amount      numeric(12, 2) not null check (amount > 0),
  method      text not null default 'Bank Transfer',
  reference   text,
  created_at  timestamptz not null default now()
);
create index payments_company_idx on public.payments (company_id);

-- Sirf ek row (id = 1)
create table public.settings (
  id                 int primary key default 1 check (id = 1),
  system_name        text not null default 'CourierPro',
  support_phone      text,
  commission_percent numeric(5, 2) not null default 0 check (commission_percent between 0 and 100),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS (RLS policies inko use karti hain)
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Login user ki company, sirf agar company Active ho.
-- Suspended / Pending company ko is wajah se koi data nazar nahi aayega.
create or replace function public.my_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.company_id
  from profiles p join companies c on c.id = p.company_id
  where p.id = auth.uid() and c.status = 'Active';
$$;

-- Company ka hisaab (frontend ke companyLedger jaisa)
create or replace function public.company_ledger(p_company_id uuid)
returns table (total_cod numeric, charges numeric, commission numeric, earned numeric, paid numeric, pending numeric, available numeric)
language sql stable security invoker set search_path = public as $$
  with s as (
    select coalesce((select commission_percent from settings where id = 1), 0) / 100 as rate
  ),
  p as (
    select coalesce(sum(cod_amount) filter (where status = 'Delivered'), 0) as cod,
           coalesce(sum(delivery_charges) filter (where status in ('Delivered', 'Returned')), 0) as charges
    from parcels where company_id = p_company_id
  ),
  r as (
    select coalesce(sum(amount) filter (where status = 'Paid'), 0) as paid,
           coalesce(sum(amount) filter (where status in ('Pending', 'Approved')), 0) as pending
    from payment_requests where company_id = p_company_id
  ),
  x as (select p.cod, p.charges, round(p.cod * s.rate, 2) as comm, r.paid, r.pending from p, r, s)
  select cod, charges, comm, cod - charges - comm, paid, pending, cod - charges - comm - paid - pending from x;
$$;

-- ---------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger parcels_updated_at before update on public.parcels for each row execute function public.set_updated_at();
create trigger bank_accounts_updated_at before update on public.bank_accounts for each row execute function public.set_updated_at();
create trigger payment_requests_updated_at before update on public.payment_requests for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.settings for each row execute function public.set_updated_at();

-- Naya auth user bane to profile khud ban jaye; email kisi company se match ho to link ho jaye
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role, company_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'company',
    (select id from companies where lower(email) = lower(new.email) limit 1)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin company baad mein add kare to pehle se bane user se link ho jaye
create or replace function public.link_company_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set company_id = new.id
  where lower(email) = lower(new.email) and role = 'company';
  return new;
end $$;

create trigger companies_link_profile
  after insert or update of email on public.companies
  for each row execute function public.link_company_profile();

-- Company apna status / email khud nahi badal sakti
create or replace function public.guard_company_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if not is_admin() then
    new.status := old.status;
    new.email := old.email;
  end if;
  return new;
end $$;

create trigger companies_guard before update on public.companies for each row execute function public.guard_company_update();

-- Parcel: delivery charges auto (rates se), company sirf 'Booked' status se parcel bana sakti hai
create or replace function public.before_parcel_insert()
returns trigger language plpgsql set search_path = public as $$
declare
  r rates;
begin
  if not is_admin() then
    new.status := 'Booked';
  end if;
  if new.delivery_charges is null then
    select * into r from rates where lower(city) = lower(new.city);
    new.delivery_charges := coalesce(r.base_charge, 200) + ceil(new.weight) * coalesce(r.per_kg, 50);
  end if;
  return new;
end $$;

create trigger parcels_before_insert before insert on public.parcels for each row execute function public.before_parcel_insert();

create or replace function public.after_parcel_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into parcel_history (parcel_id, status, note, created_by)
  values (new.id, new.status, 'Parcel booked', auth.uid());
  return new;
end $$;

create trigger parcels_after_insert after insert on public.parcels for each row execute function public.after_parcel_insert();

-- Bank details company badle to dobara admin verify karega
create or replace function public.guard_bank_account()
returns trigger language plpgsql set search_path = public as $$
begin
  if not is_admin() then
    new.verified := false;
  end if;
  return new;
end $$;

create trigger bank_accounts_guard before insert or update on public.bank_accounts for each row execute function public.guard_bank_account();

-- Payment request: company sirf Pending request bhej sakti hai, balance se zyada nahi
create or replace function public.before_payment_request_insert()
returns trigger language plpgsql set search_path = public as $$
declare
  v_available numeric;
begin
  if is_admin() then
    return new;
  end if;
  new.status := 'Pending';
  new.admin_note := null;
  if not exists (select 1 from bank_accounts where company_id = new.company_id) then
    raise exception 'Pehle bank details add karein';
  end if;
  select available into v_available from company_ledger(new.company_id);
  if new.amount > v_available then
    raise exception 'Amount available balance (%) se zyada hai', v_available;
  end if;
  return new;
end $$;

create trigger payment_requests_before_insert before insert on public.payment_requests for each row execute function public.before_payment_request_insert();

-- ---------------------------------------------------------------------
-- 4. RPC FUNCTIONS (frontend se supabase.rpc(...) se call hongi)
-- ---------------------------------------------------------------------

-- Status update + history ek saath
create or replace function public.update_parcel_status(p_parcel_id uuid, p_status text, p_note text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update parcels set status = p_status where id = p_parcel_id;
  if not found then
    raise exception 'Parcel nahi mila ya access nahi hai';
  end if;
  insert into parcel_history (parcel_id, status, note, created_by)
  values (p_parcel_id, p_status, nullif(p_note, ''), auth.uid());
end $$;

-- Admin: request ko Paid mark kare aur payments mein record bane
create or replace function public.mark_request_paid(p_request_id uuid, p_reference text, p_note text default null, p_method text default 'Bank Transfer')
returns void language plpgsql security invoker set search_path = public as $$
declare
  r payment_requests;
begin
  if not is_admin() then
    raise exception 'Sirf admin payment mark kar sakta hai';
  end if;
  select * into r from payment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request nahi mili';
  end if;
  if r.status not in ('Pending', 'Approved') then
    raise exception 'Request pehle se % hai', r.status;
  end if;
  update payment_requests set status = 'Paid', admin_note = coalesce(nullif(p_note, ''), admin_note) where id = p_request_id;
  insert into payments (company_id, request_id, amount, method, reference)
  values (r.company_id, r.id, r.amount, p_method, p_reference);
end $$;

-- Admin "Payments" page ke liye sab companies ka balance
create view public.company_balances with (security_invoker = true) as
  select c.id as company_id, c.name, c.status, l.*
  from public.companies c
  cross join lateral public.company_ledger(c.id) l;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
--    Admin: sab kuch. Company: sirf apna data.
-- ---------------------------------------------------------------------

alter table public.companies        enable row level security;
alter table public.profiles         enable row level security;
alter table public.customers        enable row level security;
alter table public.rates            enable row level security;
alter table public.parcels          enable row level security;
alter table public.parcel_history   enable row level security;
alter table public.bank_accounts    enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payments         enable row level security;
alter table public.settings         enable row level security;

-- profiles
create policy "profiles: own read" on public.profiles for select using (id = auth.uid() or is_admin());
create policy "profiles: admin write" on public.profiles for all using (is_admin()) with check (is_admin());

-- companies
create policy "companies: admin all" on public.companies for all using (is_admin()) with check (is_admin());
create policy "companies: own read" on public.companies for select using (id = my_company_id());
create policy "companies: own update" on public.companies for update using (id = my_company_id()) with check (id = my_company_id());

-- customers
create policy "customers: admin all" on public.customers for all using (is_admin()) with check (is_admin());
create policy "customers: own all" on public.customers for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- rates (sab login users parh sakte hain, likh sirf admin)
create policy "rates: read" on public.rates for select to authenticated using (true);
create policy "rates: admin write" on public.rates for all using (is_admin()) with check (is_admin());

-- parcels
create policy "parcels: admin all" on public.parcels for all using (is_admin()) with check (is_admin());
create policy "parcels: own read" on public.parcels for select using (company_id = my_company_id());
create policy "parcels: own insert" on public.parcels for insert with check (company_id = my_company_id());
create policy "parcels: own update" on public.parcels for update using (company_id = my_company_id()) with check (company_id = my_company_id());
-- Company sirf Booked / Cancelled parcel delete kar sakti hai
create policy "parcels: own delete" on public.parcels for delete using (company_id = my_company_id() and status in ('Booked', 'Cancelled'));

-- parcel_history
create policy "history: admin all" on public.parcel_history for all using (is_admin()) with check (is_admin());
create policy "history: own read" on public.parcel_history for select
  using (exists (select 1 from parcels p where p.id = parcel_id and p.company_id = my_company_id()));
create policy "history: own insert" on public.parcel_history for insert
  with check (exists (select 1 from parcels p where p.id = parcel_id and p.company_id = my_company_id()));

-- bank_accounts
create policy "banks: admin all" on public.bank_accounts for all using (is_admin()) with check (is_admin());
create policy "banks: own all" on public.bank_accounts for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- payment_requests (company: dekh, bhej, aur sirf Pending cancel kar sakti hai)
create policy "requests: admin all" on public.payment_requests for all using (is_admin()) with check (is_admin());
create policy "requests: own read" on public.payment_requests for select using (company_id = my_company_id());
create policy "requests: own insert" on public.payment_requests for insert with check (company_id = my_company_id());
create policy "requests: own cancel" on public.payment_requests for delete using (company_id = my_company_id() and status = 'Pending');

-- payments (company sirf dekh sakti hai)
create policy "payments: admin all" on public.payments for all using (is_admin()) with check (is_admin());
create policy "payments: own read" on public.payments for select using (company_id = my_company_id());

-- settings
create policy "settings: read" on public.settings for select to authenticated using (true);
create policy "settings: admin update" on public.settings for update using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- 6. DEFAULT DATA
-- ---------------------------------------------------------------------

insert into public.settings (id, system_name, support_phone, commission_percent)
values (1, 'CourierPro', '0300-1234567', 0);

insert into public.rates (city, base_charge, per_kg) values
  ('Lahore', 150, 50),
  ('Karachi', 200, 50),
  ('Islamabad', 200, 50),
  ('Rawalpindi', 200, 50),
  ('Faisalabad', 200, 50),
  ('Multan', 200, 50),
  ('Peshawar', 200, 50),
  ('Sialkot', 200, 50);

-- =====================================================================
-- ADMIN ACCOUNT BANANE KA TAREEQA
-- 1) Dashboard > Authentication > Users > "Add user" > "Create new user"
--    Email: admin@courierpro.com, Password: (apna strong password), "Auto Confirm User" ON
-- 2) Phir SQL Editor mein ye chalayein:
--
--    update public.profiles set role = 'admin', company_id = null
--    where email = 'admin@courierpro.com';
--
-- COMPANY ACCOUNT:
-- 1) Admin panel se company add karein (email ke saath) aur status 'Active' rakhein
-- 2) Authentication > Users > Add user mein ussi email se user banayein.
--    Profile khud ban kar company se link ho jayega.
-- =====================================================================
