import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Users, Package, Wallet, HandCoins, CheckCircle2, Truck, Banknote } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { ACTIVE_STATUSES } from '../../data/constants'
import { StatCard, PageHeader, Section, StatusBadge } from '../../components/ui'
import { ParcelsBarChart, RevenueAreaChart, StatusDonut } from '../../components/Charts'
import { money, sum, countBy, monthlySeries, isToday, byId, date } from '../../lib/utils'

export default function AdminDashboard() {
  const { companies, customers, parcels, payment_requests, payments } = useStore()

  const stats = useMemo(() => {
    const delivered = parcels.filter((p) => p.status === 'Delivered')
    return {
      revenue: sum(parcels.filter((p) => p.status === 'Delivered' || p.status === 'Returned'), 'delivery_charges'),
      cod: sum(delivered, 'cod_amount'),
      paidOut: sum(payments, 'amount'),
      pendingReqs: payment_requests.filter((r) => r.status === 'Pending'),
      deliveredToday: parcels.filter((p) => p.status === 'Delivered' && p.history?.some((h) => h.status === 'Delivered' && isToday(h.at))).length,
      inTransit: parcels.filter((p) => ACTIVE_STATUSES.includes(p.status) && p.status !== 'Booked').length,
      atHub: parcels.filter((p) => p.status === 'At Head Office').length,
    }
  }, [parcels, payments, payment_requests])

  const series = useMemo(() => monthlySeries(parcels), [parcels])
  const counts = useMemo(() => countBy(parcels, 'status'), [parcels])
  const companyMap = useMemo(() => byId(companies), [companies])

  const topCompanies = useMemo(() => {
    const c = countBy(parcels, 'company_id')
    return companies
      .map((co) => ({ ...co, parcels: c[co.id] || 0 }))
      .sort((a, b) => b.parcels - a.parcels)
      .slice(0, 5)
  }, [companies, parcels])

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" subtitle="Poore system ka overview" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total Companies" value={companies.length} icon={Building2} hint={`${companies.filter((c) => c.status === 'Active').length} active`} />
        <StatCard label="Total Customers" value={customers.length} icon={Users} tone="sky" />
        <StatCard label="Total Parcels" value={parcels.length} icon={Package} tone="slate" hint={`${stats.inTransit} raste mein · ${stats.atHub} head office par`} />
        <StatCard label="Delivered Today" value={stats.deliveredToday} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Revenue (Charges)" value={money(stats.revenue)} icon={Wallet} tone="emerald" />
        <StatCard label="Total COD Collected" value={money(stats.cod)} icon={Banknote} tone="indigo" />
        <StatCard label="Paid to Companies" value={money(stats.paidOut)} icon={Truck} tone="sky" />
        <StatCard label="Pending Requests" value={stats.pendingReqs.length} icon={HandCoins} tone="amber" hint={money(sum(stats.pendingReqs, 'amount'))} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title="Monthly Parcels" className="xl:col-span-2">
          <ParcelsBarChart data={series} />
        </Section>
        <Section title="Delivery Status">
          <StatusDonut counts={counts} />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title="Revenue Trend" className="xl:col-span-2">
          <RevenueAreaChart data={series} />
        </Section>
        <Section title="Top Companies">
          <ul className="space-y-3">
            {topCompanies.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">{c.name[0]}</div>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.city}</p>
                  </div>
                </div>
                <span className="font-semibold">{c.parcels}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Recent Parcels" action={<Link to="/admin/parcels" className="text-sm text-indigo-600 hover:underline">View all</Link>}>
          <ul className="divide-y divide-slate-100">
            {parcels.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-mono font-medium text-indigo-600">{p.tracking_id}</p>
                  <p className="text-xs text-slate-400">
                    {companyMap[p.company_id]?.name} · {p.city}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Payment Requests" action={<Link to="/admin/payment-requests" className="text-sm text-indigo-600 hover:underline">View all</Link>}>
          <ul className="divide-y divide-slate-100">
            {payment_requests.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{companyMap[r.company_id]?.name}</p>
                  <p className="text-xs text-slate-400">{date(r.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{money(r.amount)}</span>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}
