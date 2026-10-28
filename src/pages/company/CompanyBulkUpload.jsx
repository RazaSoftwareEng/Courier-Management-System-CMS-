import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { deliveryCharges } from '../../data/constants'
import { money } from '../../lib/utils'
import { LIMITS, check, checkNumber } from '../../lib/validation'
import { PageHeader } from '../../components/ui'
import BulkImport, { collector, num } from '../../components/BulkImport'

// Sheet ke columns; `aliases` se thore mukhtalif headers bhi pehchan liye jate hain
const COLUMNS = [
  { key: 'receiver_name', label: 'Receiver Name', required: true, width: 22, aliases: ['name', 'receiver'] },
  { key: 'receiver_phone', label: 'Receiver Phone', required: true, width: 18, aliases: ['phone', 'mobile'], text: true },
  { key: 'destination_country', label: 'Country', width: 16, aliases: ['destination country'] },
  { key: 'city', label: 'City', required: true, width: 16 },
  { key: 'receiver_landmark', label: 'Landmark', required: true, width: 22 },
  { key: 'receiver_address', label: 'Address', required: true, width: 36, aliases: ['full address', 'receiver address'] },
  { key: 'weight', label: 'Weight (kg)', required: true, width: 12, aliases: ['weight', 'weight kg'] },
  { key: 'cod_amount', label: 'COD Amount', required: true, width: 14, aliases: ['cod', 'cod amount'] },
  { key: 'description', label: 'Description', width: 28, aliases: ['item', 'items', 'notes'] },
]

const TEMPLATE = {
  filename: 'orders-sample.xlsx',
  sampleRows: [
    ['Babar Ali', '03001234567', 'Pakistan', 'Karachi', 'Near Imtiaz Store', 'House 12, Street 4, Gulshan-e-Iqbal Block 5', 1, 2500, 'Shoes'],
    ['Ayesha Khan', '03219876543', 'Pakistan', 'Lahore', 'Opposite Jamia Masjid', 'Flat 3, Building 7, DHA Phase 4', 0.5, 1200, 'Cosmetics'],
  ],
}

const NOTES = [
  ['Receiver Name', 'Yes', 'Receiver ka poora naam'],
  ['Receiver Phone', 'Yes', 'Pakistan: 03XXXXXXXXX. International: +country code ke saath'],
  ['Country', 'No', 'Khali chhorein to Pakistan'],
  ['City', 'Yes', 'Destination city'],
  ['Landmark', 'Yes', 'Qareebi mashhoor jagah'],
  ['Address', 'Yes', 'Ghar / dukaan ka poora address'],
  ['Weight (kg)', 'Yes', `${LIMITS.weight.min} se ${LIMITS.weight.max} kg`],
  ['COD Amount', 'Yes', 'Receiver se wasool hone wali raqam (0 agar prepaid)'],
  ['Description', 'No', 'Parcel mein kya hai'],
]

// Excel number ki tarah save hua phone (3001234567) shuru ka 0 kho deta hai
const fixPhone = (raw) => {
  const s = String(raw ?? '').trim()
  return /^3\d{9}$/.test(s) ? `0${s}` : s
}

// ParcelForm wali validation, har row par
function validateOrder(raw, companyId, rates, settings) {
  const { errors, take } = collector()
  const country = raw.destination_country || 'Pakistan'
  const isPakistan = country.toLowerCase() === 'pakistan'
  const payload = {
    company_id: companyId,
    receiver_name: take(check('personName', raw.receiver_name, { required: true, label: 'Naam' }), 'Naam'),
    receiver_phone: take(check(isPakistan ? 'phone' : 'intlPhone', fixPhone(raw.receiver_phone), { required: true, label: 'Phone' }), 'Phone'),
    destination_country: take(check('city', country, { required: true, label: 'Country' }), 'Country'),
    city: take(check('city', raw.city, { required: true, label: 'City' }), 'City'),
    receiver_landmark: take(check('landmark', raw.receiver_landmark, { required: true, label: 'Landmark' }), 'Landmark'),
    receiver_address: take(check('fullAddress', raw.receiver_address, { required: true, label: 'Address' }), 'Address'),
    weight: take(checkNumber(num(raw.weight), { ...LIMITS.weight, label: 'Weight' }), 'Weight'),
    cod_amount: take(checkNumber(num(raw.cod_amount), { ...LIMITS.cod, label: 'COD' }), 'COD'),
    description: take(check('text', raw.description), 'Description') || null,
  }
  payload.delivery_charges = deliveryCharges({ city: payload.city, country: payload.destination_country, weight: payload.weight }, rates, settings)
  return { payload, errors }
}

const PREVIEW = [
  {
    label: 'Receiver',
    render: (r) => (
      <>
        <p className="font-medium text-slate-800">{r.raw.receiver_name || '-'}</p>
        <p className="text-xs text-slate-400">{fixPhone(r.raw.receiver_phone)}</p>
      </>
    ),
  },
  {
    label: 'Destination',
    render: (r) =>
      [r.raw.city, r.raw.destination_country && r.raw.destination_country !== 'Pakistan' ? r.raw.destination_country : null].filter(Boolean).join(', ') || '-',
  },
  { label: 'Weight', align: 'right', render: (r) => `${r.raw.weight || '-'} kg` },
  { label: 'COD', align: 'right', render: (r) => (r.raw.cod_amount ? money(num(r.raw.cod_amount)) : '-') },
  { label: 'Est. Charges', align: 'right', render: (r) => (r.errors.length ? '-' : money(r.payload.delivery_charges)) },
]

export default function CompanyBulkUpload() {
  const { session, rates, settings, add } = useStore()

  return (
    <div className="space-y-6">
      <PageHeader title="Import Orders" subtitle="Excel sheet se ek saath kai orders book karein">
        <Link to="/company/orders" className="btn-secondary">
          <ArrowLeft size={16} /> Back to Orders
        </Link>
      </PageHeader>

      <BulkImport
        noun="orders"
        columns={COLUMNS}
        sheetName="Orders"
        template={TEMPLATE}
        notes={NOTES}
        validate={(raw) => validateOrder(raw, session.company_id, rates, settings)}
        create={async (payload, onError) => (await add('parcels', payload, { onError }))?.tracking_id}
        preview={PREVIEW}
      />
    </div>
  )
}
