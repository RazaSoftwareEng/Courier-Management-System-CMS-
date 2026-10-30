export const money = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`

export const date = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export const sum = (rows, key) => rows.reduce((t, r) => t + (Number(typeof key === 'function' ? key(r) : r[key]) || 0), 0)

export const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]))

// Har company ka hisaab: upload hui statements ka payable, ki gayi payments, aur baqi statements
export const companyBalances = (companies, statements, payments) =>
  companies.map((c) => {
    const own = statements.filter((s) => s.company_id === c.id)
    return {
      id: c.id,
      name: c.name,
      statements: own.length,
      payable: sum(own, 'payable_total'),
      pending: sum(own.filter((s) => (s.status || 'Pending') === 'Pending'), 'payable_total'),
      paid: sum(payments.filter((p) => p.company_id === c.id), 'amount'),
    }
  })

export function downloadCsv(filename, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [columns.map((c) => esc(c.label)).join(',')]
  rows.forEach((r) => lines.push(columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(',')))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// Har role ka home page
export const homeFor = (role) => ({ admin: '/admin', company: '/company' })[role] || '/login'
