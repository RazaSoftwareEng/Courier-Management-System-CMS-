# Courier Company Management System

React + Tailwind CSS frontend, Supabase backend (Auth + Postgres + RLS).

## Setup

1. Supabase SQL Editor mein in order chalayein (har file ek dafa):
   - [supabase/schema.sql](supabase/schema.sql)
   - [supabase/migrations/002_admin_controls_status.sql](supabase/migrations/002_admin_controls_status.sql) (status sirf admin, live updates)
   - [supabase/migrations/003_riders.sql](supabase/migrations/003_riders.sql) (riders + rider assignment)
   - [supabase/migrations/004_validation.sql](supabase/migrations/004_validation.sql) (phone/CNIC/IBAN validation aur limits)
   - [supabase/migrations/005_rider_login.sql](supabase/migrations/005_rider_login.sql) (rider login + rider dashboard)
   - [supabase/migrations/006_hub_flow.sql](supabase/migrations/006_hub_flow.sql) (head office flow, out of city / international, COD received)
   - Email template: Authentication > Emails > Confirm signup mein [supabase/email-templates/confirm-signup.html](supabase/email-templates/confirm-signup.html)
   - Authentication > URL Configuration: Site URL aur Redirect URLs mein app ka URL (e.g. `http://localhost:5173/**`)
2. Project root mein `.env`:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
3. `npm install` aur `npm run dev`

## Accounts

- **Admin:** Authentication > Users > Add user, phir SQL Editor mein:
  `update public.profiles set role = 'admin', company_id = null where email = '<admin email>';`
- **Company:** Admin panel > Companies > Add Company (login password ke saath). Company sirf `Active` status par login kar sakti hai.
  Agar Supabase mein "Confirm email" ON hai to company ko pehle email confirm karni hogi.

## Structure

```
src/
  lib/supabase.js          # Supabase client (+ "Remember me" session storage)
  store/StoreContext.jsx   # login/logout, data loading, add/update/remove, RPC calls
  data/constants.js        # statuses, cities
  lib/utils.js             # money/date helpers, company balance (ledger), charts data, CSV
  components/              # DataTable, Modal, EntityForm, Charts, ParcelsPage, CustomersPage
  layouts/                 # Sidebar + topbar layout
  pages/admin/             # Dashboard, Companies, PaymentRequests, Payments, BankAccounts, Settings
  pages/company/           # Dashboard, Bank, PaymentRequests, Profile
supabase/schema.sql        # tables, triggers, RPC functions, RLS policies
```

## Balance formula

`Available = (Delivered COD - delivery charges - commission) - returned parcels ke charges - Paid - Pending/Approved requests`
(Frontend `companyLedger` aur database `company_ledger()` dono yahi hisaab karte hain.)
