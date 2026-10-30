import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Wallet, Banknote, Clock, FileText, FileSpreadsheet, BadgeCheck } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { money, date, byId, sum, companyBalances } from '../../lib/utils'
import { LIMITS } from '../../lib/validation'
import DataTable from '../../components/DataTable'
import EntityForm from '../../components/EntityForm'
import { Modal, ConfirmDialog, PageHeader, IconButton, StatCard, Section, StatusBadge } from '../../components/ui'
import StatementImport from '../../components/StatementImport'
import StatementList from '../../components/StatementList'

const METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'JazzCash', 'EasyPaisa']

export default function Payments() {
  const { payments, companies, add, update, remove, notify } = useStore()
  const [form, setForm] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importCompany, setImportCompany] = useState('')
  const [statementsKey, setStatementsKey] = useState(0)
  const [statements, setStatements] = useState([])
  const [payStatement, setPayStatement] = useState(null)
  const companyMap = useMemo(() => byId(companies), [companies])

  const ledgers = useMemo(() => companyBalances(companies, statements, payments), [companies, statements, payments])

  // Agli upload par company dobara chunni pare, taa ke file ghalat company mein na jaye
  const closeImport = () => {
    setImporting(false)
    setImportCompany('')
  }

  const fields = [
    { name: 'company_id', label: 'Company', type: 'select', required: true, options: companies.map((c) => ({ value: c.id, label: c.name })) },
    { name: 'amount', label: 'Amount', type: 'number', required: true, ...LIMITS.amount },
    { name: 'method', label: 'Method', type: 'select', options: METHODS, required: true, default: 'Bank Transfer' },
    { name: 'reference', label: 'Reference', required: true, rule: 'reference' },
  ]

  // Pending statements bhi list mein; Paid statement ki payment pehle se list mein hai, is liye dobara nahi
  const rows = useMemo(() => {
    const pending = statements
      .filter((s) => (s.status || 'Pending') === 'Pending')
      .map((s) => ({
        id: `st-${s.id}`,
        statement: s,
        company_id: s.company_id,
        amount: s.payable_total,
        method: 'Statement',
        reference: s.statement_number,
        status: 'Pending',
        created_at: s.updated_at,
      }))
    const paid = payments.map((p) => ({ ...p, status: 'Paid' }))
    return [...pending, ...paid].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [statements, payments])

  const columns = [
    { key: 'company', label: 'Company', render: (p) => <span className="font-medium">{companyMap[p.company_id]?.name || '-'}</span>, csv: (p) => companyMap[p.company_id]?.name },
    { key: 'amount', label: 'Amount', align: 'right', render: (p) => <span className="font-semibold">{money(p.amount)}</span> },
    { key: 'method', label: 'Method' },
    { key: 'reference', label: 'Reference', render: (p) => <span className="font-mono text-xs">{p.reference}</span> },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'created_at', label: 'Date', render: (p) => date(p.created_at), csv: (p) => date(p.created_at) },
    {
      key: 'actions',
      label: '',
      render: (p) =>
        p.statement ? (
          Number(p.amount) > 0 && (
            <div className="flex justify-end">
              <IconButton icon={BadgeCheck} title="Mark Paid (payment record karein)" tone="emerald" onClick={() => setPayStatement({ ...p.statement })} />
            </div>
          )
        ) : (
          <div className="flex justify-end gap-0.5">
            <IconButton icon={Pencil} title="Edit" onClick={() => setForm({ item: p })} />
            <IconButton icon={Trash2} title="Delete" tone="rose" onClick={() => setDeleting(p)} />
          </div>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Payment detail manually add karein ya Excel statement import karein">
        <button className="btn-secondary" onClick={() => setImporting(true)}>
          <FileSpreadsheet size={16} /> Import Excel
        </button>
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus size={16} /> Add Payment
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Statements" value={sum(ledgers, 'statements')} icon={FileText} />
        <StatCard label="Total Payable" value={money(sum(ledgers, 'payable'))} icon={Wallet} tone="sky" />
        <StatCard label="Total Paid Out" value={money(sum(payments, 'amount'))} icon={Banknote} tone="emerald" />
        <StatCard label="Pending Payment" value={money(sum(ledgers, 'pending'))} icon={Clock} tone="amber" />
      </div>

      <Section title="Company Balances">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Company</th>
                <th className="py-2 pr-4 text-right font-medium">Statements</th>
                <th className="py-2 pr-4 text-right font-medium">Total Payable</th>
                <th className="py-2 pr-4 text-right font-medium">Paid</th>
                <th className="py-2 text-right font-medium">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgers.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap py-2.5 pr-4 font-medium">{l.name}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right">{l.statements}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right">{money(l.payable)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right">{money(l.paid)}</td>
                  <td className="whitespace-nowrap py-2.5 text-right font-semibold text-amber-700">{money(l.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <DataTable
        columns={columns}
        rows={rows}
        exportName="payments"
        searchKeys={[(p) => companyMap[p.company_id]?.name, 'reference', 'method', 'amount']}
        filters={[
          { key: 'company_id', label: 'Company', options: companies.map((c) => ({ value: c.id, label: c.name })) },
          { key: 'status', label: 'Status', options: ['Pending', 'Paid'] },
        ]}
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
                if (!(await add('payments', v))) return
                notify('Payment add ho gayi')
              }
              setForm(null)
            }}
          />
        )}
      </Modal>

      {/* Import Excel se upload hui statements yahin nazar aati hain */}
      <StatementList refreshKey={statementsKey} onLoaded={setStatements} payRequest={payStatement} />

      <Modal open={importing} title="Import Statement Detail" onClose={closeImport} size="lg">
        {importing && (
          <StatementImport
            companyId={importCompany}
            onCompanyChange={setImportCompany}
            onDone={(saved, failed) => {
              setStatementsKey((k) => k + 1)
              // Sab save ho gaya to popup band; kuch fail hua to khula rahe taa ke wajah nazar aaye
              if (!failed) closeImport()
            }}
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
