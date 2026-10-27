-- =====================================================================
-- 004: Phone, CNIC, bike number, IBAN, account number, naam/address ki
-- validation aur limits (frontend src/lib/validation.js ke rules jaisi).
-- 003 ke BAAD Supabase SQL Editor mein ek dafa chalayein.
--
-- NOT VALID: purana data check nahi hota (taa ke migration fail na ho),
-- lekin har naya insert / update in rules par check hoga.
-- =====================================================================

-- companies
alter table public.companies
  add constraint companies_name_len    check (char_length(name) between 2 and 80) not valid,
  add constraint companies_owner_len   check (char_length(owner_name) between 2 and 60) not valid,
  add constraint companies_email_fmt   check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 100) not valid,
  add constraint companies_phone_fmt   check (phone is null or phone ~ '^03\d{9}$') not valid,
  add constraint companies_city_len    check (city is null or char_length(city) <= 40) not valid,
  add constraint companies_address_len check (address is null or char_length(address) <= 200) not valid;

-- customers
alter table public.customers
  add constraint customers_name_len    check (char_length(name) between 2 and 60) not valid,
  add constraint customers_phone_fmt   check (phone ~ '^03\d{9}$') not valid,
  add constraint customers_city_len    check (char_length(city) <= 40) not valid,
  add constraint customers_address_len check (char_length(address) between 3 and 200) not valid;

-- riders
alter table public.riders
  add constraint riders_name_len    check (char_length(name) between 2 and 60) not valid,
  add constraint riders_phone_fmt   check (phone ~ '^03\d{9}$') not valid,
  add constraint riders_cnic_fmt    check (cnic is null or cnic ~ '^\d{5}-\d{7}-\d$') not valid,
  add constraint riders_vehicle_fmt check (vehicle_no is null or vehicle_no ~ '^[A-Z]{2,4}-\d{2,4}(-\d{1,4})?$') not valid,
  add constraint riders_city_len    check (city is null or char_length(city) <= 40) not valid;

-- Ek CNIC / phone par ek hi rider
create unique index if not exists riders_cnic_key on public.riders (cnic) where cnic is not null;
create unique index if not exists riders_phone_key on public.riders (phone);

-- bank_accounts
alter table public.bank_accounts
  add constraint banks_title_len   check (char_length(account_title) between 2 and 80) not valid,
  add constraint banks_account_fmt check (account_no ~ '^\d{8,20}$') not valid,
  add constraint banks_iban_fmt    check (iban ~ '^PK\d{2}[A-Z]{4}\d{16}$') not valid;

-- parcels
alter table public.parcels
  add constraint parcels_weight_max      check (weight <= 100) not valid,
  add constraint parcels_cod_max         check (cod_amount <= 1000000) not valid,
  add constraint parcels_charges_max     check (delivery_charges is null or delivery_charges <= 50000) not valid,
  add constraint parcels_description_len check (description is null or char_length(description) <= 200) not valid;

-- rates
alter table public.rates
  add constraint rates_city_len    check (char_length(city) between 2 and 40) not valid,
  add constraint rates_charges_max check (base_charge <= 50000 and per_kg <= 50000) not valid;

-- payments / requests
alter table public.payment_requests
  add constraint requests_amount_max check (amount <= 10000000) not valid,
  add constraint requests_note_len   check (admin_note is null or char_length(admin_note) <= 300) not valid;

alter table public.payments
  add constraint payments_amount_max   check (amount <= 10000000) not valid,
  add constraint payments_reference_len check (reference is null or char_length(reference) <= 50) not valid;

-- settings
alter table public.settings
  add constraint settings_name_len  check (char_length(system_name) between 2 and 80) not valid,
  add constraint settings_phone_fmt check (support_phone is null or support_phone = '' or support_phone ~ '^03\d{9}$') not valid;
