import { useMemo, useState } from 'react'
import { useStore } from '../../store/StoreContext'
import { PARCEL_STATUSES } from '../../data/constants'
import { PageHeader, StatusBadge } from '../../components/ui'
import DataTable from '../../components/DataTable'
import RiderParcelCard, { riderTask } from '../../components/RiderParcelCard'
import { money, dateTime, byId } from '../../lib/utils'

export default function RiderParcels() {
  const { session, parcels, customers } = useStore()
  const [tab, setTab] = useState('active')
  const customerMap = useMemo(() => byId(customers), [customers])
  const mine = useMemo(() => parcels.filter((p) => p.rider_id === session.rider_id || p.pickup_rider_id === session.rider_id), [parcels, session.rider_id])
  // Active = jis par rider ka kaam baqi hai; baqi sab history
  const active = mine.filter((p) => riderTask(p, session.rider_id))
  const done = mine.filter((p) => !riderTask(p, session.rider_id))

  const columns = [
    { key: 'tracking_id', label: 'Tracking ID', render: (p) => <span className="font-mono font-medium text-indigo-600">{p.tracking_id}</span> },
    { key: 'customer', label: 'Customer', render: (p) => customerMap[p.customer_id]?.name || '-', csv: (p) => customerMap[p.customer_id]?.name },
    { key: 'city', label: 'City' },
    { key: 'cod_amount', label: 'COD', align: 'right', render: (p) => money(p.cod_amount) },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'finished',
      label: 'Last Update',
      render: (p) => dateTime(p.history?.[p.history.length - 1]?.at),
      csv: (p) => dateTime(p.history?.[p.history.length - 1]?.at),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="My Parcels" subtitle="Aapko assign hue parcels" />

      <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        {[
          ['active', `Active (${active.length})`],
          ['done', `Completed (${done.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-1.5 font-medium transition ${tab === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'active' ? (
        active.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {active.map((p) => (
              <RiderParcelCard key={p.id} parcel={p} />
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center text-sm text-slate-400">Koi active parcel nahi</div>
        )
      ) : (
        <DataTable
          columns={columns}
          rows={done}
          exportName="my-completed-parcels"
          filters={[{ key: 'status', label: 'Status', options: PARCEL_STATUSES }]}
          searchKeys={['tracking_id', 'city', (p) => customerMap[p.customer_id]?.name]}
        />
      )}
    </div>
  )
}
