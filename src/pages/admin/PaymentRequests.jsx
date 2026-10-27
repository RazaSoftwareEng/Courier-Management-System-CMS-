import { useMemo, useState } from 'react'
import { Check, X, Banknote, Trash2, Pencil, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { REQUEST_STATUSES } from '../../data/constants'
import { money, date, byId, sum, companyLedger } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import { Modal, ConfirmDialog, PageHeader, IconButton, StatusBadge, StatCard } from '../../components/ui'

export default function PaymentRequests() {
  const store = useStore()
  const { payment_requests, companies, bank_accounts, update, remove, markRequestPaid, notify } = store
  const [action, setAction] = useState(null) // { req, type: approve|reject|pay|edit }
  const [deleting, setDeleting] = useState(null)

  const companyMap = useMemo(() => byId(companies), [companies])

  const columns = [
    { key: 'company', label: 'Company', render: (r) => <span className="font-medium">{companyMap[r.company_id]?.name || '-'}</span>, csv: (r) => companyMap[r.company_id]?.name },
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-semibold">{money(r.amount)}</span> },
    { key: 'balance', label: 'Company Balance', align: 'right', render: (r) => money(companyLedger(r.company_id, store).available), csv: (r) => companyLedger(r.company_id, store).available },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'admin_note', label: 'Note', render: (r) => <span className="block max-w-48 truncate text-slate-500">{r.admin_note || '-'}</span> },
    { key: 'created_at', label: 'Requested', render: (r) => date(r.created_at), csv: (r) => date(r.created_at) },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex justify-end gap-0.5">
          {r.status === 'Pending' && <IconButton icon={Check} title="Approve" tone="emerald" onClick={() => setAction({ req: r, type: 'approve' })} />}
          {(r.status === 'Pending' || r.status === 'Approved') && (
            <>
              <IconButton icon={Banknote} title="Mark as Paid" tone="emerald" onClick={() => setAction({ req: r, type: 'pay' })} />
              <IconButton icon={X} title="Reject" tone="rose" onClick={() => setAction({ req: r, type: 'reject' })} />
            </>
          )}
          <IconButton icon={Pencil} title="Edit" onClick={() => setAction({ req: r, type: 'edit' })} />
          <IconButton icon={Trash2} title="Delete" tone="rose" onClick={() => setDeleting(r)} />
        </div>
      ),
    },
  ]

  const totals = {
    pending: payment_requests.filter((r) => r.status === 'Pending'),
    approved: payment_requests.filter((r) => r.status === 'Approved'),
    paid: payment_requests.filter((r) => r.status === 'Paid'),
    rejected: payment_requests.filter((r) => r.status === 'Rejected'),
  }

  const titles = { approve: 'Approve Request', reject: 'Reject Request', pay: 'Mark as Paid', edit: 'Edit Request' }

  const submit = async ({ note, reference, amount, status }) => {
    const { req, type } = action
    let ok
    if (type === 'approve') ok = await update('payment_requests', req.id, { status: 'Approved', admin_note: note })
    if (type === 'reject') ok = await update('payment_requests', req.id, { status: 'Rejected', admin_note: note })
    if (type === 'pay') ok = await markRequestPaid(req.id, reference, note)
    if (type === 'edit') ok = await update('payment_requests', req.id, { amount: Number(amount), status, admin_note: note })
    if (!ok) return
    notify('Request update ho gayi')
    setAction(null)
  }

  return (
    <div>
      <PageHeader title="Payment Requests" subtitle="Companies ki withdrawal requests: approve, reject ya pay karein" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending" value={totals.pending.length} hint={money(sum(totals.pending, 'amount'))} icon={Clock} tone="amber" />
        <StatCard label="Approved (Unpaid)" value={totals.approved.length} hint={money(sum(totals.approved, 'amount'))} icon={CheckCircle2} tone="sky" />
        <StatCard label="Paid" value={totals.paid.length} hint={money(sum(totals.paid, 'amount'))} icon={Banknote} tone="emerald" />
        <StatCard label="Rejected" value={totals.rejected.length} hint={money(sum(totals.rejected, 'amount'))} icon={XCircle} tone="rose" />
      </div>

      <DataTable
        columns={columns}
        rows={payment_requests}
        exportName="payment-requests"
        searchKeys={[(r) => companyMap[r.company_id]?.name, 'amount', 'admin_note']}
        filters={[
          { key: 'status', label: 'Status', options: REQUEST_STATUSES },
          { key: 'company_id', label: 'Company', options: companies.map((c) => ({ value: c.id, label: c.name })) },
        ]}
      />

      <Modal open={!!action} title={action && titles[action.type]} onClose={() => setAction(null)} size="sm">
        {action && (
          <ActionForm
            action={action}
            company={companyMap[action.req.company_id]}
            bank={bank_accounts.find((b) => b.company_id === action.req.company_id)}
            onCancel={() => setAction(null)}
            onSubmit={submit}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message="Ye payment request delete karni hai?"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (await remove('payment_requests', deleting.id)) notify('Request delete ho gayi')
        }}
      />
    </div>
  )
}

function ActionForm({ action, company, bank, onSubmit, onCancel }) {
  const { req, type } = action
  const [note, setNote] = useState(req.admin_note || '')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState(req.amount)
  const [status, setStatus] = useState(req.status)
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="space-y-4 text-sm"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        await onSubmit({ note, reference, amount, status })
        setBusy(false)
      }}
    >
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="font-medium">{company?.name}</p>
        <p className="text-lg font-semibold">{money(req.amount)}</p>
        {bank ? (
          <p className="mt-1 text-xs text-slate-500">
            {bank.bank_name} · {bank.account_title} · {bank.iban} {!bank.verified && <span className="text-amber-600">(unverified)</span>}
          </p>
        ) : (
          <p className="mt-1 text-xs text-rose-600">Bank details maujood nahi</p>
        )}
      </div>

      {type === 'edit' && (
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block font-medium">Amount</span>
            <input className="input" type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block font-medium">Status</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {REQUEST_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {type === 'pay' && (
        <label className="block">
          <span className="mb-1 block font-medium">Transaction Reference *</span>
          <input className="input" required placeholder="e.g. TRX123456" value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block font-medium">Note {type === 'reject' && '*'}</span>
        <textarea className="input" rows={2} required={type === 'reject'} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={type === 'reject' ? 'btn-danger' : 'btn-primary'} disabled={busy}>
          {{ approve: 'Approve', reject: 'Reject', pay: 'Mark Paid', edit: 'Save' }[type]}
        </button>
      </div>
    </form>
  )
}
