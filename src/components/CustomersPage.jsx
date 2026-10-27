import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { CITIES } from '../data/constants'
import { date, byId, countBy } from '../lib/utils'
import DataTable from './DataTable'
import EntityForm from './EntityForm'
import { Modal, ConfirmDialog, PageHeader, IconButton } from './ui'

export default function CustomersPage({ companyId }) {
  const { customers, companies, parcels, add, update, remove, notify } = useStore()
  const [form, setForm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const companyMap = useMemo(() => byId(companies), [companies])
  const parcelCount = useMemo(() => countBy(parcels, 'customer_id'), [parcels])
  const rows = useMemo(() => (companyId ? customers.filter((c) => c.company_id === companyId) : customers), [customers, companyId])

  const fields = [
    ...(!companyId ? [{ name: 'company_id', label: 'Company', type: 'select', required: true, options: companies.map((c) => ({ value: c.id, label: c.name })) }] : []),
    { name: 'name', label: 'Name', required: true },
    { name: 'phone', label: 'Phone', required: true },
    { name: 'city', label: 'City', type: 'select', required: true, options: CITIES },
    { name: 'address', label: 'Address', type: 'textarea', required: true },
  ]

  const columns = [
    { key: 'name', label: 'Name', render: (c) => <span className="font-medium text-slate-800">{c.name}</span> },
    { key: 'phone', label: 'Phone' },
    ...(!companyId ? [{ key: 'company', label: 'Company', render: (c) => companyMap[c.company_id]?.name || '-', csv: (c) => companyMap[c.company_id]?.name }] : []),
    { key: 'city', label: 'City' },
    { key: 'address', label: 'Address', render: (c) => <span className="block max-w-56 truncate">{c.address}</span> },
    { key: 'parcels', label: 'Parcels', align: 'right', render: (c) => parcelCount[c.id] || 0, csv: (c) => parcelCount[c.id] || 0 },
    { key: 'created_at', label: 'Added', render: (c) => date(c.created_at), csv: (c) => date(c.created_at) },
    {
      key: 'actions',
      label: '',
      render: (c) => (
        <div className="flex justify-end gap-0.5">
          <IconButton icon={Pencil} title="Edit" onClick={() => setForm({ item: c })} />
          <IconButton icon={Trash2} title="Delete" tone="rose" onClick={() => setDeleting(c)} />
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Customers" subtitle={companyId ? 'Aapke customers' : 'Tamam companies ke customers'}>
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus size={16} /> Add Customer
        </button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={rows}
        exportName="customers"
        searchKeys={['name', 'phone', 'city', 'address', (c) => companyMap[c.company_id]?.name]}
        filters={[
          ...(!companyId ? [{ key: 'company_id', label: 'Company', options: companies.map((c) => ({ value: c.id, label: c.name })) }] : []),
          { key: 'city', label: 'City', options: CITIES },
        ]}
      />

      <Modal open={!!form} title={form?.item ? 'Edit Customer' : 'Add Customer'} onClose={() => setForm(null)}>
        {form && (
          <EntityForm
            fields={fields}
            initial={form.item}
            onCancel={() => setForm(null)}
            onSubmit={async (v) => {
              if (companyId) v.company_id = companyId
              const ok = form.item ? await update('customers', form.item.id, v) : await add('customers', v)
              if (!ok) return
              notify(form.item ? 'Customer update ho gaya' : 'Customer add ho gaya')
              setForm(null)
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={`${deleting?.name} ko delete karna hai?`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (await remove('customers', deleting.id)) notify('Customer delete ho gaya')
        }}
      />
    </div>
  )
}
