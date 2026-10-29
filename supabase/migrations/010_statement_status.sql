-- Statement ka payment status: upload hote hi Pending, admin "Mark Paid" kare to Paid (payment record ke saath).
-- Dobara upload (same statement number) par status wahi rehta hai jo pehle tha.

alter table public.statements add column if not exists status text not null default 'Pending';
alter table public.statements add column if not exists payment_id uuid references public.payments (id) on delete set null;
alter table public.statements add column if not exists paid_at timestamptz;

alter table public.statements drop constraint if exists statements_status_check;
alter table public.statements add constraint statements_status_check check (status in ('Pending', 'Paid'));

-- Payment delete ho jaye to statement phir se Pending
create or replace function public.statement_payment_removed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update statements set status = 'Pending', paid_at = null where payment_id = old.id;
  return old;
end $$;

drop trigger if exists payments_statement_reset on public.payments;
create trigger payments_statement_reset after delete on public.payments for each row execute function public.statement_payment_removed();
