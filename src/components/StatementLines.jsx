import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useStore, friendly } from '../store/StoreContext'
import { FEE_KEYS } from '../data/statementColumns'
import { fetchLines } from '../lib/statements'
import DataTable from './DataTable'

const pkr = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fees = (l) => FEE_KEYS.reduce((t, k) => t + (Number(l[k]) || 0), 0)

const columns = [
  { key: 'tracking_no', label: 'Tracking No.', render: (l) => <span className="font-mono text-xs text-indigo-600">{l.tracking_no}</span> },
  { key: 'order_no', label: 'Order No.', render: (l) => l.order_no || '-' },
  { key: 'buyer_name', label: 'Buyer', render: (l) => l.buyer_name || '-' },
  { key: 'buyer_province', label: 'Province', render: (l) => l.buyer_province || '-' },
  { key: 'final_status', label: 'Status', render: (l) => l.final_status || '-' },
  { key: 'final_status_at', label: 'Final Date', render: (l) => l.final_status_at || '-' },
  { key: 'cod_amount', label: 'COD', align: 'right', render: (l) => pkr(l.cod_amount) },
  { key: 'fees', label: 'Fees', align: 'right', render: (l) => pkr(fees(l)), csv: fees },
  { key: 'payable_amount', label: 'Payable', align: 'right', render: (l) => <span className="font-semibold">{pkr(l.payable_amount)}</span> },
]

// Statement ki rows page par hi; poore 29 columns Excel download mein
export default function StatementLines({ statementId }) {
  const { notify } = useStore()
  const [lines, setLines] = useState(null) // null = loading

  useEffect(() => {
    fetchLines(statementId)
      .then((rows) => setLines(rows.map((l, i) => ({ ...l, id: i }))))
      .catch((e) => {
        setLines([])
        notify(friendly(e), 'error')
      })
  }, [statementId, notify])

  const statuses = useMemo(() => [...new Set((lines || []).map((l) => l.final_status).filter(Boolean))], [lines])

  if (!lines) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      rows={lines}
      filters={[{ key: 'final_status', label: 'Status', options: statuses }]}
      searchKeys={['tracking_no', 'order_no', 'buyer_name', 'buyer_province']}
      empty="Is statement mein koi row nahi"
    />
  )
}
