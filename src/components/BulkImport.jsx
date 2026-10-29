import { useMemo, useRef, useState } from 'react'
import { Download, UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Section } from './ui'

export const MAX_ROWS = 500

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '')

// Validation errors ke aage field ka naam (agar pehle se na ho)
export function collector() {
  const errors = []
  const take = (res, label) => {
    if (res.error) errors.push(res.error.includes(label) ? res.error : `${label}: ${res.error}`)
    return res.value
  }
  return { errors, take }
}

export const num = (v) => String(v ?? '').replace(/,/g, '')

// columns: [{ key, label, required?, width?, aliases?, text? }]  (text: Excel mein text format, jaise phone)
// notes: Instructions sheet ki rows [[column, required, note], ...]
async function downloadTemplate({ filename, sheetName, columns, sampleRows, notes, markRequired = true }) {
  const XLSX = await import('xlsx')
  const header = columns.map((c) => (c.required && markRequired ? `${c.label} *` : c.label))
  const sheet = XLSX.utils.aoa_to_sheet([header, ...sampleRows])
  sheet['!cols'] = columns.map((c) => ({ wch: c.width || 16 }))
  columns.forEach((c, ci) => {
    if (!c.text) return
    for (let r = 1; r <= sampleRows.length; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: ci })]
      if (cell) Object.assign(cell, { t: 's', z: '@' })
    }
  })

  const help = XLSX.utils.aoa_to_sheet([
    ['Column', 'Required', 'Notes'],
    ...notes,
    [],
    ['', '', 'Sample rows delete karke apna data likhein.'],
  ])
  help['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 70 }]

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, sheetName)
  XLSX.utils.book_append_sheet(book, help, 'Instructions')
  XLSX.writeFile(book, filename)
}

async function readSheet(file, columns, sheetName) {
  const XLSX = await import('xlsx')
  const book = XLSX.read(await file.arrayBuffer())
  const sheet = book.Sheets[book.SheetNames.includes(sheetName) ? sheetName : book.SheetNames[0]]
  const [header = [], ...body] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false })

  const index = {}
  header.forEach((h, i) => {
    const n = norm(h)
    const col = columns.find((c) => norm(c.label) === n || norm(c.key) === n || (c.aliases || []).some((a) => norm(a) === n))
    if (col && index[col.key] === undefined) index[col.key] = i
  })
  const missing = columns.filter((c) => c.required && index[c.key] === undefined).map((c) => c.label)

  const rows = body
    .map((cells, i) => ({ line: i + 2, raw: Object.fromEntries(columns.map((c) => [c.key, String(cells[index[c.key]] ?? '').trim()])) }))
    .filter((r) => Object.values(r.raw).some(Boolean))
  return { missing, rows }
}

// Excel se bulk import: sample download -> file upload -> har row check -> sahi rows save
// validate(raw) -> { payload, errors }
// create(payload, onError) -> label (jaise tracking ID) ya null agar fail
// saveAll(rows) -> [{ ok, label } | { ok: false, error }] har row ke liye (create ki jagah, ek saath save)
// preview: [{ label, align?, render(row) }]  row = { raw, payload, errors }
// checkRows(rows) -> rows: poori file par check (jaise duplicate rows); summary(rows) -> preview ke upar note
// validate warnings bhi de sakta hai: row save hoti hai, sirf woh field skip (orange note); errors wali row skip hoti hai
const PREVIEW_LIMIT = 300

export default function BulkImport({ noun, columns, sheetName, template, notes, validate, create, saveAll, preview, onDone, maxRows = MAX_ROWS, disabled, hint, disableSample, markRequired, checkRows, summary }) {
  const { notify } = useStore()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([]) // { line, raw, payload, errors, result? }
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(null) // { done, total }

  const valid = useMemo(() => rows.filter((r) => !r.errors.length && !r.result?.ok), [rows])
  const invalid = rows.filter((r) => r.errors.length).length
  const created = rows.filter((r) => r.result?.ok).length
  const failed = rows.filter((r) => r.result && !r.result.ok).length

  const reset = () => {
    setFile(null)
    setRows([])
    if (inputRef.current) inputRef.current.value = ''
  }

  const load = async (f) => {
    if (!f) return
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return notify('Sirf .xlsx, .xls ya .csv file upload karein', 'error')
    setReading(true)
    try {
      const { missing, rows: parsed } = await readSheet(f, columns, sheetName)
      if (missing.length) return notify(`Sheet mein ye columns nahi mile: ${missing.join(', ')}. Sample file use karein.`, 'error')
      if (!parsed.length) return notify(`Sheet mein koi ${noun} nahi mila`, 'error')
      if (parsed.length > maxRows) return notify(`Ek file mein zyada se zyada ${maxRows} rows`, 'error')
      setFile(f)
      const checked = parsed.map((r) => ({ ...r, ...validate(r.raw) }))
      setRows(checkRows ? checkRows(checked) : checked)
    } catch {
      notify('File parhi nahi ja saki — sahi Excel file select karein', 'error')
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // Ek ek karke save hote hain taake har row ka nateeja alag dikhe
  const upload = async () => {
    const queue = valid
    setUploading({ done: 0, total: queue.length })
    let ok = 0
    if (saveAll) {
      const results = await saveAll(queue)
      const byLine = new Map(queue.map((row, i) => [row.line, results[i]]))
      ok = results.filter((r) => r.ok).length
      setRows((all) => all.map((r) => (byLine.has(r.line) ? { ...r, result: byLine.get(r.line) } : r)))
      setUploading(null)
      notify(`${ok} ${noun} save ho gaye${ok < queue.length ? `, ${queue.length - ok} fail` : ''}${invalid ? `, ${invalid} skip` : ''}`, ok < queue.length ? 'error' : undefined)
      if (ok && onDone) onDone(ok)
      return
    }
    for (const [i, row] of queue.entries()) {
      let error = 'Save nahi hua'
      const label = await create(row.payload, (msg) => (error = msg))
      if (label) ok++
      setRows((all) => all.map((r) => (r.line === row.line ? { ...r, result: label ? { ok: true, label } : { ok: false, error } } : r)))
      setUploading({ done: i + 1, total: queue.length })
    }
    setUploading(null)
    notify(`${ok} ${noun} save ho gaye${ok < queue.length ? `, ${queue.length - ok} fail` : ''}${invalid ? `, ${invalid} skip` : ''}`, ok < queue.length ? 'error' : undefined)
    if (ok && onDone) onDone(ok)
  }

  const retrying = rows.some((r) => r.result && !r.result.ok)
  const warned = rows.filter((r) => !r.errors.length && r.warnings?.length).length
  // Bari file mein pehle ghalat rows, aur sirf pehli PREVIEW_LIMIT rows dikhayi jati hain
  const shown = useMemo(() => {
    const bad = (r) => r.errors.length || (r.result && !r.result.ok)
    return (rows.length > PREVIEW_LIMIT ? [...rows].sort((a, b) => !!bad(b) - !!bad(a)) : rows).slice(0, PREVIEW_LIMIT)
  }, [rows])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card flex items-start gap-4 p-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">1</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Sample file download karein</p>
            <p className="mt-1 text-sm text-slate-500">Sample sheet mein apna data likhein. Har row ek {noun} hai; zaroori columns Instructions sheet mein likhe hain.</p>
            <button
              className="btn-secondary mt-3"
              disabled={disableSample}
              title={disableSample ? hint : undefined}
              onClick={() => downloadTemplate({ ...template, sheetName, columns, notes, markRequired }).catch(() => notify('Sample file nahi ban saki', 'error'))}
            >
              <Download size={16} /> Download Sample (.xlsx)
            </button>
          </div>
        </div>
        <div className="card flex items-start gap-4 p-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">2</span>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Bhari hui file upload karein, phir "Save" dabayein</p>
            <p className="mt-1 text-sm text-slate-500">Upload se pehle har row check hogi. Sirf sahi rows save hongi, ghalat rows ki wajah neeche nazar aayegi.</p>
          </div>
        </div>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) load(e.dataTransfer.files?.[0])
        }}
        className={`card flex flex-col items-center justify-center border-2 border-dashed p-8 text-center transition ${disabled ? 'cursor-not-allowed border-slate-200 opacity-60' : dragging ? 'cursor-pointer border-indigo-500 bg-indigo-50' : 'cursor-pointer border-slate-300 hover:border-indigo-400'}`}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={disabled || reading || !!uploading} onChange={(e) => load(e.target.files?.[0])} />
        {reading ? <Loader2 size={36} className="animate-spin text-indigo-600" /> : <UploadCloud size={36} className="text-indigo-500" />}
        <p className="mt-3 font-medium text-slate-800">{reading ? 'File check ho rahi hai...' : disabled ? hint : 'File yahan drop karein ya click karke select karein'}</p>
        <p className="mt-1 text-xs text-slate-400">.xlsx, .xls ya .csv · zyada se zyada {maxRows.toLocaleString()} rows</p>
      </label>

      {file && (
        <Section
          title={
            <span className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-600" /> {file.name}
            </span>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-secondary" onClick={reset} disabled={!!uploading}>
                <Trash2 size={16} /> Clear
              </button>
              <button className="btn-primary" onClick={upload} disabled={!valid.length || !!uploading}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                {uploading ? `Saving ${uploading.done}/${uploading.total}...` : `${retrying ? 'Retry' : 'Save'} ${valid.length} ${noun}`}
              </button>
            </div>
          }
        >
          {summary?.(rows)}
          {invalid > 0 && !created && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                {invalid} row(s) skip hongi (wajah neeche likhi hai). Baqi {valid.length} rows save hongi.
              </span>
            </div>
          )}
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Total rows: {rows.length}</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Ready: {valid.length}</span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">Skipped: {invalid}</span>
            {warned > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Fields skipped: {warned} rows</span>}
            {failed > 0 && <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">Failed: {failed}</span>}
            {created > 0 && <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">Saved: {created}</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left font-semibold text-slate-700">
                  <th className="rounded-l-md px-3 py-2.5">Row</th>
                  {preview.map((c) => (
                    <th key={c.label} className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right' : ''}`}>
                      {c.label}
                    </th>
                  ))}
                  <th className="rounded-r-md px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((r) => (
                  <tr key={r.line} className={r.errors.length || (r.result && !r.result.ok) ? 'bg-rose-50/40' : ''}>
                    <td className="px-3 py-2.5 text-slate-400">{r.line}</td>
                    {preview.map((c) => (
                      <td key={c.label} className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right' : ''}`}>
                        {c.render(r)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      {r.result?.ok ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={15} /> <span className="font-mono">{r.result.label}</span>
                        </span>
                      ) : r.result || r.errors.length ? (
                        <ul className="space-y-0.5 text-xs text-rose-600">
                          {(r.result ? [r.result.error] : r.errors).map((e) => (
                            <li key={e} className="flex items-start gap-1">
                              <XCircle size={13} className="mt-0.5 shrink-0" /> {e}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={15} /> Ready
                        </span>
                      )}
                      {!r.errors.length && r.warnings?.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                          {r.warnings.map((w) => (
                            <li key={w} className="flex items-start gap-1">
                              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > shown.length && (
            <p className="mt-3 text-xs text-slate-400">
              Pehli {shown.length} rows dikh rahi hain (ghalat rows sab se upar) — total {rows.length}
            </p>
          )}
        </Section>
      )}
    </div>
  )
}
