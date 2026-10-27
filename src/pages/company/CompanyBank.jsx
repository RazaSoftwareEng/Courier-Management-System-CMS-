import { useState } from 'react'
import { Landmark, Pencil, Trash2, Plus } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import EntityForm from '../../components/EntityForm'
import { PageHeader, Section, StatusBadge, ConfirmDialog } from '../../components/ui'
import { bankFields } from '../admin/BankAccounts'

export default function CompanyBank() {
  const { session, bank_accounts, add, update, remove, notify } = useStore()
  const bank = bank_accounts.find((b) => b.company_id === session.company_id)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const showForm = editing || !bank

  return (
    <div className="max-w-3xl">
      <PageHeader title="Bank Details" subtitle="Aapki payments isi account mein bheji jayengi" />

      {showForm ? (
        <Section title={bank ? 'Edit Bank Account' : 'Add Bank Account'}>
          {!bank && !editing ? (
            <div className="py-8 text-center">
              <Landmark size={40} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Abhi koi bank account add nahi kiya gaya</p>
              <button className="btn-primary mt-4" onClick={() => setEditing(true)}>
                <Plus size={16} /> Add Bank Account
              </button>
            </div>
          ) : (
            <EntityForm
              fields={bankFields}
              initial={bank}
              onCancel={() => setEditing(false)}
              onSubmit={async (v) => {
                // Details badalne par database verified ko false kar deta hai, admin dobara verify karega
                const ok = bank ? await update('bank_accounts', bank.id, v) : await add('bank_accounts', { ...v, company_id: session.company_id })
                if (!ok) return
                notify('Bank details save ho gayin. Admin verify karega.')
                setEditing(false)
              }}
            />
          )}
        </Section>
      ) : (
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-indigo-200">Bank</p>
                <p className="text-xl font-semibold">{bank.bank_name}</p>
              </div>
              <Landmark size={28} className="text-indigo-200" />
            </div>
            <p className="mt-6 break-all font-mono text-base tracking-wider sm:text-lg sm:tracking-widest">{bank.iban}</p>
            <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
              <div>
                <p className="text-indigo-200">Account Title</p>
                <p className="font-medium">{bank.account_title}</p>
              </div>
              <div className="text-right">
                <p className="text-indigo-200">Account No.</p>
                <p className="font-mono font-medium">{bank.account_no}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <StatusBadge status={bank.verified ? 'Verified' : 'Unverified'} />
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Edit
              </button>
              <button className="btn-secondary text-rose-600" onClick={() => setDeleting(true)}>
                <Trash2 size={16} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting}
        message="Bank account remove karna hai?"
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          if (await remove('bank_accounts', bank.id)) notify('Bank account remove ho gaya')
        }}
      />
    </div>
  )
}
