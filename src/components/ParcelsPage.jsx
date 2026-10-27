import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, RefreshCw, Printer, Truck, Check } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { PARCEL_STATUSES, CITIES } from '../data/constants'
import { money, date, dateTime, byId } from '../lib/utils'
import DataTable from './DataTable'
import { Modal, ConfirmDialog, StatusBadge, PageHeader, IconButton } from './ui'

// companyId diya ho to sirf us company ke parcels (Company dashboard), warna sab (Admin)
export default function ParcelsPage({ companyId }) {
  const { parcels, customers, companies, add, update, remove, updateParcelStatus, notify } = useStore()
  const [form, setForm] = useState(null) // { parcel? }
  const [statusFor, setStatusFor] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const isAdmin = !companyId
  const customerMap = useMemo(() => byId(customers), [customers])
  const companyMap = useMemo(() => byId(companies), [companies])
  const rows =useMemo(() => (companyId ? parcels.filter((p) => p.company_id === companyId) : parcels), [parcels, companyId])

  const columns = [
    { key: 'tracking_id', label: 'Tracking ID', render: (p) => <span className="font-mono font-medium text-indigo-600">{p.tracking_id}</span> },
    ...(!companyId ? [{ key: 'company', label: 'Company', render: (p) => companyMap[p.company_id]?.name || '-', csv: (p) => companyMap[p.company_id]?.name }] : []),
    {
      key: 'customer',
      label: 'Customer',
      render: (p) => (
        <div>
          <p className="font-medium text-slate-800">{customerMap[p.customer_id]?.name || '-'}</p>
          <p className="text-xs text-slate-400">{customerMap[p.customer_id]?.phone}</p>
        </div>
      ),
      csv: (p) => customerMap[p.customer_id]?.name,
    },
    { key: 'city', label: 'City' },
    { key: 'cod_amount', label: 'COD', align: 'right', render: (p) => money(p.cod_amount) },
    { key: 'delivery_charges', label: 'Charges', align: 'right', render: (p) => money(p.delivery_charges) },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'created_at', label: 'Date', render: (p) => date(p.created_at), csv: (p) => date(p.created_at) },
    {
      key: 'actions',
      label: '',
      // Status sirf admin badalta hai; company sirf 'Booked' parcel edit/delete kar sakti hai
      render: (p) => {
        const editable = isAdmin || p.status === 'Booked'
        return (
          <div className="flex justify-end gap-0.5">
            <IconButton icon={Eye} title="View / Track" onClick={() => setViewing(p)} />
            {isAdmin && <IconButton icon={RefreshCw} title="Update status" onClick={() => setStatusFor(p)} tone="emerald" />}
            {editable && <IconButton icon={Pencil} title="Edit" onClick={() => setForm({ parcel: p })} />}
            {editable && <IconButton icon={Trash2} title="Delete" onClick={() => setDeleting(p)} tone="rose" />}
          </div>
        )
      },
    },
  ]

  const filters = [
    { key: 'status', label: 'Status', options: PARCEL_STATUSES },
    ...(!companyId ? [{ key: 'company_id', label: 'Company', options: companies.map((c) => ({ value: c.id, label: c.name })) }] : []),
    { key: 'city', label: 'City', options: CITIES },
  ]

  const save = async ({ parcel, newCustomer }) => {
    let customerId = parcel.customer_id
    if (newCustomer) {
      const customer = await add('customers', { ...newCustomer, company_id: parcel.company_id })
      if (!customer) return
      customerId = customer.id
    }
    const city = newCustomer?.city || customerMap[customerId]?.city || parcel.city
    if (form.parcel) {
      if (!(await update('parcels', form.parcel.id, { ...parcel, customer_id: customerId, city }))) return
      notify('Parcel update ho gaya')
    } else {
      // tracking_id, status aur history database khud banata hai
      const created = await add('parcels', { ...parcel, customer_id: customerId, city })
      if (!created) return
      notify(`Parcel book ho gaya: ${created.tracking_id}`)
    }
    setForm(null)
  }

  return (
    <div>
      <PageHeader title="Parcels" subtitle={companyId ? 'Parcel book karein; status admin update karta hai aur yahan live nazar aata hai' : 'Tamam companies ke parcels: status yahan se update karein'}>
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus size={16} /> Book Parcel
        </button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={rows}
        filters={filters}
        exportName="parcels"
        searchKeys={['tracking_id', 'city', 'description', (p) => customerMap[p.customer_id]?.name, (p) => customerMap[p.customer_id]?.phone, (p) => companyMap[p.company_id]?.name]}
      />

      <Modal open={!!form} title={form?.parcel ? `Edit Parcel ${form.parcel.tracking_id}` : 'Book New Parcel'} onClose={() => setForm(null)} size="lg">
        {form && <ParcelForm parcel={form.parcel} companyId={companyId} onSubmit={save} onCancel={() => setForm(null)} />}
      </Modal>

      <Modal open={!!statusFor} title={`Update Status: ${statusFor?.tracking_id}`} onClose={() => setStatusFor(null)} size="sm">
        {statusFor && (
          <StatusForm
            parcel={statusFor}
            onCancel={() => setStatusFor(null)}
            onSubmit={async (status, note) => {
              if (!(await updateParcelStatus(statusFor.id, status, note))) return
              notify(`Status: ${status}`)
              setStatusFor(null)
            }}
          />
        )}
      </Modal>

      <Modal open={!!viewing} title="Parcel Details" onClose={() => setViewing(null)} size="lg">
        {viewing && <ParcelDetail parcel={parcels.find((p) => p.id === viewing.id) || viewing} customer={customerMap[viewing.customer_id]} company={companyMap[viewing.company_id]} />}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={`Parcel ${deleting?.tracking_id} delete karna hai? Ye wapis nahi hoga.`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (await remove('parcels', deleting.id)) notify('Parcel delete ho gaya')
        }}
      />
    </div>
  )
}

function ParcelForm({ parcel, companyId, onSubmit, onCancel }) {
  const { companies, customers, rates } = useStore()
  const [v, setV] = useState({
    company_id: parcel?.company_id || companyId || '',
    customer_id: parcel?.customer_id || '',
    weight: parcel?.weight ?? 1,
    cod_amount: parcel?.cod_amount ?? '',
    delivery_charges: parcel?.delivery_charges ?? '',
    description: parcel?.description || '',
  })
  const [isNew, setIsNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [nc, setNc] = useState({ name: '', phone: '', city: '', address: '' })
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }))

  const companyCustomers = customers.filter((c) => c.company_id === v.company_id)
  const city = isNew ? nc.city : customers.find((c) => c.id === v.customer_id)?.city
  const rate = rates.find((r) => r.city === city)
  // Database ke calc_delivery_charges() jaisa formula
  const suggested = Number(rate?.base_charge ?? 200) + Math.ceil(Number(v.weight) || 0) * Number(rate?.per_kg ?? 50)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    await onSubmit({
      parcel: {
        ...v,
        weight: Number(v.weight) || 0,
        cod_amount: Number(v.cod_amount) || 0,
        // Company ke liye database khud charges lagata hai
        delivery_charges: companyId || v.delivery_charges === '' ? suggested : Number(v.delivery_charges),
      },
      newCustomer: isNew ? nc : null,
    })
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!companyId && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Company *</span>
          <select className="input" required value={v.company_id} onChange={(e) => setV((s) => ({ ...s, company_id: e.target.value, customer_id: '' }))}>
            <option value="">Select company...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Customer (Receiver)</p>
          <button type="button" className="text-sm font-medium text-indigo-600 hover:underline" onClick={() => setIsNew(!isNew)}>
            {isNew ? 'Existing customer select karein' : '+ New customer'}
          </button>
        </div>
        {isNew ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className="input" required placeholder="Name *" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
            <input className="input" required placeholder="Phone *" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} />
            <select className="input" required value={nc.city} onChange={(e) => setNc({ ...nc, city: e.target.value })}>
              <option value="">City *</option>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input className="input" required placeholder="Address *" value={nc.address} onChange={(e) => setNc({ ...nc, address: e.target.value })} />
          </div>
        ) : (
          <select className="input" required value={v.customer_id} onChange={(e) => set('customer_id', e.target.value)} disabled={!v.company_id}>
            <option value="">{v.company_id ? 'Select customer...' : 'Pehle company select karein'}</option>
            {companyCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.phone} · {c.city}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Weight (kg) *</span>
          <input className="input" type="number" step="0.5" min="0.5" required value={v.weight} onChange={(e) => set('weight', e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">COD Amount *</span>
          <input className="input" type="number" min="0" required value={v.cod_amount} onChange={(e) => set('cod_amount', e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Delivery Charges</span>
          {companyId ? (
            <input className="input bg-slate-50" disabled value={`Rs ${suggested} (auto)`} />
          ) : (
            <input className="input" type="number" min="0" placeholder={`Auto: ${suggested}`} value={v.delivery_charges} onChange={(e) => set('delivery_charges', e.target.value)} />
          )}
        </label>
        <label className="block sm:col-span-3">
          <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
          <input className="input" placeholder="e.g. Clothes, Shoes" value={v.description} onChange={(e) => set('description', e.target.value)} />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving...' : parcel ? 'Save Changes' : 'Book Parcel'}
        </button>
      </div>
    </form>
  )
}

function StatusForm({ parcel, onSubmit, onCancel }) {
  const [status, setStatus] = useState(parcel.status)
  const [note, setNote] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(status, note)
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-2">
        {PARCEL_STATUSES.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${status === s ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <input className="input" placeholder="Note (optional), e.g. Rider: Asif" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={status === parcel.status && !note}>
          Update
        </button>
      </div>
    </form>
  )
}

function ParcelDetail({ parcel, customer, company }) {
  const history = [...(parcel.history || [])].reverse()
  return (
    <div className="space-y-5">
      <div id="parcel-label" className="rounded-lg border-2 border-dashed border-slate-300 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Tracking ID</p>
            <p className="font-mono text-2xl font-bold tracking-wider">{parcel.tracking_id}</p>
          </div>
          <StatusBadge status={parcel.status} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-500">From</p>
            <p className="font-medium">{company?.name}</p>
            <p className="text-slate-500">{company?.phone}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">To</p>
            <p className="font-medium">{customer?.name}</p>
            <p className="text-slate-500">{customer?.phone}</p>
            <p className="text-slate-500">
              {customer?.address}, {parcel.city}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">COD Amount</p>
            <p className="text-lg font-semibold">{money(parcel.cod_amount)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs uppercase text-slate-500">Weight</p>
              <p className="font-medium">{parcel.weight} kg</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-500">Item</p>
              <p className="font-medium">{parcel.description || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Truck size={16} /> Tracking History
        </p>
        <ol className="relative ml-2 border-l-2 border-slate-200">
          {history.map((h, i) => (
            <li key={i} className="mb-4 ml-5">
              <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ${i === 0 ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                {i === 0 && <Check size={10} className="text-white" />}
              </span>
              <p className="text-sm font-medium">{h.status}</p>
              <p className="text-xs text-slate-500">
                {dateTime(h.at)}
                {h.note && ` · ${h.note}`}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex justify-end">
        <button className="btn-secondary" onClick={() => printLabel()}>
          <Printer size={16} /> Print Label
        </button>
      </div>
    </div>
  )
}

function printLabel() {
  const el = document.getElementById('parcel-label')
  if (!el) return
  const w = window.open('', '_blank', 'width=600,height=500')
  if (!w) return
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((s) => s.outerHTML).join('')
  w.document.write(`<html><head><title>Label</title>${styles}</head><body style="padding:24px">${el.outerHTML}</body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 300)
}
