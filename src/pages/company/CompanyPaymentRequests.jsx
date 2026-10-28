import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Landmark, Banknote, HandCoins, Wallet } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { REQUEST_STATUSES } from '../../data/constants'
import { money, date, companyLedger } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import { Modal, ConfirmDialog, PageHeader, IconButton, StatusBadge, StatCard } from '../../components/ui'

export default function CompanyPaymentRequests() {
  const store = useStore()
  const { session, payment_requests, payments, bank_accounts, add, remove, notify } = store
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [cancelling, setCancelling] = useState(null)
  const [busy, setBusy] = useState(false)

  const ledger = companyLedger(session.company_id, store)
  const bank = bank_accounts.find((b) => b.company_id === session.company_id)
  const rows = payment_requests.filter((r) => r.company_id === session.company_id)
  const refs = Object.fromEntries(payments.map((p) => [p.request_id, p.reference]))

  const columns = [
    { key: 'created_at', label: 'Date', render: (r) => date(r.created_at), csv: (r) => date(r.created_at) },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold">{money(r.amount)}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'reference', label: 'Reference', render: (r) => <span className="font-mono text-xs">{refs[r.id] || '-'}</span>, csv: (r) => refs[r.id] },
    { key: 'admin_note', label: 'Admin Note', render: (r) => <span className="text-slate-500">{r.admin_note || '-'}</span> },
    {
      key: 'actions',
      label: '',
      render: (r) => r.status === 'Pending' && <IconButton icon={Trash2} title="Cancel request" tone="rose" onClick={() => setCancelling(r)} />,
    },
  ]

  const submit = async (e) => {
    e.preventDefault()
    const value = Number(amount)
    if (value <= 0 || value > ledger.available) return notify('Amount available balance se zyada nahi ho sakta', 'error')
    setBusy(true)
    const ok = await add('payment_requests', { company_id: session.company_id, amount: value })
    setBusy(false)
    if (!ok) return
    notify('Payment request bhej di gayi')
    setOpen(false)
    setAmount('')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Requests" subtitle="Apna balance withdraw karne ke liye request bhejein">
        <button className="btn-primary" onClick={() => setOpen(true)} disabled={ledger.available <= 0}>
          <Plus size={16} /> New Request
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Available Balance" value={money(ledger.available)} icon={Wallet} />
        <StatCard label="Pending / Approved" value={money(ledger.pending)} icon={HandCoins} tone="amber" />
        <StatCard label="Total Received" value={money(ledger.paid)} icon={Banknote} tone="emerald" />
      </div>

      <DataTable columns={columns} rows={rows} exportName="my-payment-requests" filters={[{ key: 'status', label: 'Status', options: REQUEST_STATUSES }]} empty="Abhi tak koi request nahi bheji" />

      <Modal open={open} title="New Payment Request" onClose={() => setOpen(false)} size="sm">
        {!bank ? (
          <div className="py-4 text-center text-sm">
            <Landmark size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-slate-600">Request bhejne se pehle bank details add karein.</p>
            <Link to="/company/bank" className="btn-primary mt-4">
              Add Bank Details
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 text-sm">
            <div className="rounded-lg bg-indigo-50 p-3">
              <p className="text-slate-600">Available Balance</p>
              <p className="text-xl font-semibold text-indigo-700">{money(ledger.available)}</p>
            </div>
            <label className="block">
              <span className="mb-1 block font-medium">Amount *</span>
              <input className="input" type="number" min="1" max={Math.floor(ledger.available)} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setAmount(Math.floor(ledger.available))}>
              Poora balance withdraw karein
            </button>
            <p className="text-xs text-slate-500">
              Payment is account mein aayegi: {bank.bank_name} · {bank.iban}
            </p>
            <div className="form-footer flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel request?"
        message={`${money(cancelling?.amount)} ki request cancel karni hai?`}
        confirmLabel="Cancel Request"
        onClose={() => setCancelling(null)}
        onConfirm={async () => {
          if (await remove('payment_requests', cancelling.id)) notify('Request cancel ho gayi')
        }}
      />
    </div>
  )
}
