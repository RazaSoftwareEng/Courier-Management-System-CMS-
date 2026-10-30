import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Package, Banknote, Receipt, Wallet, BadgeCheck, Clock, Hourglass, ArrowRight, Landmark, AlertTriangle } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { useStatements } from '../../lib/useStatements'
import { money, date, sum } from '../../lib/utils'
import { StatCard, Section, StatusBadge } from '../../components/ui'
import WelcomeBanner from '../../components/WelcomeBanner'

const isPending = (s) => (s.status || 'Pending') === 'Pending'

export default function CompanyDashboard() {
  const { session, companies, payments, bank_accounts } = useStore()
  const statements = useStatements(session.company_id)
  const company = companies.find((c) => c.id === session.company_id)

  const list = statements || []
  const own = useMemo(() => payments.filter((p) => p.company_id === session.company_id), [payments, session.company_id])
  const hasBank = bank_accounts.some((b) => b.company_id === session.company_id)

  const pending = list.filter(isPending)
  const cod = sum(list, 'cod_total')
  const payable = sum(list, 'payable_total')
  const value = (v) => (statements ? v : '...')

  const cards = [
    { label: 'Statements', value: value(list.length), icon: FileText, hint: `${pending.length} pending` },
    { label: 'Total Parcels', value: value(sum(list, 'line_count')), icon: Package, tone: 'sky', hint: 'Statements mein' },
    { label: 'Total COD', value: value(money(cod)), icon: Banknote, tone: 'sky', hint: 'Statements ka COD' },
    { label: 'Fees & Deductions', value: value(money(cod - payable)), icon: Receipt, tone: 'slate', hint: 'COD minus payable' },
    { label: 'Total Payable', value: value(money(payable)), icon: Wallet, hint: 'Sab statements ka' },
    { label: 'Total Received', value: money(sum(own, 'amount')), icon: BadgeCheck, tone: 'emerald', hint: `${own.length} payments` },
    { label: 'Pending Payment', value: value(money(sum(pending, 'payable_total'))), icon: Clock, tone: 'amber', hint: 'Abhi milna baqi hai' },
    { label: 'Pending Statements', value: value(pending.length), icon: Hourglass, tone: 'amber', hint: 'Payment ka intezar' },
  ]

  const viewAll = (
    <Link to="/company/finance/statements" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
      View all <ArrowRight size={14} />
    </Link>
  )

  return (
    <div className="space-y-6">
      <WelcomeBanner name={company?.owner_name || session.name} subtitle={`${company?.name?.trim() || ''}: aapke statements aur payments ka khulasa`}>
        <Link to="/company/finance/statements" className="btn bg-white text-indigo-700 hover:bg-indigo-50">
          <FileText size={16} /> My Statements
        </Link>
        <Link to="/company/finance/account" className="btn border border-white/30 text-white hover:bg-white/10">
          <Landmark size={16} /> Account Details
        </Link>
      </WelcomeBanner>

      {!hasBank && (
        <div className="fade-up flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0" />
          Payment lene ke liye apni bank details add karein.
          <Link to="/company/finance/account" className="font-medium underline sm:ml-auto">
            Add Bank
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((c, i) => (
          <div key={c.label} className="fade-up" style={{ animationDelay: `${(i + 1) * 40}ms` }}>
            <StatCard {...c} />
          </div>
        ))}
      </div>

      <div className="fade-up grid grid-cols-1 gap-6 xl:grid-cols-2" style={{ animationDelay: '380ms' }}>
        <Section title="Recent Statements" action={viewAll}>
          <ul className="divide-y divide-slate-100">
            {[...list]
              .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
              .slice(0, 6)
              .map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-indigo-600">{s.statement_number}</p>
                    <p className="truncate text-xs text-slate-400">
                      {s.period_start} - {s.period_end}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">{money(s.payable_total)}</span>
                    <StatusBadge status={s.status || 'Pending'} />
                  </div>
                </li>
              ))}
            {statements && list.length === 0 && <li className="py-8 text-center text-sm text-slate-400">Abhi tak koi statement nahi aayi</li>}
          </ul>
        </Section>

        <Section title="Recent Payments" action={viewAll}>
          <ul className="divide-y divide-slate-100">
            {own.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{p.method}</p>
                  <p className="truncate text-xs text-slate-400">
                    {date(p.created_at)} · {p.reference || '-'}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-slate-900">{money(p.amount)}</span>
              </li>
            ))}
            {own.length === 0 && <li className="py-8 text-center text-sm text-slate-400">Abhi tak koi payment nahi mili</li>}
          </ul>
        </Section>
      </div>
    </div>
  )
}
