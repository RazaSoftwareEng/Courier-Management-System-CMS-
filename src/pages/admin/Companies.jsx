import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, Ban, CheckCircle } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { COMPANY_STATUSES, CITIES } from '../../data/constants'
import { date, money } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import EntityForm from '../../components/EntityForm'
import { Modal, ConfirmDialog, PageHeader, IconButton, StatusBadge } from '../../components/ui'

const fields = [
  { name: 'name', label: 'Company Name', required: true, rule: 'name' },
  { name: 'owner_name', label: 'Owner Name', required: true, rule: 'personName' },
  { name: 'email', label: 'Email', type: 'email', required: true, rule: 'email' },
  { name: 'phone', label: 'Phone', required: true, rule: 'phone' },
  { name: 'city', label: 'City', type: 'select', options: CITIES, required: true },
  { name: 'status', label: 'Status', type: 'select', options: COMPANY_STATUSES, required: true, default: 'Active' },
  { name: 'address', label: 'Address', type: 'textarea', rule: 'address' },
]

// Sirf nayi company par: isi email + password se company login karegi
const passwordField = { name: 'password', label: 'Login Password (kam az kam 6 characters)', type: 'password', required: true, minLength: 6, full: true }

export default function Companies() {
  const store = useStore()
  const { companies, payments, bank_accounts, add, update, removeCompany, createLogin, notify } = store
  const [form, setForm] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  // Har company ko ab tak ki gayi payment
  const paidTo = useMemo(() => {
    const out = {}
    payments.forEach((p) => (out[p.company_id] = (out[p.company_id] || 0) + (Number(p.amount) || 0)))
    return out
  }, [payments])

  const columns = [
    {
      key: 'name',
      label: 'Company',
      render: (c) => (
        <div>
          <p className="font-medium text-slate-800">{c.name}</p>
          <p className="text-xs text-slate-400">{c.email}</p>
        </div>
      ),
    },
    { key: 'owner_name', label: 'Owner' },
    { key: 'phone', label: 'Phone' },
    { key: 'city', label: 'City' },
    { key: 'paid', label: 'Total Paid', align: 'right', render: (c) => money(paidTo[c.id]), csv: (c) => paidTo[c.id] || 0 },
    { key: 'status', label: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    { key: 'created_at', label: 'Joined', render: (c) => date(c.created_at), csv: (c) => date(c.created_at) },
    {
      key: 'actions',
      label: '',
      render: (c) => (
        <div className="flex justify-end gap-0.5">
          <IconButton icon={Eye} title="View" onClick={() => setViewing(c)} />
          {c.status === 'Active' ? (
            <IconButton icon={Ban} title="Suspend" tone="rose" onClick={() => setStatus(c, 'Suspended')} />
          ) : (
            <IconButton icon={CheckCircle} title="Activate" tone="emerald" onClick={() => setStatus(c, 'Active')} />
          )}
          <IconButton icon={Pencil} title="Edit" onClick={() => setForm({ item: c })} />
          <IconButton icon={Trash2} title="Delete" tone="rose" onClick={() => setDeleting(c)} />
        </div>
      ),
    },
  ]

  const setStatus = async (c, status) => {
    if (await update('companies', c.id, { status })) notify(`${c.name}: ${status}`)
  }

  const bank = viewing && bank_accounts.find((b) => b.company_id === viewing.id)

  return (
    <div>
      <PageHeader title="Customer Profile" subtitle="Tamam customers (companies) ki profile aur login">
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus size={16} /> Add Customer
        </button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={companies}
        exportName="companies"
        searchKeys={['name', 'owner_name', 'email', 'phone', 'city']}
        filters={[
          { key: 'status', label: 'Status', options: COMPANY_STATUSES },
          { key: 'city', label: 'City', options: CITIES },
        ]}
      />

      <Modal open={!!form} title={form?.item ? 'Edit Customer' : 'Add Customer'} onClose={() => setForm(null)}>
        {form && (
          <EntityForm
            fields={form.item ? fields : [...fields, passwordField]}
            initial={form.item}
            onCancel={() => setForm(null)}
            onSubmit={async ({ password, ...v }) => {
              if (form.item) {
                if (!(await update('companies', form.item.id, v))) return
                notify('Customer update ho gaya')
              } else {
                const company = await add('companies', v)
                if (!company) return
                // Company pehle bani, phir login: profile trigger email se link kar deta hai
                if (password && (await createLogin(v.email, password, v.owner_name))) {
                  notify('Customer aur uska login ban gaya')
                } else {
                  notify('Customer add ho gaya, lekin login nahi bana', 'error')
                }
              }
              setForm(null)
            }}
          />
        )}
      </Modal>

      <Modal open={!!viewing} title={viewing?.name} onClose={() => setViewing(null)} size="lg">
        {viewing && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Owner" value={viewing.owner_name} />
              <Info label="Status" value={<StatusBadge status={viewing.status} />} />
              <Info label="Email" value={viewing.email} />
              <Info label="Phone" value={viewing.phone} />
              <Info label="City" value={viewing.city} />
              <Info label="Address" value={viewing.address} />
            </div>
            <Mini label="Total Paid" value={money(paidTo[viewing.id])} strong />
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-2 font-semibold">Bank Account</p>
              {bank ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Info label="Bank" value={bank.bank_name} />
                  <Info label="Account Title" value={bank.account_title} />
                  <Info label="Account No." value={bank.account_no} />
                  <Info label="IBAN" value={bank.iban} />
                </div>
              ) : (
                <p className="text-slate-400">Bank details add nahi ki gayin</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={`${deleting?.name} aur iska saara data (statements, payments, bank details) delete ho jayega.`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (await removeCompany(deleting.id)) notify('Customer delete ho gaya')
        }}
      />
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <div className="mt-0.5 font-medium text-slate-800">{value || '-'}</div>
    </div>
  )
}

function Mini({ label, value, strong }) {
  return (
    <div className={`rounded-lg p-3 ${strong ? 'bg-indigo-50' : 'bg-slate-50'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold ${strong ? 'text-indigo-700' : ''}`}>{value}</p>
    </div>
  )
}
