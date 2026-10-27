import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { money } from '../../lib/utils'
import { LIMITS } from '../../lib/validation'
import EntityForm from '../../components/EntityForm'
import { Modal, ConfirmDialog, PageHeader, Section, IconButton } from '../../components/ui'

const rateFields = [
  { name: 'city', label: 'City', required: true, rule: 'city' },
  { name: 'base_charge', label: 'Base Charge (Rs)', type: 'number', required: true, ...LIMITS.charges },
  { name: 'per_kg', label: 'Per Kg (Rs)', type: 'number', required: true, ...LIMITS.charges },
]

export default function Settings() {
  const { settings, updateSettings, rates, add, update, remove, notify } = useStore()
  const [rateForm, setRateForm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="System settings, commission aur shipping rates" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="General">
          <EntityForm
            key={JSON.stringify(settings)}
            fields={[
              { name: 'system_name', label: 'System Name', required: true, rule: 'name' },
              { name: 'support_phone', label: 'Support Phone', rule: 'phone' },
              { name: 'commission_percent', label: 'Commission on COD (%)', type: 'number', required: true, ...LIMITS.commission },
              { name: 'hub_city', label: 'Head Office City', required: true, rule: 'city' },
              { name: 'domestic_base_charge', label: 'Dusre shehar: Base (Rs)', type: 'number', required: true, ...LIMITS.charges },
              { name: 'domestic_per_kg', label: 'Dusre shehar: Per Kg (Rs)', type: 'number', required: true, ...LIMITS.charges },
              { name: 'intl_base_charge', label: 'International: Base (Rs)', type: 'number', required: true, ...LIMITS.charges },
              { name: 'intl_per_kg', label: 'International: Per Kg (Rs)', type: 'number', required: true, ...LIMITS.charges },
            ]}
            initial={settings}
            submitLabel="Save Settings"
            onSubmit={async (v) => {
              if (await updateSettings(v)) notify('Settings save ho gayin')
            }}
          />
        </Section>

        <Section
          title="Shipping Rates (per city)"
          action={
            <button className="btn-secondary px-3 py-1.5" onClick={() => setRateForm({})}>
              <Plus size={14} /> Add City
            </button>
          }
        >
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 font-medium">City</th>
                <th className="py-2 text-right font-medium">Base</th>
                <th className="py-2 text-right font-medium">Per Kg</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rates.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 font-medium">{r.city}</td>
                  <td className="py-2 text-right">{money(r.base_charge)}</td>
                  <td className="py-2 text-right">{money(r.per_kg)}</td>
                  <td className="py-2 text-right">
                    <IconButton icon={Pencil} title="Edit" onClick={() => setRateForm({ item: r })} />
                    <IconButton icon={Trash2} title="Delete" tone="rose" onClick={() => setDeleting(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      <Modal open={!!rateForm} title={rateForm?.item ? 'Edit Rate' : 'Add City Rate'} onClose={() => setRateForm(null)} size="sm">
        {rateForm && (
          <EntityForm
            fields={rateFields}
            initial={rateForm.item}
            onCancel={() => setRateForm(null)}
            onSubmit={async (v) => {
              const ok = rateForm.item ? await update('rates', rateForm.item.id, v) : await add('rates', v)
              if (!ok) return
              notify('Rate save ho gaya')
              setRateForm(null)
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message={`${deleting?.city} ka rate delete karna hai?`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (await remove('rates', deleting.id)) notify('Rate delete ho gaya')
        }}
      />
    </div>
  )
}
