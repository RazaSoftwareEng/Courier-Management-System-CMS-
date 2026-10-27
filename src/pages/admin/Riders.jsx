import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Bike, PackageCheck, Truck, ClipboardList } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { CITIES, RIDER_STATUSES, ACTIVE_STATUSES } from '../../data/constants'
import { riderTask } from '../../components/RiderParcelCard'
import { date, riderDayStats } from '../../lib/utils'
import RiderReport from '../rider/RiderReport'
import DataTable from '../../components/DataTable'
import EntityForm from '../../components/EntityForm'
import { Modal, ConfirmDialog, PageHeader, IconButton, StatusBadge, StatCard } from '../../components/ui'


const fields = [
  { name: 'name', label: 'Name', required: true, rule: 'personName' },
  { name: 'phone', label: 'Phone', required: true, rule: 'phone' },
  { name: 'cnic', label: 'CNIC', required: true, rule: 'cnic' },
  { name: 'vehicle_no', label: 'Bike Number', required: true, rule: 'vehicle' },
  { name: 'city', label: 'City', type: 'select', options: CITIES },
  { name: 'status', label: 'Status', type: 'select', options: RIDER_STATUSES, required: true, default: 'Active' },
  { name: 'email', label: 'Login Email (rider dashboard ke liye)', type: 'email', rule: 'email', full: true },
]

// Email ke saath password dene par rider ka login ban jata hai
const passwordField = { name: 'password', label: 'Login Password (kam az kam 6 characters)', type: 'password', minLength: 6, full: true }

export default function Riders() {
  const { riders, parcels, add, update, remove, createLogin, notify } = useStore()
  const [form, setForm] = useState(null)
  const [report, setReport] = useState(null)
  const [deleting, setDeleting] = useState(null)

  // Har rider ke abhi chal rahe aur deliver kiye gaye parcels
  const stats = useMemo(() => {
    const s = {}
    riders.forEach((r) => {
      s[r.id] = {
        active: parcels.filter((p) => riderTask(p, r.id)).length,
        delivered: parcels.filter((p) => p.rider_id === r.id && p.status === 'Delivered').length,
        today: riderDayStats(parcels, new Date(), r.id).delivered.length,
      }
    })
    return s
  }, [parcels, riders])

  const onRoad = parcels.filter((p) => ACTIVE_STATUSES.includes(p.status) && p.status !== 'Booked').length
  // Jahan agle step ke liye rider chahiye magar assign nahi
  const unassigned = parcels.filter(
    (p) =>
      (p.status === 'Booked' && !p.pickup_rider_id) ||
      (!p.rider_id && (p.status === 'Arrived at Destination' || (p.status === 'At Head Office' && p.delivery_type === 'Local')))
  ).length

  const columns = [
    {
      key: 'name',
      label: 'Rider',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.name}</p>
          <p className="text-xs text-slate-400">{r.phone}</p>
        </div>
      ),
    },
    { key: 'city', label: 'City', render: (r) => r.city || '-' },
    { key: 'email', label: 'Login', render: (r) => r.email || <span className="text-xs text-slate-400">No login</span> },
    { key: 'vehicle_no', label: 'Bike', render: (r) => r.vehicle_no || '-' },
    { key: 'cnic', label: 'CNIC', render: (r) => r.cnic || '-' },
    { key: 'active', label: 'Active Parcels', align: 'right', render: (r) => stats[r.id]?.active || 0, csv: (r) => stats[r.id]?.active || 0 },
    {
      key: 'today',
      label: 'Delivered Today',
      align: 'right',
      render: (r) => stats[r.id]?.today || 0,
      csv: (r) => stats[r.id]?.today || 0,
    },
    { key: 'delivered', label: 'Delivered (Total)', align: 'right', render: (r) => stats[r.id]?.delivered || 0, csv: (r) => stats[r.id]?.delivered || 0 },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'created_at', label: 'Joined', render: (r) => date(r.created_at), csv: (r) => date(r.created_at) },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex justify-end gap-0.5">
          <IconButton icon={ClipboardList} title="Daily report" onClick={() => setReport(r)} />
          <IconButton icon={Pencil} title="Edit" onClick={() => setForm({ item: r })} />
          <IconButton icon={Trash2} title="Delete" tone="rose" onClick={() => setDeleting(r)} />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Riders" subtitle="Delivery riders: parcels par assign karne ke liye">
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus size={16} /> Add Rider
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total Riders" value={riders.length} icon={Bike} />
        <StatCard label="Active Riders" value={riders.filter((r) => r.status === 'Active').length} icon={Bike} tone="emerald" />
        <StatCard label="Parcels on Road" value={onRoad} icon={Truck} tone="sky" />
        <StatCard label="Rider Not Assigned" value={unassigned} icon={PackageCheck} tone="amber" />
      </div>

      <DataTable
        columns={columns}
        rows={riders}
        exportName="riders"
        searchKeys={['name', 'phone', 'cnic', 'vehicle_no', 'city']}
        filters={[
          { key: 'status', label: 'Status', options: RIDER_STATUSES },
          { key: 'city', label: 'City', options: CITIES },
        ]}
      />

      <Modal open={!!form} title={form?.item ? 'Edit Rider' : 'Add Rider'} onClose={() => setForm(null)}>
        {form && (
          <EntityForm
            fields={[...fields, passwordField]}
            initial={form.item}
            onCancel={() => setForm(null)}
            onSubmit={async ({ password, ...v }) => {
              if (password && !v.email) return notify('Login ke liye email bhi likhein', 'error')
              const ok = form.item ? await update('riders', form.item.id, v) : await add('riders', v)
              if (!ok) return
              // Rider pehle bana, phir login: profile trigger email se rider link kar deta hai
              if (password) {
                if (await createLogin(v.email, password, v.name)) notify('Rider aur uska login ban gaya')
              } else {
                notify(form.item ? 'Rider update ho gaya' : 'Rider add ho gaya')
              }
              setForm(null)
            }}
          />
        )}
      </Modal>

      <Modal open={!!report} title={`${report?.name}: Daily Report`} onClose={() => setReport(null)} size="lg">
        {report && <RiderReport riderId={report.id} />}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={`${deleting?.name} ko delete karna hai? Uske parcels se rider hat jayega.`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (await remove('riders', deleting.id)) notify('Rider delete ho gaya')
        }}
      />
    </div>
  )
}
