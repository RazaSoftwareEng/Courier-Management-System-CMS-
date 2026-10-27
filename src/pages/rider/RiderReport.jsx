import { useMemo, useState } from 'react'
import { PackageCheck, CheckCircle2, Undo2, Banknote, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { PageHeader, StatCard, Section, StatusBadge } from '../../components/ui'
import { money, dateTime, byId, riderDayStats } from '../../lib/utils'

const toInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Rider ki kisi bhi din ki working: kya pick kiya, kya deliver/return hua, kitna cash aaya
export default function RiderReport({ riderId }) {
  const { session, parcels, customers } = useStore()
  const id = riderId || session.rider_id
  const [day, setDay] = useState(() => toInput(new Date()))
  const customerMap = useMemo(() => byId(customers), [customers])
  const mine = useMemo(() => parcels.filter((p) => p.rider_id === id || p.pickup_rider_id === id), [parcels, id])

  const date = new Date(`${day}T12:00:00`)
  const stats = useMemo(() => riderDayStats(mine, new Date(`${day}T12:00:00`), id), [mine, day, id])
  const isToday = day === toInput(new Date())

  const shift = (n) => {
    const d = new Date(`${day}T12:00:00`)
    d.setDate(d.getDate() + n)
    setDay(toInput(d))
  }

  // Us din ki saari entries (tracking history) waqt ke hisaab se
  const timeline = useMemo(() => {
    const key = new Date(`${day}T12:00:00`).toDateString()
    return stats.touched
      .flatMap((p) => (p.history || []).filter((h) => new Date(h.at).toDateString() === key).map((h) => ({ ...h, parcel: p })))
      .sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [stats, day])

  return (
    <div className="space-y-6">
      <PageHeader title="Daily Report" subtitle="Roz ki working ka hisaab">
        <div className="flex items-center gap-2">
          <button className="btn-secondary px-2.5" onClick={() => shift(-1)} title="Pichla din">
            <ChevronLeft size={16} />
          </button>
          <input type="date" className="input w-auto" value={day} max={toInput(new Date())} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <button className="btn-secondary px-2.5" onClick={() => shift(1)} disabled={isToday} title="Agla din">
            <ChevronRight size={16} />
          </button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Picked" value={stats.picked.length} icon={PackageCheck} />
        <StatCard label="Delivered" value={stats.delivered.length} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Returned" value={stats.returned.length} icon={Undo2} tone="orange" />
        <StatCard label="Cash Collected" value={money(stats.cashCollected)} icon={Banknote} tone="amber" />
      </div>

      <Section title={`Delivered parcels: ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}>
        {stats.delivered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Tracking</th>
                  <th className="py-2 pr-4 font-medium">Customer</th>
                  <th className="py-2 pr-4 font-medium">City</th>
                  <th className="py-2 text-right font-medium">COD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.delivered.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-indigo-600">{p.tracking_id}</td>
                    <td className="whitespace-nowrap py-2 pr-4">{customerMap[p.customer_id]?.name || '-'}</td>
                    <td className="whitespace-nowrap py-2 pr-4">{p.city}</td>
                    <td className="whitespace-nowrap py-2 text-right font-medium">{money(p.cod_amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={3} className="py-2 pr-4">
                    Total cash
                  </td>
                  <td className="py-2 text-right text-emerald-700">{money(stats.cashCollected)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">Is din koi parcel deliver nahi hua</p>
        )}
      </Section>

      <Section title="Activity">
        {timeline.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {timeline.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <span className="font-mono text-indigo-600">{h.parcel.tracking_id}</span>
                  <span className="text-slate-400"> · {dateTime(h.at)}</span>
                  {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                </div>
                <StatusBadge status={h.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">Is din koi activity nahi</p>
        )}
      </Section>
    </div>
  )
}
