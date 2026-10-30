import { useMemo, useState, useEffect } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { downloadCsv } from '../lib/utils'

// columns: [{ key, label, render?(row), csv?(row), searchable? }]
// filters: [{ key, label, options: [] }] -> dropdown filters on row[key]
const PAGE_SIZES = [10, 50, 100, 500]

export default function DataTable({ columns, rows, filters = [], searchKeys, exportName, empty = 'Koi record nahi mila', toolbar }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const keys = searchKeys || columns.map((c) => c.key)
    return rows.filter((r) => {
      for (const [k, v] of Object.entries(active)) if (v && String(r[k]) !== v) return false
      if (!q) return true
      return keys.some((k) => String(typeof k === 'function' ? k(r) : r[k] ?? '').toLowerCase().includes(q))
    })
  }, [rows, query, active, columns, searchKeys])

  useEffect(() => setPage(1), [query, active, pageSize])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize)

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {filters.map((f) => (
          <select
            key={f.key}
            className="input w-full sm:w-auto"
            value={active[f.key] || ''}
            onChange={(e) => setActive((a) => ({ ...a, [f.key]: e.target.value }))}
          >
            <option value="">{f.label}: All</option>
            {f.options.map((o) => {
              const opt = typeof o === 'string' ? { value: o, label: o } : o
              return (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              )
            })}
          </select>
        ))}
        <div className="flex gap-2 sm:ml-auto">
          {toolbar}
          {exportName && (
            <button className="btn-secondary" onClick={() => downloadCsv(`${exportName}.csv`, columns.filter((c) => c.key !== 'actions'), filtered)}>
              <Download size={16} /> CSV
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-4 py-3 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td key={c.key} className={`whitespace-nowrap px-4 py-3 ${c.align === 'right' ? 'text-right' : ''}`}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
        <div className="flex items-center gap-3">
          <span>{filtered.length} records</span>
          <label className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Show</span>
            <select
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary px-2 py-1" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            <ChevronLeft size={16} />
          </button>
          <span>
            {current} / {pages}
          </span>
          <button className="btn-secondary px-2 py-1" disabled={current >= pages} onClick={() => setPage(current + 1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
