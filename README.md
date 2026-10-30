# Courier Payment Portal

Sirf payment detail ka portal: admin payments manually add karta hai ya Excel statement import karta hai, company apni statements aur payouts dekhti hai.

Roles: **Admin** (Customer Profile, Payments) aur **Company** (My Statements, Account Details).

React + Tailwind CSS frontend, Supabase backend (Auth + Postgres + RLS).

## Setup

1. Supabase SQL Editor mein in order chalayein (har file ek dafa):
   - [supabase/schema.sql](supabase/schema.sql)
   - [supabase/migrations/002_admin_controls_status.sql](supabase/migrations/002_admin_controls_status.sql) (status sirf admin, live updates)
   - [supabase/migrations/003_riders.sql](supabase/migrations/003_riders.sql) (riders + rider assignment)
   - [supabase/migrations/004_validation.sql](supabase/migrations/004_validation.sql) (phone/CNIC/IBAN validation aur limits)
   - [supabase/migrations/005_rider_login.sql](supabase/migrations/005_rider_login.sql) (rider login + rider dashboard)
   - [supabase/migrations/006_hub_flow.sql](supabase/migrations/006_hub_flow.sql) (head office flow, out of city / international, COD received)
   - [supabase/migrations/007_receiver_details.sql](supabase/migrations/007_receiver_details.sql)
   - [supabase/migrations/008_statements.sql](supabase/migrations/008_statements.sql) (statements Excel upload)
   - [supabase/migrations/009_statement_weight_text.sql](supabase/migrations/009_statement_weight_text.sql)
   - [supabase/migrations/010_statement_status.sql](supabase/migrations/010_statement_status.sql) (Pending / Paid)
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
- **Company:** Admin panel > Customer Profile > Add Customer (login password ke saath). Company sirf `Active` status par login kar sakti hai.
  Agar Supabase mein "Confirm email" ON hai to company ko pehle email confirm karni hogi.

## Structure

```
src/
  lib/supabase.js          # Supabase client (+ "Remember me" session storage)
  lib/statements.js        # statements / statement_lines parhna, import, Mark Paid
  store/StoreContext.jsx   # login/logout, companies, bank_accounts, payments
  data/statementColumns.js # statement Excel ke columns (upload + download)
  components/              # DataTable, EntityForm, BulkImport, StatementImport, StatementList
  layouts/                 # Sidebar + topbar layout
  pages/admin/             # Companies (Customer Profile), Payments
  pages/company/           # CompanyStatements (My Statements), CompanyBank (Account Details)
supabase/                  # schema, migrations, email template
```

Parcels, riders, customers wagera ke database tables purani migrations se maujood hain magar app ab unhein istemal nahi karti.
