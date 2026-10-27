export const money = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`

export const date = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export const dateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '-'

export const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString()

export const sum = (rows, key) => rows.reduce((t, r) => t + (Number(typeof key === 'function' ? key(r) : r[key]) || 0), 0)

export const countBy = (rows, key) =>
  rows.reduce((acc, r) => {
    acc[r[key]] = (acc[r[key]] || 0) + 1
    return acc
  }, {})

export const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]))

export const trackingId = () => `CCM${Math.floor(100000 + Math.random() * 900000)}`

// Company ka hisaab: delivered parcels ka COD minus charges/commission, returned par charges cut,
// aur jo requests Pending/Approved/Paid hain woh balance se nikal jati hain.
export function companyLedger(companyId, { parcels, payment_requests, settings }) {
  const own = parcels.filter((p) => p.company_id === companyId)
  const delivered = own.filter((p) => p.status === 'Delivered')
  const returned = own.filter((p) => p.status === 'Returned')
  const commission = (settings?.commission_percent || 0) / 100

  const totalCod = sum(delivered, 'cod_amount')
  const charges = sum(delivered, 'delivery_charges') + sum(returned, 'delivery_charges')
  const commissionAmount = totalCod * commission
  const earned = totalCod - charges - commissionAmount

  const reqs = payment_requests.filter((r) => r.company_id === companyId)
  const paid = sum(reqs.filter((r) => r.status === 'Paid'), 'amount')
  const pending = sum(reqs.filter((r) => r.status === 'Pending' || r.status === 'Approved'), 'amount')

  return { totalCod, charges, commissionAmount, earned, paid, pending, available: earned - paid - pending }
}

// Pichle N mahino ka chart data
export function monthlySeries(parcels, months = 6) {
  const now = new Date()
  const series = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const inMonth = parcels.filter((p) => {
      const c = new Date(p.created_at)
      return c.getMonth() === d.getMonth() && c.getFullYear() === d.getFullYear()
    })
    const delivered = inMonth.filter((p) => p.status === 'Delivered')
    series.push({
      month: d.toLocaleString('en', { month: 'short' }),
      parcels: inMonth.length,
      delivered: delivered.length,
      revenue: sum(inMonth.filter((p) => p.status === 'Delivered' || p.status === 'Returned'), 'delivery_charges'),
      cod: sum(delivered, 'cod_amount'),
    })
  }
  return series
}

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
