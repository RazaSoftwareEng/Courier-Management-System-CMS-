import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PackageCheck, Truck, CheckCircle2, Undo2, Banknote, ClipboardList } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { StatCard, PageHeader, Section } from '../../components/ui'
import { ParcelsBarChart } from '../../components/Charts'
import RiderParcelCard, { riderTask } from '../../components/RiderParcelCard'
import { money, riderDayStats, riderWeekSeries } from '../../lib/utils'

export default function RiderDashboard() {
  const { session, parcels } = useStore()
  // RLS ki wajah se rider ko sirf apne parcels milte hain
  const mine = useMemo(() => parcels.filter((p) => p.rider_id === session.rider_id || p.pickup_rider_id === session.rider_id), [parcels, session.rider_id])
  const active = mine.filter((p) => riderTask(p, session.rider_id))
  const today = useMemo(() => riderDayStats(mine, new Date(), session.rider_id), [mine, session.rider_id])
  const week = useMemo(() => riderWeekSeries(mine, session.rider_id), [mine, session.rider_id])

  const pickups = active.filter((p) => riderTask(p, session.rider_id).kind === 'pickup').length
  const deliveries = active.length - pickups

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Assalam o Alaikum, ${session.name}`}
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      >
        <Link to="/rider/report" className="btn-secondary">
          <ClipboardList size={16} /> Daily Report
        </Link>
      </PageHeader>

      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Aaj ka kaam</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Picked Today" value={today.picked.length} icon={PackageCheck} />
          <StatCard label="Delivered Today" value={today.delivered.length} icon={CheckCircle2} tone="emerald" />
          <StatCard label="Returned Today" value={today.returned.length} icon={Undo2} tone="orange" />
          <StatCard label="Cash Collected Today" value={money(today.cashCollected)} icon={Banknote} tone="amber" hint="Office mein jama karwayein" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Pickup jobs" value={pickups} icon={PackageCheck} tone="sky" />
        <StatCard label="Delivery jobs" value={deliveries} icon={Truck} tone="indigo" />
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Active parcels ({active.length})</p>
        {active.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {active.map((p) => (
              <RiderParcelCard key={p.id} parcel={p} />
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center text-sm text-slate-400">Abhi koi parcel assign nahi. Naya parcel assign hote hi yahan aa jayega.</div>
        )}
      </div>

      <Section title="Pichle 7 din">
        <ParcelsBarChart data={week} labels={{ parcels: 'Picked', delivered: 'Delivered' }} />
      </Section>
    </div>
  )
}
