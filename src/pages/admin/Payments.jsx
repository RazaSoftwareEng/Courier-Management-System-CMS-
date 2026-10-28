import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Wallet, Banknote, Package, Percent, FileSpreadsheet } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { money, date, byId, sum, companyLedger } from '../../lib/utils'
import { LIMITS, check, checkNumber } from '../../lib/validation'
import DataTable from '../../components/DataTable'
import EntityForm from '../../components/EntityForm'
import { Modal, ConfirmDialog, PageHeader, IconButton, StatCard, Section } from '../../components/ui'
import BulkImport, { collector, num } from '../../components/BulkImport'

const METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'JazzCash', 'EasyPaisa']

const IMPORT_COLUMNS = [
  { key: 'company', label: 'Company', required: true, width: 28, aliases: ['company name'] },
  { key: 'amount', label: 'Amount', required: true, width: 14 },
  { key: 'method', label: 'Method', width: 16, aliases: ['payment method'] },
  { key: 'reference', label: 'Reference', required: true, width: 24, aliases: ['ref', 'transaction id', 'tid'], text: true },
]

const IMPORT_NOTES = [
  ['Company', 'Yes', 'Company ka naam bilkul waisa jaisa system mein hai'],
  ['Amount', 'Yes', `${LIMITS.amount.min.toLocaleString()} se ${LIMITS.amount.max.toLocaleString()} tak`],
  ['Method', 'No', `${METHODS.join(' / ')} — khali chhorein to Bank Transfer`],
  ['Reference', 'Yes', 'Transaction ID / cheque number (zyada se zyada 50 characters)'],
]

export default function Payments() {
  const store = useStore()
  const { payments, companies, add, update, remove, notify } = store
  const [form, setForm] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [importing, setImporting] = useState(false)

  const companyMap = useMemo(() => byId(companies), [companies])
  const ledgers = useMemo(() => companies.map((c) => ({ id: c.id, name: c.name, ...companyLedger(c.id, store) })), [companies, store])

  const fields = [
    { name: 'company_id', label: 'Company', type: 'select', required: true, options: companies.map((c) => ({ value: c.id, label: c.name })) },
    { name: 'amount', label: 'Amount', type: 'number', required: true, ...LIMITS.amount },
    { name: 'method', label: 'Method', type: 'select', options: METHODS, required: true, default: 'Bank Transfer' },
    { name: 'reference', label: 'Reference', required: true, rule: 'reference' },
  ]

  // Direct payment: pehle 'Paid' request, phir payment (Add Payment wala tareeqa)
  const recordPayment = async (v, opts) => {
    const req = await add('payment_requests', { company_id: v.company_id, amount: v.amount, status: 'Paid', admin_note: 'Direct payment by admin' }, opts)
    return req && add('payments', { ...v, request_id: req.id }, opts)
  }

  const companyByName = useMemo(() => Object.fromEntries(companies.map((c) => [c.name.trim().toLowerCase(), c])), [companies])

  const validateImport = (raw) => {
    const { errors, take } = collector()
    const company = companyByName[raw.company.toLowerCase()]
    if (!raw.company) errors.push('Company zaroori hai')
    else if (!company) errors.push(`Company "${raw.company}" system mein nahi mili`)
    const method = METHODS.find((m) => m.toLowerCase() === (raw.method || 'Bank Transfer').toLowerCase())
    if (!method) errors.push(`Method in mein se ho: ${METHODS.join(', ')}`)
    const payload = {
      company_id: company?.id,
      amount: take(checkNumber(num(raw.amount), { ...LIMITS.amount, label: 'Amount' }), 'Amount'),
      method,
      reference: take(check('reference', raw.reference, { required: true, label: 'Reference' }), 'Reference'),
    }
    return { payload, errors }
  }

  const importPreview = [
    { label: 'Company', render: (r) => <span className="font-medium">{r.raw.company || '-'}</span> },
    { label: 'Amount', align: 'right', render: (r) => (r.raw.amount ? money(num(r.raw.amount)) : '-') },
    { label: 'Method', render: (r) => r.raw.method || 'Bank Transfer' },
    { label: 'Reference', render: (r) => <span className="font-mono text-xs">{r.raw.reference || '-'}</span> },
  ]

  const columns = [
    { key: 'company', label: 'Company', render: (p) => <span className="font-medium">{companyMap[p.company_id]?.name || '-'}</span>, csv: (p) => companyMap[p.company_id]?.name },
    { key: 'amount', label: 'Amount', align: 'right', render: (p) => <span className="font-semibold">{money(p.amount)}</span> },
    { key: 'method', label: 'Method' },
    { key: 'reference', label: 'Reference', render: (p) => <span className="font-mono text-xs">{p.reference}</span> },
    { key: 'created_at', label: 'Date', render: (p) => date(p.created_at), csv: (p) => date(p.created_at) },
    {
      key: 'actions',
      label: '',
      render: (p) => (
        <div className="flex justify-end gap-0.5">
          <IconButton icon={Pencil} title="Edit" onClick={() => setForm({ item: p })} />
          <IconButton icon={Trash2} title="Delete" tone="rose" onClick={() => setDeleting(p)} />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Companies ko ki gayi payments aur har company ka hisaab">
        <button className="btn-secondary" onClick={() => setImporting(true)}>
          <FileSpreadsheet size={16} /> Import Excel
        </button>
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus size={16} /> Add Payment
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total COD Collected" value={money(sum(ledgers, 'totalCod'))} icon={Package} />
        <StatCard label="Delivery Charges Earned" value={money(sum(ledgers, 'charges'))} icon={Wallet} tone="emerald" />
        <StatCard label="Commission" value={money(sum(ledgers, 'commissionAmount'))} icon={Percent} tone="sky" />
        <StatCard label="Total Paid Out" value={money(sum(payments, 'amount'))} icon={Banknote} tone="amber" />
      </div>

      <Section title="Company Balances">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Company</th>
                <th className="py-2 pr-4 text-right font-medium">COD</th>
                <th className="py-2 pr-4 text-right font-medium">Charges</th>
                <th className="py-2 pr-4 text-right font-medium">Paid</th>
                <th className="py-2 pr-4 text-right font-medium">Pending</th>
                <th className="py-2 text-right font-medium">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgers.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap py-2.5 pr-4 font-medium">{l.name}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right">{money(l.totalCod)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right">{money(l.charges)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right">{money(l.paid)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right">{money(l.pending)}</td>
                  <td className="whitespace-nowrap py-2.5 text-right font-semibold text-indigo-700">{money(l.available)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <DataTable
        columns={columns}
        rows={payments}
        exportName="payments"
        searchKeys={[(p) => companyMap[p.company_id]?.name, 'reference', 'method', 'amount']}
        filters={[{ key: 'company_id', label: 'Company', options: companies.map((c) => ({ value: c.id, label: c.name })) }]}
      />

      <Modal open={!!form} title={form?.item ? 'Edit Payment' : 'Add Payment'} onClose={() => setForm(null)}>
        {form && (
          <EntityForm
            fields={fields}
            initial={form.item}
            onCancel={() => setForm(null)}
            onSubmit={async (v) => {
              if (form.item) {
                if (!(await update('payments', form.item.id, v))) return
                notify('Payment update ho gayi')
              } else {
                // Direct payment ko bhi request ke tor par record karein taa ke company ka balance sahi rahe
                if (!(await recordPayment(v))) return
                notify('Payment add ho gayi')
              }
              setForm(null)
            }}
          />
        )}
      </Modal>

      <Modal open={importing} title="Import Payments" onClose={() => setImporting(false)} size="lg">
        {importing && (
          <BulkImport
            noun="payments"
            columns={IMPORT_COLUMNS}
            sheetName="Payments"
            template={{
              filename: 'payments-sample.xlsx',
              sampleRows: [
                [companies[0]?.name || 'Company Name', 5000, 'Bank Transfer', 'TXN123456'],
                [companies[1]?.name || companies[0]?.name || 'Company Name', 2500, 'JazzCash', 'JC987654'],
              ],
            }}
            notes={IMPORT_NOTES}
            validate={validateImport}
            create={async (payload, onError) => (await recordPayment(payload, { onError })) && money(payload.amount)}
            preview={importPreview}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message="Ye payment record delete karna hai?"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (await remove('payments', deleting.id)) notify('Payment delete ho gayi')
        }}
      />
    </div>
  )
}
