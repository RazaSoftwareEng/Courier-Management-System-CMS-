import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users, FileText, Banknote, Receipt, Wallet, BadgeCheck, Clock, Hourglass, ArrowRight } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { useStatements } from '../../lib/useStatements'
import { money, date, sum, byId, companyBalances } from '../../lib/utils'
import { StatCard, Section, StatusBadge } from '../../components/ui'
import WelcomeBanner from '../../components/WelcomeBanner'

// Profile mein naam na ho to session.name email hota hai
const displayName = (name) => (!name || name.includes('@') ? 'Super Admin' : name)

const isPending = (s) => (s.status || 'Pending') === 'Pending'

export default function AdminDashboard() {
  const { session, companies, payments } = useStore()
  const statements = useStatements()

  const list = statements || []
  const companyMap = useMemo(() => byId(companies), [companies])
  const balances = useMemo(() => companyBalances(companies, list, payments), [companies, statements, payments]) // eslint-disable-line react-hooks/exhaustive-deps

  const pending = list.filter(isPending)
  const cod = sum(list, 'cod_total')
  const payable = sum(list, 'payable_total')
  const value = (v) => (statements ? v : '...')

  const cards = [
    { label: 'Total Customers', value: companies.length, icon: Users, hint: `${companies.filter((c) => c.status === 'Active').length} active` },
    { label: 'Statements', value: value(list.length), icon: FileText, tone: 'sky', hint: `${pending.length} pending` },
    { label: 'Total COD', value: value(money(cod)), icon: Banknote, tone: 'sky', hint: 'Statements ka COD' },
    { label: 'Fees & Deductions', value: value(money(cod - payable)), icon: Receipt, tone: 'slate', hint: 'COD minus payable' },
    { label: 'Total Payable', value: value(money(payable)), icon: Wallet, hint: 'Sab statements ka' },
    { label: 'Total Paid Out', value: money(sum(payments, 'amount')), icon: BadgeCheck, tone: 'emerald', hint: `${payments.length} payments` },
    { label: 'Pending Payment', value: value(money(sum(pending, 'payable_total'))), icon: Clock, tone: 'amber', hint: 'Abhi dena baqi hai' },
    { label: 'Pending Statements', value: value(pending.length), icon: Hourglass, tone: 'amber', hint: 'Mark Paid baqi' },
  ]

  const viewAll = (
    <Link to="/admin/payments" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
      View all <ArrowRight size={14} />
    </Link>
  )

  return (
    <div className="space-y-6">
      <WelcomeBanner name={displayName(session.name)} subtitle="Aapke payments aur statements ka poora khulasa">
        <Link to="/admin/payments" className="btn bg-white text-indigo-700 hover:bg-indigo-50">
          <Wallet size={16} /> Payments
        </Link>
        <Link to="/admin/customers" className="btn border border-white/30 text-white hover:bg-white/10">
          <Users size={16} /> Customer Profile
        </Link>
      </WelcomeBanner>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((c, i) => (
          <div key={c.label} className="fade-up" style={{ animationDelay: `${(i + 1) * 40}ms` }}>
            <StatCard {...c} />
          </div>
        ))}
      </div>

      <div className="fade-up grid grid-cols-1 gap-6 xl:grid-cols-2" style={{ animationDelay: '380ms' }}>
        <Section title="Customer Balances" action={viewAll}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Customer</th>
                  <th className="py-2 pr-4 text-right font-medium">Payable</th>
                  <th className="py-2 pr-4 text-right font-medium">Paid</th>
                  <th className="py-2 text-right font-medium">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...balances]
                  .sort((a, b) => b.pending - a.pending)
                  .slice(0, 6)
                  .map((b) => (
                    <tr key={b.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-800">{b.name}</td>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-right">{money(b.payable)}</td>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-right">{money(b.paid)}</td>
                      <td className="whitespace-nowrap py-2.5 text-right font-semibold text-slate-900">{money(b.pending)}</td>
                    </tr>
                  ))}
                {balances.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Abhi koi customer nahi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Recent Payments" action={viewAll}>
          <ul className="divide-y divide-slate-100">
            {payments.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{companyMap[p.company_id]?.name || '-'}</p>
                  <p className="truncate text-xs text-slate-400">
                    {date(p.created_at)} · {p.method}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-slate-900">{money(p.amount)}</span>
              </li>
            ))}
            {payments.length === 0 && <li className="py-8 text-center text-sm text-slate-400">Abhi koi payment nahi</li>}
          </ul>
        </Section>

        <Section title="Recent Statements" action={viewAll} className="xl:col-span-2">
          <ul className="divide-y divide-slate-100">
            {[...list]
              .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
              .slice(0, 5)
              .map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-indigo-600">{s.statement_number}</p>
                    <p className="truncate text-xs text-slate-400">
                      {companyMap[s.company_id]?.name || '-'} · {s.period_start} - {s.period_end}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">{money(s.payable_total)}</span>
                    <StatusBadge status={s.status || 'Pending'} />
                  </div>
                </li>
              ))}
            {statements && list.length === 0 && <li className="py-8 text-center text-sm text-slate-400">Abhi koi statement upload nahi hui</li>}
          </ul>
        </Section>
      </div>
    </div>
  )
}
