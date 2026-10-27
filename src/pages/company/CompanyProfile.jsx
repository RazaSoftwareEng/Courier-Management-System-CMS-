import { useStore } from '../../store/StoreContext'
import { CITIES } from '../../data/constants'
import { date } from '../../lib/utils'
import EntityForm from '../../components/EntityForm'
import { PageHeader, Section, StatusBadge } from '../../components/ui'

export default function CompanyProfile() {
  const { session, companies, update, notify } = useStore()
  const company = companies.find((c) => c.id === session.company_id)

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Company Profile" subtitle="Apni company ki maloomat update karein" />
      <div className="card flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-semibold text-indigo-700">{company.name[0]}</div>
        <div className="flex-1">
          <p className="text-lg font-semibold">{company.name}</p>
          <p className="text-sm text-slate-500">Member since {date(company.created_at)}</p>
        </div>
        <StatusBadge status={company.status} />
      </div>
      <Section title="Details">
        <EntityForm
          key={company.id}
          fields={[
            { name: 'name', label: 'Company Name', required: true },
            { name: 'owner_name', label: 'Owner Name', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'phone', label: 'Phone', required: true },
            { name: 'city', label: 'City', type: 'select', options: CITIES, required: true },
            { name: 'address', label: 'Address', type: 'textarea' },
          ]}
          initial={company}
          submitLabel="Save Profile"
          onSubmit={async (v) => {
            if (await update('companies', company.id, v)) notify('Profile update ho gaya')
          }}
        />
      </Section>
    </div>
  )
}
