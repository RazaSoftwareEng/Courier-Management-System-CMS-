import { useEffect, useMemo, useState } from 'react'
import { Building2, AlertTriangle } from 'lucide-react'
import { useStore, friendly } from '../store/StoreContext'
import { money } from '../lib/utils'
import { STATEMENT_COLUMNS, LINE_COLUMNS, EMPTY, parsePeriod } from '../data/statementColumns'
import { importStatement, fetchStatements } from '../lib/statements'
import BulkImport, { collector, num } from './BulkImport'

// Statement detail ki Excel upload: pehle company select, phir file (statement ke 29 columns).
// Admin Statements page aur Payments ke Import Excel dono yahi use karte hain.
const MAX_ROWS = 20000

const SAMPLE_ROWS = [
    ['ST-2026-00441', '2026-10-26 - 2026-10-28', 'CCM100004', 'CCM100004', 'Lahore Head Office', 'Domestic', 'ORD-1001', '', '2026-10-26 11:20', '2026-10-28 16:05', 'Babar Ali', '03001234567', 'Sindh', '30x20x10_1', '30x20x10_1.2', 'COD', 'Delivered', 2500, 25, 0, 250, 0, 0, 0, 0, 0, 0, 2225, ''],
    ['ST-2026-00441', '2026-10-26 - 2026-10-28', 'CCM100005', 'CCM100005', 'Lahore Head Office', 'Local', 'ORD-1002', '', '2026-10-27 09:45', '2026-10-28 13:30', 'Ayesha Khan', '03219876543', 'Punjab', '20x15x10_0.5', '20x15x10_0.6', 'COD', 'Returned', 0, 0, 0, 0, 0, 200, 0, 0, 0, 0, -200, 'Customer refused'],
]

const NOTES = [
  ['Statement Number', 'Yes', 'Ek statement ki sab rows mein same number. Dobara upload karne par purana statement replace ho jata hai'],
  ['Statement Period', 'Yes', 'Start - End, jaise 2026-10-26 - 2026-10-28 (ya 26/10/2026 - 28/10/2026)'],
  ['Tracking No.', 'Yes', 'Parcel ka tracking number'],
  ['Dead Weight / Billing Weight', 'No', 'Format: pkg length x height x width (cm)_weight (kg), jaise 30x20x10_1.5'],
  ['COD Amount / Fees / Taxes / Payable Amount', 'No', 'Number. Khali chhorein to 0 (Payable minus ho sakti hai)'],
  ['Baqi sab', 'No', 'Text jaisa likha ho waisa save hota hai. Khali chhorein to N/A'],
]

const TEXT_MAX = 200

// Excel number ki tarah save hua phone (3001234567) shuru ka 0 kho deta hai
const fixPhone = (v) => (/^3\d{9}$/.test(v) ? `0${v}` : v)
const orNA = (v) => v || EMPTY

// Sheet ke columns bilkul statement format ki tarteeb mein; company upar select se aati hai.
// errors: row pehchani nahi ja sakti (number / period / tracking) -> row skip
// warnings: sirf woh field skip (ghalat number = 0, lamba text kat jata hai), baqi row save hoti hai
function validateLine(raw) {
  const { errors } = collector()
  const warnings = []
  const period = parsePeriod(raw.statement_period)
  if (!raw.statement_number) errors.push('Statement Number khali hai — row skip')
  else if (raw.statement_number.length > 60) errors.push('Statement Number 60 characters se lamba — row skip')
  if (!raw.statement_period) errors.push('Statement Period khali hai — row skip')
  else if (!period) errors.push('Statement Period "2026-10-26 - 2026-10-28" format mein nahi — row skip')

  const line = {}
  LINE_COLUMNS.forEach((c) => {
    const v = raw[c.key]
    if (c.type === 'number') {
      // Khali = 0
      if (v === '') {
        line[c.key] = 0
        return
      }
      const n = Number(num(v))
      if (!Number.isFinite(n)) warnings.push(`${c.label}: "${v}" number nahi — 0 save hoga`)
      line[c.key] = Number.isFinite(n) ? n : 0
    } else {
      if (!v && c.required) errors.push(`${c.label} zaroori hai — row skip`)
      let text = c.key === 'buyer_phone' ? fixPhone(v) : v
      if (text.length > TEXT_MAX) {
        warnings.push(`${c.label}: ${TEXT_MAX} characters se lamba — kaat diya gaya`)
        text = text.slice(0, TEXT_MAX)
      }
      // Khali text database mein null; download / preview mein N/A
      line[c.key] = text || null
    }
  })
  return { payload: { number: raw.statement_number, start: period?.[0], end: period?.[1], line }, errors, warnings }
}

const PREVIEW = [
  { label: 'Statement', render: (r) => <span className="font-mono text-xs">{r.raw.statement_number || '-'}</span> },
  { label: 'Period', render: (r) => <span className="whitespace-nowrap">{r.raw.statement_period || '-'}</span> },
  { label: 'Tracking No.', render: (r) => <span className="font-mono text-xs">{r.raw.tracking_no || '-'}</span> },
  { label: 'Buyer', render: (r) => orNA(r.raw.buyer_name) },
  { label: 'Status', render: (r) => orNA(r.raw.final_status) },
  { label: 'COD', align: 'right', render: (r) => <span className="whitespace-nowrap">{money(num(r.raw.cod_amount))}</span> },
  { label: 'Payable', align: 'right', render: (r) => <span className="whitespace-nowrap">{money(num(r.raw.payable_amount))}</span> },
]

// Ek statement number ki sab rows ek saath save (transaction)
async function saveStatements(companyId, rows) {
  const groups = new Map()
  rows.forEach((r, i) => {
    const g = groups.get(r.payload.number) || []
    g.push(i)
    groups.set(r.payload.number, g)
  })
  const results = new Array(rows.length)
  for (const [number, idx] of groups) {
    // Rows mein period alag ho to bhi statement save hoti hai — pehli row ka period lagta hai
    const first = rows[idx[0]].payload
    try {
      await importStatement(companyId, first, idx.map((i) => rows[i].payload.line))
      idx.forEach((i) => (results[i] = { ok: true, label: number }))
    } catch (e) {
      idx.forEach((i) => (results[i] = { ok: false, error: friendly(e) }))
    }
  }
  return results
}

// Ek statement mein same Tracking No. dobara ho to error (aksar Excel mein row neeche drag hone se)
function markDuplicates(rows) {
  const seen = new Map()
  return rows.map((r) => {
    if (r.errors.length || !r.raw.tracking_no) return r
    const key = `${r.raw.statement_number}|${r.raw.tracking_no}`
    if (!seen.has(key)) {
      seen.set(key, r.line)
      return r
    }
    return { ...r, errors: [...r.errors, `Tracking No. ${r.raw.tracking_no} is statement mein row ${seen.get(key)} par pehle se hai — duplicate skip`] }
  })
}

// File mein kaunsi statements hain, aur kaunsi pehle se upload ho chuki hain (replace hongi)
function FileSummary({ rows, existing, company, companies }) {
  const groups = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => {
      const n = r.raw.statement_number || '(no number)'
      const g = m.get(n) || { rows: 0, tracking: new Set() }
      g.rows++
      if (r.raw.tracking_no) g.tracking.add(r.raw.tracking_no)
      m.set(n, g)
    })
    return [...m]
  }, [rows])
  // existing: sab companies ki statements; same number doosri company mein ho to aksar ghalat company select hoti hai
  const byNumber = useMemo(() => Object.fromEntries(existing.filter((s) => s.company_id === company.id).map((s) => [s.statement_number, s])), [existing, company.id])
  const elsewhere = useMemo(() => Object.fromEntries(existing.filter((s) => s.company_id !== company.id).map((s) => [s.statement_number, s])), [existing, company.id])

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="mb-2 flex items-center gap-2 font-medium text-slate-900">
        <Building2 size={15} className="text-indigo-600" /> Ye file <span className="text-indigo-700">{company.name}</span> ke account mein save hogi
      </p>
      <p className="mb-2 font-medium text-slate-700">File mein {groups.length} statement(s):</p>
      <ul className="space-y-1">
        {groups.map(([number, g]) => {
          const old = byNumber[number]
          const other = elsewhere[number]
          return (
            <li key={number} className="flex flex-wrap items-center gap-x-2">
              <span className="font-mono text-xs text-indigo-600">{number}</span>
              <span className="text-slate-500">
                · {g.rows} rows · {g.tracking.size} alag tracking no.
              </span>
              {old && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertTriangle size={13} /> pehle se upload hai ({old.line_count} rows) — save karne par replace ho jayegi
                </span>
              )}
              {other && (
                <span className="inline-flex items-center gap-1 font-medium text-rose-700">
                  <AlertTriangle size={13} /> ye statement {companies.find((c) => c.id === other.company_id)?.name || 'doosri company'} mein pehle se hai — company check karein
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function StatementImport({ companyId, onCompanyChange, onDone }) {
  const [existing, setExisting] = useState([])
  useEffect(() => {
    fetchStatements().then(setExisting).catch(() => {})
  }, [])

  const { companies } = useStore()
  const company = companies.find((c) => c.id === companyId)

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-3 p-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
          <Building2 size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Pehle company select karein</p>
          <p className="text-sm text-slate-500">Jis company ki file upload karni hai. File ki sab rows isi company ke liye save hongi.</p>
        </div>
        <select className="input w-full sm:w-72" value={companyId} onChange={(e) => onCompanyChange(e.target.value)}>
          <option value="">Select company...</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <BulkImport
        key={companyId}
        noun="rows"
        columns={STATEMENT_COLUMNS}
        markRequired={false}
        sheetName="Statement"
        template={{
          filename: company ? `${company.name.replace(/[^\w-]+/g, '-')}-statement-sample.xlsx` : 'statement-sample.xlsx',
          sampleRows: SAMPLE_ROWS,
        }}
        notes={NOTES}
        maxRows={MAX_ROWS}
        disabled={!company}
        hint="Pehle upar se company select karein"
        disableSample={!company}
        validate={validateLine}
        saveAll={(rows) => saveStatements(companyId, rows)}
        saveTo={company?.name.trim()}
        preview={PREVIEW}
        checkRows={markDuplicates}
        summary={(rows) => <FileSummary rows={rows} existing={existing} company={company} companies={companies} />}
        onDone={(saved, failed) => {
          fetchStatements().then(setExisting).catch(() => {})
          onDone?.(saved, failed)
        }}
      />
    </div>
  )
}
