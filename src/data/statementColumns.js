// Statement detail sheet ke columns — admin upload, sample file aur company download sab isi se.
// type: text | number. `db: false` wale statement par save hote hain, har line par nahi.
// Khali number = 0, khali text = N/A (sirf Statement Number, Period aur Tracking No. zaroori hain).
export const STATEMENT_COLUMNS = [
  { key: 'statement_number', label: 'Statement Number', required: true, width: 26, db: false },
  { key: 'statement_period', label: 'Statement Period', required: true, width: 24, db: false },
  { key: 'tracking_no', label: 'Tracking No.', required: true, width: 16, aliases: ['tracking number', 'tracking id'] },
  { key: 'original_tracking_no', label: 'Original TrackingNumber', width: 22, aliases: ['original tracking no'] },
  { key: 'warehouse_name', label: 'Warehouse name', width: 20, aliases: ['warehouse'] },
  { key: 'order_type', label: 'Order Type', width: 14 },
  { key: 'order_no', label: 'Order No.', width: 14, aliases: ['order number'], text: true },
  { key: 'external_order_no', label: 'External Order No.', width: 18, aliases: ['external order number'], text: true },
  { key: 'order_created_at', label: 'Order creation date', width: 20, aliases: ['order date', 'creation date'] },
  { key: 'final_status_at', label: 'Final Status Date', width: 20 },
  { key: 'buyer_name', label: 'Buyer Name', width: 22 },
  { key: 'buyer_phone', label: 'Buyer Phone', width: 16, text: true },
  { key: 'buyer_province', label: 'Buyer Province', width: 22, aliases: ['province'] },
  // Format: pkg length x height x width (cm)_weight (kg), jaise 30x20x10_1.5 — text hi save hota hai
  { key: 'dead_weight', label: 'Dead Weight', width: 18, text: true },
  { key: 'billing_weight', label: 'Billing Weight', width: 18, text: true },
  { key: 'payment_method', label: 'Payment Method', width: 15 },
  { key: 'final_status', label: 'Final Status', width: 13, aliases: ['status'] },
  { key: 'cod_amount', label: 'COD Amount', type: 'number', width: 13, aliases: ['cod'] },
  { key: 'cod_surcharge_fee', label: 'COD Surcharge Fee', type: 'number', fee: true, width: 17 },
  { key: 'paid_shipping_fee', label: 'Paid Shipping Fee', type: 'number', fee: true, width: 16 },
  { key: 'shipping_fee', label: 'Shipping Fee', type: 'number', fee: true, width: 13 },
  { key: 'shipping_fee_vat', label: 'ShippingFee VAT', type: 'number', fee: true, width: 15, aliases: ['shipping fee vat'] },
  { key: 'return_shipping_fee', label: 'Return Shipping Fee', type: 'number', fee: true, width: 18 },
  { key: 'failed_delivery_fee', label: 'Failed Delivery Fee', type: 'number', fee: true, width: 17 },
  { key: 'income_tax', label: 'Income Tax', type: 'number', fee: true, width: 11 },
  { key: 'sales_tax', label: 'Sales Tax', type: 'number', fee: true, width: 11 },
  { key: 'fuel_surcharge', label: 'Fuel Surcharge 3PV', type: 'number', fee: true, width: 17, aliases: ['fuel surcharge'] },
  { key: 'payable_amount', label: 'Payable Amount', type: 'number', width: 15, aliases: ['payable'] },
  { key: 'note', label: 'Note', width: 28, aliases: ['notes', 'remarks'] },
]

export const EMPTY = 'N/A'

export const LINE_COLUMNS = STATEMENT_COLUMNS.filter((c) => c.db !== false)
export const FEE_KEYS = STATEMENT_COLUMNS.filter((c) => c.fee).map((c) => c.key)

// Ek line (DB row ya parcel se bani) + statement -> Excel ki ek row
export const toSheetRow = (line, statement) =>
  STATEMENT_COLUMNS.map((c) => {
    if (c.key === 'statement_number') return statement.number
    if (c.key === 'statement_period') return `${statement.start} - ${statement.end}`
    const v = line[c.key]
    if (c.type === 'number') return Number(v) || 0
    return v === null || v === undefined || String(v).trim() === '' ? EMPTY : v
  })

// Total row: poori row highlight, amounts ke saath (left cell mein) label
const TOTAL_LABELS = { cod_amount: 'Total COD', payable_amount: 'Total Payable' }
const totalBorder = { style: 'medium', color: { rgb: '4F46E5' } }
const totalStyle = (extra = {}) => ({
  font: { bold: true, sz: 12, color: { rgb: '1E1B4B' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'E0E7FF' } },
  border: { top: totalBorder, bottom: totalBorder },
  alignment: { vertical: 'center', ...extra },
})

function addTotalRow(XLSX, sheet, lines, r) {
  const last = STATEMENT_COLUMNS.length - 1
  for (let c = 0; c <= last; c++) sheet[XLSX.utils.encode_cell({ r, c })] = { t: 's', v: '', s: totalStyle() }
  sheet[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 's', v: 'Total', s: totalStyle() }

  Object.entries(TOTAL_LABELS).forEach(([key, label]) => {
    const c = STATEMENT_COLUMNS.findIndex((col) => col.key === key)
    const col = XLSX.utils.encode_col(c)
    const v = Math.round(lines.reduce((t, l) => t + (Number(l[key]) || 0), 0) * 100) / 100
    sheet[XLSX.utils.encode_cell({ r, c: c - 1 })] = { t: 's', v: label, s: totalStyle({ horizontal: 'right' }) }
    // SUM formula, taa ke rows badalne par total khud update ho
    sheet[XLSX.utils.encode_cell({ r, c })] = { t: 'n', v, f: `SUM(${col}2:${col}${r})`, z: '#,##0.00', s: { ...totalStyle({ horizontal: 'right' }), font: { bold: true, sz: 13, color: { rgb: '1E1B4B' } } } }
  })
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: last } })
  sheet['!rows'] = [...Array(r).fill(undefined), { hpt: 24 }]
}

export async function downloadStatementSheet(statement, lines) {
  // xlsx-js-style: SheetJS jaisi hi, magar cell styling (bold, rang) bhi likhti hai
  const lib = await import('xlsx-js-style')
  const XLSX = lib.default || lib
  const rows = [STATEMENT_COLUMNS.map((c) => c.label), ...lines.map((l) => toSheetRow(l, statement))]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  if (lines.length) addTotalRow(XLSX, sheet, lines, rows.length)
  sheet['!cols'] = STATEMENT_COLUMNS.map((c) => ({ wch: c.width }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Statement')
  XLSX.writeFile(book, `${statement.number}.xlsx`)
}

// "2026-10-26 - 2026-10-28", "26/10/2026 to 28/10/2026" -> ['2026-10-26', '2026-10-28']
export function parsePeriod(text) {
  const dates = String(text ?? '').match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/g) || []
  if (dates.length !== 2) return null
  const iso = dates.map((d) => {
    const [a, b, c] = d.split(/[/.-]/).map(Number)
    const [y, m, day] = d.match(/^\d{4}/) ? [a, b, c] : [c, b, a]
    const dt = new Date(Date.UTC(y, m - 1, day))
    return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day ? dt.toISOString().slice(0, 10) : null
  })
  if (iso.includes(null) || iso[0] > iso[1]) return null
  return iso
}
