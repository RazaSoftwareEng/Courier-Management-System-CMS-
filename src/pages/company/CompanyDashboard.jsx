import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Package, Clock, Truck, CheckCircle2, Undo2, XCircle, AlertTriangle } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { ACTIVE_STATUSES } from '../../data/constants'
import { StatCard, PageHeader, Section, StatusBadge } from '../../components/ui'
import { ParcelsBarChart, RevenueAreaChart, StatusDonut } from '../../components/Charts'
import { countBy, monthlySeries, byId, receiverOf } from '../../lib/utils'

export default function CompanyDashboard() {
  const store = useStore()
  const { session, companies, parcels, customers, bank_accounts } = store
  const company = companies.find((c) => c.id === session.company_id)

  const own = useMemo(() => parcels.filter((p) => p.company_id === session.company_id), [parcels, session.company_id])
  const counts = useMemo(() => countBy(own, 'status'), [own])
  const series = useMemo(() => monthlySeries(own), [own])
  const customerMap = useMemo(() => byId(customers), [customers])
  const bank = bank_accounts.find((b) => b.company_id === session.company_id)

  const finished = (counts.Delivered || 0) + (counts.Returned || 0)
  const successRate = finished ? Math.round(((counts.Delivered || 0) / finished) * 100) : 0
  // Booked ke baad aur Delivered/Returned se pehle sab raste mein
  const inTransit = ACTIVE_STATUSES.filter((s) => s !== 'Booked').reduce((t, s) => t + (counts[s] || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${company?.owner_name}`} subtitle={`${company?.name} · Dashboard`}>
        <Link to="/company/orders" className="btn-primary">
          <Package size={16} /> Create Parcel
        </Link>
      </PageHeader>

      {!bank && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} />
          Payment lene ke liye apni bank details add karein.
          <Link to="/company/finance/account" className="ml-auto font-medium underline">
            Add Bank
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Parcels" value={own.length} icon={Package} />
        <StatCard label="Booked" value={counts.Booked || 0} icon={Clock} tone="slate" />
        <StatCard label="In Transit" value={inTransit} icon={Truck} tone="sky" />
        <StatCard label="Delivered" value={counts.Delivered || 0} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Returned" value={counts.Returned || 0} icon={Undo2} tone="orange" />
        <StatCard label="Cancelled" value={counts.Cancelled || 0} icon={XCircle} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title="Monthly Parcels" className="xl:col-span-2">
          <ParcelsBarChart data={series} />
        </Section>
        <Section title="Delivery Status">
          <StatusDonut counts={counts} />
          <div className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm">
            <span className="text-slate-600">Delivery success rate: </span>
            <span className="font-semibold text-emerald-700">{successRate}%</span>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title="COD Collection" className="xl:col-span-2">
          <RevenueAreaChart data={series} dataKey="cod" name="COD" />
        </Section>
        <Section title="Recent Orders" action={<Link to="/company/orders" className="text-sm text-indigo-600 hover:underline">View all</Link>}>
          <ul className="divide-y divide-slate-100">
            {own.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-mono font-medium text-indigo-600">{p.tracking_id}</p>
                  <p className="text-xs text-slate-400">
                    {receiverOf(p, customerMap).name} · {p.city}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
            {own.length === 0 && <li className="py-6 text-center text-sm text-slate-400">Abhi koi parcel nahi</li>}
          </ul>
        </Section>
      </div>
    </div>
  )
}
