import { useState } from 'react'
import { Phone, MapPin, Store, Package, Undo2, Building2 } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { money, dateTime, byId, receiverOf } from '../lib/utils'
import { Modal, StatusBadge } from './ui'

// Rider ka is parcel par kaam (database ke rider_update_status() jaisa):
//   pickup:   Booked -> Picked, phir head office mein jama (admin confirm karta hai)
//   delivery: At Head Office (Local) / Arrived at Destination -> Out for Delivery -> Delivered / Returned
export function riderTask(parcel, riderId) {
  const isPickup = parcel.pickup_rider_id === riderId
  const isDelivery = parcel.rider_id === riderId
  if (isPickup && parcel.status === 'Booked') return { kind: 'pickup', next: { status: 'Picked', label: 'Parcel Pick Kar Liya' } }
  if (isPickup && parcel.status === 'Picked') return { kind: 'pickup', next: null, hint: 'Parcel head office mein jama karwayein. Office receive karke confirm karega.' }
  if (isDelivery) {
    const ready = parcel.status === 'Arrived at Destination' || (parcel.status === 'At Head Office' && parcel.delivery_type === 'Local')
    if (ready) return { kind: 'delivery', next: { status: 'Out for Delivery', label: 'Delivery Ke Liye Nikla' } }
    if (parcel.status === 'Out for Delivery') return { kind: 'delivery', next: { status: 'Delivered', label: 'Deliver Ho Gaya' }, canReturn: true }
    if (['Booked', 'Picked', 'At Head Office', 'In Transit'].includes(parcel.status)) {
      return { kind: 'delivery', next: null, hint: 'Parcel abhi aap tak nahi pohancha. Pohanchte hi yahan button aa jayega.' }
    }
  }
  return null
}

export default function RiderParcelCard({ parcel }) {
  const { session, customers, companies, riderUpdateStatus, notify } = useStore()
  const [confirm, setConfirm] = useState(null) // { status, label }
  const [note, setNote] = useState('')
  const [codReceived, setCodReceived] = useState(false)
  const [busy, setBusy] = useState(false)

  const receiver = receiverOf(parcel, byId(customers))
  const company = companies.find((c) => c.id === parcel.company_id)
  const task = riderTask(parcel, session.rider_id)
  const lastUpdate = parcel.history?.[parcel.history.length - 1]
  const needsCod = confirm?.status === 'Delivered' && Number(parcel.cod_amount) > 0

  const close = () => {
    setConfirm(null)
    setNote('')
    setCodReceived(false)
  }

  const submit = async () => {
    setBusy(true)
    const ok = await riderUpdateStatus(parcel.id, confirm.status, note, codReceived)
    setBusy(false)
    if (!ok) return
    notify(`${parcel.tracking_id}: ${confirm.status}`)
    close()
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono font-semibold text-indigo-600">{parcel.tracking_id}</p>
            {task && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${task.kind === 'pickup' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {task.kind === 'pickup' ? 'Pickup' : 'Delivery'}
              </span>
            )}
          </div>
          {lastUpdate && <p className="text-xs text-slate-400">Last update: {dateTime(lastUpdate.at)}</p>}
        </div>
        <StatusBadge status={parcel.status} />
      </div>

      <div className="space-y-3 p-4 text-sm">
        {task?.kind === 'pickup' ? (
          <Stop icon={Store} tone="bg-sky-50 text-sky-600" title="Pickup from" name={company?.name} address={company?.address} phone={company?.phone} />
        ) : (
          <Stop icon={Building2} tone="bg-violet-50 text-violet-600" title="Parcel milega" name="Head office / branch" address={parcel.delivery_type === 'Local' ? null : 'Destination branch'} />
        )}
        <Stop
          icon={MapPin}
          tone="bg-emerald-50 text-emerald-600"
          title={task?.kind === 'pickup' ? 'Final destination' : 'Deliver to'}
          name={receiver.name}
          address={[receiver.address, parcel.city, parcel.destination_country !== 'Pakistan' ? parcel.destination_country : null].filter(Boolean).join(', ')}
          landmark={receiver.landmark}
          phone={task?.kind === 'delivery' ? receiver.phone : null}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2">
          <span className="flex items-center gap-2 text-amber-800">
            <Package size={16} /> {parcel.description || 'Parcel'} · {parcel.weight} kg
          </span>
          {task?.kind === 'delivery' && <span className="font-semibold text-amber-900">COD {money(parcel.cod_amount)}</span>}
        </div>

        {task?.hint && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{task.hint}</p>}
      </div>

      {task?.next && (
        <div className="flex gap-2 border-t border-slate-100 p-3">
          <button className="btn-primary flex-1 py-2.5" onClick={() => setConfirm(task.next)}>
            {task.next.label}
          </button>
          {task.canReturn && (
            <button className="btn-secondary py-2.5 text-orange-600" onClick={() => setConfirm({ status: 'Returned', label: 'Return' })}>
              <Undo2 size={16} /> Return
            </button>
          )}
        </div>
      )}

      <Modal open={!!confirm} title={confirm?.status === 'Returned' ? 'Parcel Return' : 'Confirm'} onClose={close} size="sm">
        {confirm && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">
              <span className="font-mono font-medium">{parcel.tracking_id}</span> ka status <StatusBadge status={confirm.status} /> karna hai?
            </p>
            {needsCod && (
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${codReceived ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-emerald-600" checked={codReceived} onChange={(e) => setCodReceived(e.target.checked)} />
                <span>
                  <span className="block font-medium text-slate-800">Maine customer se payment receive kar li hai</span>
                  <span className="text-slate-600">
                    COD amount: <strong>{money(parcel.cod_amount)}</strong>
                  </span>
                </span>
              </label>
            )}
            <textarea
              className="input"
              rows={2}
              maxLength={300}
              placeholder={confirm.status === 'Returned' ? 'Return ki wajah (zaroori), e.g. Customer ne parcel lene se inkaar kiya' : 'Note (optional)'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="form-footer flex justify-end gap-2">
              <button className="btn-secondary" onClick={close}>
                Cancel
              </button>
              <button
                className={confirm.status === 'Returned' ? 'btn-danger' : 'btn-primary'}
                disabled={busy || (confirm.status === 'Returned' && !note.trim()) || (needsCod && !codReceived)}
                onClick={submit}
              >
                {busy ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Stop({ icon: Icon, tone, title, name, address, landmark, phone }) {
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 h-fit rounded-lg p-1.5 ${tone}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase text-slate-400">{title}</p>
        <p className="font-medium text-slate-800">{name || '-'}</p>
        {address && <p className="text-slate-500">{address}</p>}
        {landmark && <p className="text-slate-500">Near: {landmark}</p>}
      </div>
      {phone && (
        <a href={`tel:${phone}`} className="self-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Call">
          <Phone size={16} />
        </a>
      )}
    </div>
  )
}
