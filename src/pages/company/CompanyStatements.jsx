import { useMemo, useState, useEffect, useRef } from 'react'
import { Search, Copy, Download, FileText, ChevronDown, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { useStore, friendly } from '../../store/StoreContext'
import { downloadCsv } from '../../lib/utils'
import { Modal } from '../../components/ui'
import StatementLines from '../../components/StatementLines'
import { downloadStatementSheet } from '../../data/statementColumns'
import { fetchStatements, fetchLines } from '../../lib/statements'
import { supabase } from '../../lib/supabase'

// ---------- Statements backend data se ----------
// Net-off: admin ki upload ki hui statements (statements / statement_lines tables)
// Payout: admin ki taraf se company ko ki gayi har payment

const STATEMENT_TYPES = ['Net-off Statement', 'Payout Statement']
const ALL_TYPES = 'All Statements'

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const compact = (d) => ymd(d).replaceAll('-', '')
const uploadedStatement = (u) => ({
  id: `u-${u.id}`,
  uploadedId: u.id,
  type: STATEMENT_TYPES[0],
  start: u.period_start,
  end: u.period_end,
  number: u.statement_number,
  parcels: u.line_count,
  cod: Number(u.cod_total),
  fees: Number(u.fees_total),
  net: Number(u.payable_total),
  status: u.status || 'Pending',
})

// Har payout ka period: pichli payout ke agle din se is payout tak
function payoutStatements(payments, companyId, since) {
  const own = payments.filter((p) => p.company_id === companyId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  let prev = since
  return own
    .map((p, i) => {
      const end = new Date(p.created_at)
      const amount = Number(p.amount) || 0
      const row = {
        id: `p-${p.id}`,
        paymentId: p.id,
        type: STATEMENT_TYPES[1],
        start: ymd(prev && prev <= end ? prev : end),
        end: ymd(end),
        number: `PAYOUT-${compact(end)}-${pad(i + 1)}`,
        method: p.method,
        reference: p.reference,
        fees: amount,
        net: amount,
      }
      prev = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
      return row
    })
    .reverse()
}

const pkr = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// Printable invoice nayi window mein; user "Save as PDF" kar sakta hai
function openInvoice(s, company) {
  const w = window.open('', '_blank', 'width=820,height=900')
  if (!w) return false
  const line = (label, value, bold) =>
    `<tr><td style="padding:8px 0;color:#475569">${label}</td><td style="padding:8px 0;text-align:right;${bold ? 'font-weight:700' : ''}">PKR ${pkr(value)}</td></tr>`
  const text = (label, value) => `<tr><td style="padding:8px 0;color:#475569">${label}</td><td style="padding:8px 0;text-align:right">${esc(value)}</td></tr>`
  const rule = '<tr><td colspan="2" style="border-top:1px solid #e2e8f0"></td></tr>'
  const body = s.method
    ? [text('Payment method', s.method), text('Reference', s.reference || '-'), rule, line('Amount paid', s.net, true)]
    : [
        text('Parcels in statement', s.parcels),
        line('COD collected', s.cod),
        rule,
        line('Total fees', s.fees, true),
        line('Net payable', s.net, true),
      ]
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${s.number}</title></head>
<body style="font-family:system-ui,Segoe UI,sans-serif;color:#0f172a;max-width:720px;margin:40px auto;padding:0 24px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #4f46e5;padding-bottom:16px">
    <div><h1 style="margin:0;color:#4f46e5">INVOICE</h1><p style="margin:4px 0 0;color:#64748b">${s.type}</p></div>
    <div style="text-align:right;font-size:14px"><b>${s.number}</b><br>Period: ${s.start} – ${s.end}<br>Issued: ${new Date().toLocaleDateString('en-GB')}</div>
  </div>
  <p style="margin:24px 0 4px;color:#64748b;font-size:13px">BILLED TO</p>
  <p style="margin:0;font-weight:600">${esc(company?.name)}</p>
  <p style="margin:0;color:#475569">${esc(company?.owner_name)}</p>
  <table style="width:100%;border-collapse:collapse;margin-top:24px;font-size:14px">${body.join('')}</table>
  <p style="margin-top:40px;font-size:12px;color:#94a3b8">Yeh computer-generated invoice hai.</p>
  <script>window.onload = () => window.print()</script>
</body></html>`)
  w.document.close()
  return true
}

function SeeMore({ s }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const lines = s.method
    ? [
        ['Method', s.method, true],
        ['Reference', s.reference || '-', true],
        ['Amount Paid', s.net],
      ]
    : [
        ['Parcels', s.parcels, true],
        ['COD Collected', s.cod],
        ['Total Fees', s.fees],
        ['Net Payable', s.net],
        ['Status', s.status, true],
      ]

  return (
    <div className="relative" ref={ref}>
      <button className="inline-flex items-center gap-1 text-indigo-600 hover:underline" onClick={() => setOpen((v) => !v)}>
        See More <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-4 text-left text-sm shadow-lg">
          {lines.map(([label, value, plain]) => (
            <div key={label} className="flex justify-between gap-3 py-1">
              <span className="text-slate-500">{label}</span>
              <span className="truncate font-medium text-slate-900">{plain ? value : `PKR ${pkr(value)}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Pagination({ total, page, pages, pageSize, setPage, setPageSize }) {
  const base = 'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:text-slate-300'
  const btn = `${base} border-slate-200 bg-white`
  return (
    <div className="flex flex-wrap items-center gap-2 pt-4 text-sm text-slate-600">
      <span>Total {total}</span>
      <select className="h-9 rounded-md border border-slate-200 bg-white px-2" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
        {[10, 20, 50].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button className={btn} disabled={page === 1} onClick={() => setPage(page - 1)}>
        <ChevronLeft size={16} /> Previous
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button key={n} className={n === page ? `${base} border-indigo-600 bg-indigo-600 font-medium text-white` : `${btn} hover:bg-slate-50`} onClick={() => setPage(n)}>
          {n}
        </button>
      ))}
      <button className={btn} disabled={page === pages} onClick={() => setPage(page + 1)}>
        Next <ChevronRight size={16} />
      </button>
    </div>
  )
}

function usePaged(rows) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  useEffect(() => setPage(1), [pageSize])
  return {
    visible: rows.slice((current - 1) * pageSize, current * pageSize),
    pager: { total: rows.length, page: current, pages, pageSize, setPage, setPageSize },
  }
}

const statementColumns = [
  { key: 'period', label: 'Statement Period', csv: (r) => `${r.start} - ${r.end}` },
  { key: 'number', label: 'Statement No.' },
  { key: 'type', label: 'Type' },
  { key: 'parcels', label: 'Parcels' },
  { key: 'cod', label: 'COD Collected' },
  { key: 'fees', label: 'Total' },
  { key: 'net', label: 'Net Payable' },
  { key: 'method', label: 'Method' },
  { key: 'reference', label: 'Reference' },
]

export default function CompanyStatements() {
  const { session, companies, payments, notify } = useStore()
  const company = companies.find((c) => c.id === session.company_id)

  const [uploaded, setUploaded] = useState([])
  // Admin nayi statement upload kare to page khud refresh ho (realtime + tab par wapis aane par)
  useEffect(() => {
    const load = () =>
      fetchStatements(session.company_id)
        .then(setUploaded)
        .catch((e) => notify(friendly(e), 'error'))
    load()
    const channel = supabase
      .channel('company-statements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statements' }, load)
      .subscribe()
    const onFocus = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [session.company_id, notify])

  const statements = useMemo(() => {
    const since = company?.created_at ? new Date(company.created_at) : null
    // Jis payout se koi statement judi ho us ki detail bhi download ho sakti hai
    const payouts = payoutStatements(payments, session.company_id, since).map((p) => ({ ...p, uploadedId: uploaded.find((u) => u.payment_id === p.paymentId)?.id }))
    return [...uploaded.map(uploadedStatement), ...payouts]
  }, [uploaded, payments, session.company_id, company?.created_at])

  const [type, setType] = useState(ALL_TYPES)
  const [viewing, setViewing] = useState(null)
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const isPayout = type === STATEMENT_TYPES[1]
  const isAll = type === ALL_TYPES
  const typeCounts = useMemo(
    () => statements.reduce((acc, s) => ({ ...acc, [s.type]: (acc[s.type] || 0) + 1 }), { [ALL_TYPES]: statements.length }),
    [statements],
  )

  const filtered = useMemo(
    () =>
      statements.filter(
        (s) =>
          (isAll || s.type === type) &&
          (!applied || s.number.toLowerCase().includes(applied.toLowerCase())) &&
          (!from || s.end >= from) &&
          (!to || s.start <= to),
      ),
    [statements, type, applied, from, to],
  )
  const { visible, pager } = usePaged(filtered)

  useEffect(() => pager.setPage(1), [type, applied, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      notify('Statement number copy ho gaya')
    } catch {
      notify('Copy nahi ho saka', 'error')
    }
  }

  const download = async (s) => {
    try {
      await downloadStatementSheet(s, await fetchLines(s.uploadedId))
    } catch (e) {
      notify(friendly(e), 'error')
    }
  }

  const invoice = (s) => {
    if (!openInvoice(s, company)) notify('Popup block ho gaya — browser mein popups allow karein', 'error')
  }

  return (
    <div className="space-y-4">
          <div className="card grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto]">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Statement Type</span>
              <select className="input h-10 font-medium text-slate-900" value={type} onChange={(e) => setType(e.target.value)}>
                {[ALL_TYPES, ...STATEMENT_TYPES].map((t) => (
                  <option key={t} value={t}>
                    {t} ({typeCounts[t] || 0})
                  </option>
                ))}
              </select>
            </label>

            <form
              className="min-w-0"
              onSubmit={(e) => {
                e.preventDefault()
                setApplied(query.trim())
              }}
            >
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="statement-no">
                Statement No.
              </label>
              <div className="relative">
                <input id="statement-no" className="input h-10 pr-10" placeholder="Search number" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600" title="Search">
                  <Search size={16} />
                </button>
              </div>
            </form>

            <div className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Statement Period</span>
              <div className="flex h-10 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-sm transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                <input type="date" aria-label="From" className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span className="text-slate-400">–</span>
                <input type="date" aria-label="To" className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            <button className="btn-secondary h-10 whitespace-nowrap" disabled={filtered.length === 0} onClick={() => downloadCsv('statement-history.csv', statementColumns, filtered)}>
              <Download size={16} /> Export History
            </button>
          </div>

          <div className="card p-4 sm:p-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left font-semibold text-slate-700">
                    <th className="rounded-l-md px-4 py-3">Statement Period</th>
                    <th className="px-4 py-3">Statement No.</th>
                    <th className="px-4 py-3 text-right">{isAll ? 'Amount' : isPayout ? 'Amount Paid' : 'Payable Amount'}</th>
                    <th className="rounded-r-md px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {s.start} - {s.end}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="text-indigo-600">{s.number}</span>
                        <button className="ml-1.5 align-middle text-indigo-500 hover:text-indigo-700" title="Copy" onClick={() => copy(s.number)}>
                          <Copy size={14} />
                        </button>
                        {(isAll || s.status) && (
                          <span className="mt-1 flex items-center gap-1.5">
                            {isAll && (
                              <span className={`w-fit rounded-full px-2 text-[11px] font-medium ${s.method ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                {s.type}
                              </span>
                            )}
                            {s.status && (
                              <span className={`w-fit rounded-full px-2 text-[11px] font-medium ${s.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                                {s.status}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <span className="text-slate-500">PKR</span> <span className="font-semibold text-slate-900">{pkr(s.net)}</span>
                        {isAll && <span className="block text-[11px] text-slate-400">{s.method ? 'Amount Paid' : 'Payable Amount'}</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-4">
                          {s.uploadedId && (
                            <>
                              <button className="text-indigo-600 hover:text-indigo-800" title="Rows dekhein" onClick={() => setViewing(s)}>
                                <Eye size={16} />
                              </button>
                              <button className="text-indigo-600 hover:text-indigo-800" title="Download statement (Excel)" onClick={() => download(s)}>
                                <Download size={16} />
                              </button>
                            </>
                          )}
                          <button
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                            onClick={() => invoice(s)}
                          >
                            <FileText size={14} /> Invoice
                          </button>
                          <SeeMore s={s} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400">
                        {isAll ? 'Koi statement nahi mili' : isPayout ? 'Abhi tak koi payout nahi hua' : 'Abhi tak koi statement upload nahi hui'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination {...pager} />
          </div>

      <Modal open={!!viewing} title={viewing?.number} onClose={() => setViewing(null)} size="xl">
        {viewing && <StatementLines statementId={viewing.uploadedId} />}
      </Modal>
    </div>
  )
}
