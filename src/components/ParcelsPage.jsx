import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Eye, RefreshCw, Printer, Truck, Check, Bike, Banknote } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { PARCEL_STATUSES, CITIES, COUNTRIES, DELIVERY_TYPES, deliveryCharges, deliveryType } from '../data/constants'
import { money, date, dateTime, byId } from '../lib/utils'
import { RULES, LIMITS, check, checkNumber } from '../lib/validation'
import DataTable from './DataTable'
import { Modal, ConfirmDialog, StatusBadge, PageHeader, IconButton } from './ui'

// Local parcel head office se seedha delivery par jata hai; bahar wala pehle dispatch hota hai
const LOCAL_SKIP = ['In Transit', 'Arrived at Destination']

const destination = (p) => [p.city, p.destination_country && p.destination_country !== 'Pakistan' ? p.destination_country : null].filter(Boolean).join(', ')

// companyId diya ho to sirf us company ke parcels (Company dashboard), warna sab (Admin)
export default function ParcelsPage({ companyId }) {
  const { parcels, customers, companies, riders, add, update, remove, updateParcelStatus, assignRider, notify } = useStore()
  const [form, setForm] = useState(null) // { parcel? }
  const [statusFor, setStatusFor] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const isAdmin = !companyId
  const customerMap = useMemo(() => byId(customers), [customers])
  const companyMap = useMemo(() => byId(companies), [companies])
  const riderMap = useMemo(() => byId(riders), [riders])
  const rows = useMemo(() => (companyId ? parcels.filter((p) => p.company_id === companyId) : parcels), [parcels, companyId])

  const riderCell = (label, r) => (
    <p className="text-xs">
      <span className="text-slate-400">{label}: </span>
      {r ? <span className="font-medium text-slate-700">{r.name}</span> : <span className="text-slate-400">-</span>}
    </p>
  )

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
    {
      key: 'city',
      label: 'Destination',
      render: (p) => (
        <div>
          <p>{destination(p)}</p>
          <StatusBadge status={p.delivery_type || 'Local'} />
        </div>
      ),
      csv: (p) => `${destination(p)} (${p.delivery_type})`,
    },
    { key: 'cod_amount', label: 'COD', align: 'right', render: (p) => money(p.cod_amount) },
    { key: 'delivery_charges', label: 'Charges', align: 'right', render: (p) => money(p.delivery_charges) },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'rider',
      label: 'Riders',
      render: (p) => (
        <div className="space-y-0.5">
          {riderCell('Pickup', riderMap[p.pickup_rider_id])}
          {riderCell('Delivery', riderMap[p.rider_id])}
        </div>
      ),
      csv: (p) => `Pickup: ${riderMap[p.pickup_rider_id]?.name || '-'} / Delivery: ${riderMap[p.rider_id]?.name || '-'}`,
    },
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
            {isAdmin && <IconButton icon={RefreshCw} title="Rider / Status update" onClick={() => setStatusFor(p)} tone="emerald" />}
            {editable && <IconButton icon={Pencil} title="Edit" onClick={() => setForm({ parcel: p })} />}
            {editable && <IconButton icon={Trash2} title="Delete" onClick={() => setDeleting(p)} tone="rose" />}
          </div>
        )
      },
    },
  ]

  const filters = [
    { key: 'status', label: 'Status', options: PARCEL_STATUSES },
    { key: 'delivery_type', label: 'Type', options: DELIVERY_TYPES },
    ...(!companyId
      ? [
          { key: 'company_id', label: 'Company', options: companies.map((c) => ({ value: c.id, label: c.name })) },
          { key: 'rider_id', label: 'Delivery rider', options: riders.map((r) => ({ value: r.id, label: r.name })) },
        ]
      : []),
  ]

  const save = async ({ parcel, newCustomer }) => {
    let customer = customerMap[parcel.customer_id]
    if (newCustomer) {
      customer = await add('customers', { ...newCustomer, company_id: parcel.company_id })
      if (!customer) return
    }
    // Destination hamesha customer ke address se
    const payload = { ...parcel, customer_id: customer.id, city: customer.city, destination_country: customer.country || 'Pakistan' }
    if (form.parcel) {
      if (!(await update('parcels', form.parcel.id, payload))) return
      notify('Parcel update ho gaya')
    } else {
      // tracking_id, status, delivery type aur history database khud banata hai
      const created = await add('parcels', payload)
      if (!created) return
      notify(`Parcel book ho gaya: ${created.tracking_id}`)
    }
    setForm(null)
  }

  return (
    <div>
      <PageHeader
        title="Parcels"
        subtitle={companyId ? 'Parcel book karein; status admin aur riders update karte hain aur yahan live nazar aata hai' : 'Tamam companies ke parcels: riders aur status yahan se update karein'}
      >
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus size={16} /> Book Parcel
        </button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={rows}
        filters={filters}
        exportName="parcels"
        searchKeys={[
          'tracking_id',
          'city',
          'destination_country',
          'description',
          (p) => customerMap[p.customer_id]?.name,
          (p) => customerMap[p.customer_id]?.phone,
          (p) => companyMap[p.company_id]?.name,
          (p) => riderMap[p.rider_id]?.name,
          (p) => riderMap[p.pickup_rider_id]?.name,
        ]}
      />

      <Modal open={!!form} title={form?.parcel ? `Edit Parcel ${form.parcel.tracking_id}` : 'Book New Parcel'} onClose={() => setForm(null)} size="lg">
        {form && <ParcelForm parcel={form.parcel} companyId={companyId} onSubmit={save} onCancel={() => setForm(null)} />}
      </Modal>

      <Modal open={!!statusFor} title={`Update Parcel: ${statusFor?.tracking_id}`} onClose={() => setStatusFor(null)}>
        {statusFor && (
          <StatusForm
            parcel={statusFor}
            riders={riders}
            onCancel={() => setStatusFor(null)}
            onSubmit={async ({ status, note, pickupId, deliveryId }) => {
              // Pehle riders, phir status, taa ke history mein sahi tarteeb rahe
              if (pickupId !== (statusFor.pickup_rider_id || '') && !(await assignRider(statusFor.id, pickupId, 'pickup'))) return
              if (deliveryId !== (statusFor.rider_id || '') && !(await assignRider(statusFor.id, deliveryId, 'delivery'))) return
              if ((status !== statusFor.status || note) && !(await updateParcelStatus(statusFor.id, status, note))) return
              notify('Parcel update ho gaya')
              setStatusFor(null)
            }}
          />
        )}
      </Modal>

      <Modal open={!!viewing} title="Parcel Details" onClose={() => setViewing(null)} size="lg">
        {viewing &&
          (() => {
            const current = parcels.find((p) => p.id === viewing.id) || viewing
            return (
              <ParcelDetail
                parcel={current}
                customer={customerMap[current.customer_id]}
                company={companyMap[current.company_id]}
                pickupRider={riderMap[current.pickup_rider_id]}
                deliveryRider={riderMap[current.rider_id]}
              />
            )
          })()}
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

function FieldError({ msg }) {
  return msg ? <span className="mt-1 block text-xs text-rose-600">{msg}</span> : null
}

function ParcelForm({ parcel, companyId, onSubmit, onCancel }) {
  const { companies, customers, rates, settings } = useStore()
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
  const [nc, setNc] = useState({ name: '', phone: '', city: '', country: 'Pakistan', address: '' })
  const [errors, setErrors] = useState({})
  const set = (k, val) => setV((s) => ({ ...s, [k]: val }))
  const errCls = (k) => (errors[k] ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : '')

  const companyCustomers = customers.filter((c) => c.company_id === v.company_id)
  const dest = isNew ? nc : customers.find((c) => c.id === v.customer_id) || {}
  const type = dest.city ? deliveryType(dest, settings) : null
  const suggested = deliveryCharges({ city: dest.city, weight: v.weight, country: dest.country }, rates, settings)
  const cityOptions = [...new Set([...rates.map((r) => r.city), ...CITIES])]

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    const take = (key, res) => {
      if (res.error) errs[key] = res.error
      return res.value
    }

    if (!v.company_id) errs.company_id = 'Company select karein'
    if (!isNew && !v.customer_id) errs.customer_id = 'Customer select karein ya naya customer add karein'

    let customer = null
    if (isNew) {
      customer = {
        name: take('nc_name', check('personName', nc.name, { required: true, label: 'Name' })),
        phone: take('nc_phone', check('phone', nc.phone, { required: true, label: 'Phone' })),
        city: take('nc_city', check('city', nc.city, { required: true, label: 'City' })),
        country: take('nc_country', check('city', nc.country || 'Pakistan', { required: true, label: 'Country' })),
        address: take('nc_address', check('address', nc.address, { required: true, label: 'Address' })),
      }
      setNc(customer)
    }
    const weight = take('weight', checkNumber(v.weight, { ...LIMITS.weight, label: 'Weight' }))
    const cod = take('cod_amount', checkNumber(v.cod_amount, { ...LIMITS.cod, label: 'COD' }))
    // Company ke liye database khud charges lagata hai
    const charges =
      companyId || v.delivery_charges === '' ? suggested : take('delivery_charges', checkNumber(v.delivery_charges, { ...LIMITS.charges, label: 'Charges' }))
    const description = take('description', check('text', v.description))

    setErrors(errs)
    if (Object.keys(errs).length) return

    setBusy(true)
    await onSubmit({
      parcel: { ...v, weight, cod_amount: cod, delivery_charges: charges, description: description || null },
      newCustomer: customer,
    })
    setBusy(false)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {!companyId && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Company *</span>
          <select className="input" value={v.company_id} onChange={(e) => setV((s) => ({ ...s, company_id: e.target.value, customer_id: '' }))}>
            <option value="">Select company...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <FieldError msg={errors.company_id} />
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
            <div>
              <input className={`input ${errCls('nc_name')}`} maxLength={RULES.personName.maxLength} placeholder="Name *" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
              <FieldError msg={errors.nc_name} />
            </div>
            <div>
              <input className={`input ${errCls('nc_phone')}`} maxLength={RULES.phone.maxLength} inputMode="tel" placeholder="Phone * (03001234567)" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} />
              <FieldError msg={errors.nc_phone} />
            </div>
            <div>
              <input className={`input ${errCls('nc_country')}`} list="parcel-countries" maxLength={60} placeholder="Country *" value={nc.country} onChange={(e) => setNc({ ...nc, country: e.target.value })} />
              <datalist id="parcel-countries">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <FieldError msg={errors.nc_country} />
            </div>
            <div>
              <input className={`input ${errCls('nc_city')}`} list="parcel-cities" maxLength={RULES.city.maxLength} placeholder="City *" value={nc.city} onChange={(e) => setNc({ ...nc, city: e.target.value })} />
              <datalist id="parcel-cities">
                {cityOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <FieldError msg={errors.nc_city} />
            </div>
            <div className="sm:col-span-2">
              <input className={`input ${errCls('nc_address')}`} maxLength={RULES.address.maxLength} placeholder="Address *" value={nc.address} onChange={(e) => setNc({ ...nc, address: e.target.value })} />
              <FieldError msg={errors.nc_address} />
            </div>
          </div>
        ) : (
          <select className="input" value={v.customer_id} onChange={(e) => set('customer_id', e.target.value)} disabled={!v.company_id}>
            <option value="">{v.company_id ? 'Select customer...' : 'Pehle company select karein'}</option>
            {companyCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.phone} · {c.city}
                {c.country && c.country !== 'Pakistan' ? `, ${c.country}` : ''}
              </option>
            ))}
          </select>
        )}
        {!isNew && <FieldError msg={errors.customer_id} />}
        {type && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <StatusBadge status={type} />
            {type === 'Local' ? `${settings.hub_city || 'Lahore'} ke andar delivery` : 'Head office se dispatch hoga'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Weight (kg) *</span>
          <input className={`input ${errCls('weight')}`} type="number" step="0.1" {...LIMITS.weight} value={v.weight} onChange={(e) => set('weight', e.target.value)} />
          <FieldError msg={errors.weight} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">COD Amount *</span>
          <input className={`input ${errCls('cod_amount')}`} type="number" {...LIMITS.cod} value={v.cod_amount} onChange={(e) => set('cod_amount', e.target.value)} />
          <FieldError msg={errors.cod_amount} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Delivery Charges</span>
          {companyId ? (
            <input className="input bg-slate-50" disabled value={`Rs ${suggested} (auto)`} />
          ) : (
            <input className={`input ${errCls('delivery_charges')}`} type="number" {...LIMITS.charges} placeholder={`Auto: ${suggested}`} value={v.delivery_charges} onChange={(e) => set('delivery_charges', e.target.value)} />
          )}
          <FieldError msg={errors.delivery_charges} />
        </label>
        <label className="block sm:col-span-3">
          <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
          <input className="input" maxLength={RULES.text.maxLength} placeholder="e.g. Clothes, Shoes" value={v.description} onChange={(e) => set('description', e.target.value)} />
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

const NOTE_HINT = {
  'At Head Office': 'e.g. Office mein receive kiya',
  'In Transit': 'Gari / bilty number, e.g. LES-1234 Karachi ke liye',
  'Arrived at Destination': 'e.g. Karachi branch mein pohanch gaya',
  Returned: 'Return ki wajah',
}

function StatusForm({ parcel, riders, onSubmit, onCancel }) {
  const [status, setStatus] = useState(parcel.status)
  const [note, setNote] = useState('')
  const [pickupId, setPickupId] = useState(parcel.pickup_rider_id || '')
  const [deliveryId, setDeliveryId] = useState(parcel.rider_id || '')
  const [codReceived, setCodReceived] = useState(false)
  const [busy, setBusy] = useState(false)

  const isLocal = (parcel.delivery_type || 'Local') === 'Local'
  const statuses = isLocal ? PARCEL_STATUSES.filter((s) => !LOCAL_SKIP.includes(s)) : PARCEL_STATUSES
  const needsCod = status === 'Delivered' && parcel.status !== 'Delivered' && Number(parcel.cod_amount) > 0
  const unchanged = status === parcel.status && !note && pickupId === (parcel.pickup_rider_id || '') && deliveryId === (parcel.rider_id || '')

  const active = riders.filter((r) => r.status === 'Active')
  // Pickup ke liye head office (hub) shehar ke riders upar, delivery ke liye parcel ke shehar ke
  const sortBy = (city) => (a, b) => (b.city === city) - (a.city === city)

  const riderSelect = (label, value, setValue, current, city) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">Not assigned</option>
        {[...active, ...riders.filter((r) => r.id === current && r.status !== 'Active')].sort(sortBy(city)).map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} · {r.phone}
            {r.city ? ` · ${r.city}` : ''}
            {r.status !== 'Active' ? ' (Inactive)' : ''}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        // Admin ki COD confirmation bhi tracking history mein record ho
        const fullNote = needsCod ? [`COD Rs ${parcel.cod_amount} received`, note.trim()].filter(Boolean).join(' · ') : note
        await onSubmit({ status, note: fullNote, pickupId, deliveryId })
        setBusy(false)
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        <StatusBadge status={parcel.delivery_type || 'Local'} />
        <span>{destination(parcel)}</span>
        <span className="w-full">
          Flow: {isLocal ? 'Booked → Picked → At Head Office → Out for Delivery → Delivered' : 'Booked → Picked → At Head Office → In Transit → Arrived at Destination → Out for Delivery → Delivered'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {riderSelect('Pickup rider (company se)', pickupId, setPickupId, parcel.pickup_rider_id, null)}
        {riderSelect('Delivery rider (customer tak)', deliveryId, setDeliveryId, parcel.rider_id, parcel.city)}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {statuses.map((s) => (
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

      {needsCod && (
        <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${codReceived ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-emerald-600" checked={codReceived} onChange={(e) => setCodReceived(e.target.checked)} />
          <span>
            <span className="block font-medium text-slate-800">Customer se payment receive ho gayi hai</span>
            <span className="text-slate-600">COD amount: {money(parcel.cod_amount)}</span>
          </span>
        </label>
      )}

      <input className="input" maxLength={300} placeholder={`Note (optional), ${NOTE_HINT[status] || 'e.g. Customer ghar par nahi tha'}`} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={unchanged || busy || (needsCod && !codReceived)}>
          {busy ? 'Updating...' : 'Update'}
        </button>
      </div>
    </form>
  )
}

function RiderInfo({ label, rider }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
      <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
        <Bike size={18} />
      </div>
      <div>
        <p className="text-xs uppercase text-slate-400">{label}</p>
        {rider ? (
          <>
            <p className="font-medium text-slate-800">{rider.name}</p>
            <p className="text-slate-500">
              <a href={`tel:${rider.phone}`} className="hover:text-indigo-600">
                {rider.phone}
              </a>
              {rider.vehicle_no && ` · ${rider.vehicle_no}`}
            </p>
          </>
        ) : (
          <p className="text-slate-500">Abhi assign nahi hua</p>
        )}
      </div>
    </div>
  )
}

function ParcelDetail({ parcel, customer, company, pickupRider, deliveryRider }) {
  const history = [...(parcel.history || [])].reverse()
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <RiderInfo label="Pickup rider" rider={pickupRider} />
        <RiderInfo label="Delivery rider" rider={deliveryRider} />
      </div>

      {parcel.cod_received_at && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <Banknote size={18} /> COD {money(parcel.cod_amount)} receive hua: {dateTime(parcel.cod_received_at)}
        </div>
      )}

      <div id="parcel-label" className="rounded-lg border-2 border-dashed border-slate-300 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Tracking ID</p>
            <p className="font-mono text-2xl font-bold tracking-wider">{parcel.tracking_id}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={parcel.delivery_type || 'Local'} />
            <StatusBadge status={parcel.status} />
          </div>
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
            <p className="text-slate-500">{[customer?.address, destination(parcel)].filter(Boolean).join(', ')}</p>
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
