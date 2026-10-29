import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Trash2, Loader2, BadgeCheck } from 'lucide-react'
import { useStore, friendly } from '../store/StoreContext'
import { supabase } from '../lib/supabase'
import { money, date, byId } from '../lib/utils'
import { downloadStatementSheet } from '../data/statementColumns'
import { fetchStatements, fetchLines, deleteStatement, markStatementPaid } from '../lib/statements'
import { LIMITS } from '../lib/validation'
import { Section, ConfirmDialog, IconButton, Modal, StatusBadge } from './ui'
import EntityForm from './EntityForm'

const METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'JazzCash', 'EasyPaisa']

// Admin ke liye upload hui statements ki list. companyId na ho to sab companies (Company column ke saath).
// refreshKey badalne par (e.g. upload ke baad) list dobara load hoti hai; realtime se bhi khud update.
// onLoaded(list): parent ko statements (e.g. Payments page ka Statement Pending column)
// Mark Paid: payment record banta hai (Add Payment jaisa) aur statement Paid ho jati hai
export default function StatementList({ companyId, title = 'Uploaded Statements', refreshKey, onLoaded }) {
  const { companies, notify, add } = useStore()
  const [paying, setPaying] = useState(null)
  const [list, setList] = useState(null) // null = loading
  const [busy, setBusy] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const companyMap = useMemo(() => byId(companies), [companies])

  const load = useCallback(async () => {
    try {
      const rows = await fetchStatements(companyId || undefined)
      setList(rows)
      onLoaded?.(rows)
    } catch (e) {
      setList([])
      notify(friendly(e), 'error')
    }
  }, [companyId, notify, onLoaded])

  useEffect(() => {
    setList(null)
    load()
  }, [load, refreshKey])

  useEffect(() => {
    const channel = supabase
      .channel(`admin-statements-${companyId || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statements' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [companyId, load])

  const download = async (s) => {
    setBusy(s.id)
    try {
      await downloadStatementSheet({ number: s.statement_number, start: s.period_start, end: s.period_end }, await fetchLines(s.id))
    } catch (e) {
      notify(friendly(e), 'error')
    }
    setBusy(null)
  }

  return (
    <Section title={title} action={list?.length ? <span className="text-sm text-slate-500">{list.length} statements</span> : null}>
      {list === null ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-indigo-600" />
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Abhi koi statement upload nahi hui</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left font-semibold text-slate-700">
                {!companyId && <th className="rounded-l-md px-3 py-2.5">Company</th>}
                <th className={`px-3 py-2.5 ${companyId ? 'rounded-l-md' : ''}`}>Statement No.</th>
                <th className="px-3 py-2.5">Period</th>
                <th className="px-3 py-2.5 text-right">Rows</th>
                <th className="px-3 py-2.5 text-right">COD</th>
                <th className="px-3 py-2.5 text-right">Fees</th>
                <th className="px-3 py-2.5 text-right">Payable</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Uploaded</th>
                <th className="rounded-r-md px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((s) => (
                <tr key={s.id}>
                  {!companyId && <td className="px-3 py-2.5 font-medium">{companyMap[s.company_id]?.name || '-'}</td>}
                  <td className="px-3 py-2.5 font-mono text-xs text-indigo-600">{s.statement_number}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                    {s.period_start} - {s.period_end}
                  </td>
                  <td className="px-3 py-2.5 text-right">{s.line_count}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(s.cod_total)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(s.fees_total)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{money(s.payable_total)}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={s.status || 'Pending'} />
                    {s.paid_at && <span className="block text-[11px] text-slate-400">{date(s.paid_at)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{date(s.updated_at)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-0.5">
                      {(s.status || 'Pending') === 'Pending' && Number(s.payable_total) > 0 && (
                        <IconButton icon={BadgeCheck} title="Mark Paid (payment record karein)" tone="emerald" onClick={() => setPaying(s)} />
                      )}
                      {busy === s.id ? (
                        <Loader2 size={16} className="m-2 animate-spin text-indigo-600" />
                      ) : (
                        <IconButton icon={Download} title="Download (Excel)" onClick={() => download(s)} />
                      )}
                      <IconButton icon={Trash2} title="Delete" tone="rose" onClick={() => setDeleting(s)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!paying} title={`Mark Paid — ${paying?.statement_number || ''}`} onClose={() => setPaying(null)}>
        {paying && (
          <EntityForm
            fields={[
              { name: 'amount', label: 'Amount', type: 'number', required: true, ...LIMITS.amount },
              { name: 'method', label: 'Method', type: 'select', options: METHODS, required: true },
              { name: 'reference', label: 'Reference', required: true, rule: 'reference', full: true },
            ]}
            initial={{ amount: Number(paying.payable_total), method: 'Bank Transfer', reference: paying.statement_number.slice(0, 50) }}
            submitLabel="Mark Paid"
            onCancel={() => setPaying(null)}
            onSubmit={async (v) => {
              // Add Payment jaisa: pehle 'Paid' request, phir payment, phir statement Paid
              const req = await add('payment_requests', { company_id: paying.company_id, amount: v.amount, status: 'Paid', admin_note: `Statement ${paying.statement_number}` })
              const payment = req && (await add('payments', { company_id: paying.company_id, request_id: req.id, ...v }))
              if (!payment) return
              try {
                await markStatementPaid(paying.id, payment.id)
                notify('Statement Paid ho gayi aur payment record ho gayi')
              } catch (e) {
                notify(friendly(e), 'error')
              }
              setPaying(null)
              load()
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={`Statement ${deleting?.statement_number} aur us ki sab rows delete karni hain?`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await deleteStatement(deleting.id)
            notify('Statement delete ho gayi')
            load()
          } catch (e) {
            notify(friendly(e), 'error')
          }
        }}
      />
    </Section>
  )
}
