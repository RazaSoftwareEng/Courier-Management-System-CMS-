import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, ShieldOff } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { byId, date } from '../../lib/utils'
import DataTable from '../../components/DataTable'
import EntityForm from '../../components/EntityForm'
import { Modal, ConfirmDialog, PageHeader, IconButton, StatusBadge } from '../../components/ui'

export const BANKS = ['Meezan Bank', 'HBL', 'UBL', 'MCB Bank', 'Allied Bank', 'Bank Alfalah', 'Faysal Bank', 'Askari Bank', 'Standard Chartered']

export const bankFields = [
  { name: 'bank_name', label: 'Bank Name', type: 'select', options: BANKS, required: true },
  { name: 'account_title', label: 'Account Title', required: true },
  { name: 'account_no', label: 'Account Number', required: true },
  { name: 'iban', label: 'IBAN', required: true, placeholder: 'PK00XXXX0000000000000000' },
]

export default function BankAccounts() {
  const { bank_accounts, companies, add, update, remove, notify } = useStore()
  const [form, setForm] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const companyMap = useMemo(() => byId(companies), [companies])

  const rows = bank_accounts.map((b) => ({ ...b, verified_label: b.verified ? 'Verified' : 'Unverified' }))

  const fields = [
    { name: 'company_id', label: 'Company', type: 'select', required: true, full: true, options: companies.map((c) => ({ value: c.id, label: c.name })) },
    ...bankFields,
    { name: 'verified', label: 'Verified', type: 'checkbox' },
  ]

  const columns = [
    { key: 'company', label: 'Company', render: (b) => <span className="font-medium">{companyMap[b.company_id]?.name || '-'}</span>, csv: (b) => companyMap[b.company_id]?.name },
    { key: 'bank_name', label: 'Bank' },
    { key: 'account_title', label: 'Title' },
    { key: 'account_no', label: 'Account No.', render: (b) => <span className="font-mono text-xs">{b.account_no}</span> },
    { key: 'iban', label: 'IBAN', render: (b) => <span className="font-mono text-xs">{b.iban}</span> },
    { key: 'verified_label', label: 'Status', render: (b) => <StatusBadge status={b.verified_label} /> },
    { key: 'created_at', label: 'Added', render: (b) => date(b.created_at), csv: (b) => date(b.created_at) },
    {
      key: 'actions',
      label: '',
      render: (b) => (
        <div className="flex justify-end gap-0.5">
          {b.verified ? (
            <IconButton icon={ShieldOff} title="Unverify" tone="rose" onClick={() => toggle(b)} />
          ) : (
            <IconButton icon={ShieldCheck} title="Verify" tone="emerald" onClick={() => toggle(b)} />
          )}
          <IconButton icon={Pencil} title="Edit" onClick={() => setForm({ item: b })} />
          <IconButton icon={Trash2} title="Delete" tone="rose" onClick={() => setDeleting(b)} />
        </div>
      ),
    },
  ]

  const toggle = async (b) => {
    if (await update('bank_accounts', b.id, { verified: !b.verified })) notify(b.verified ? 'Account unverified' : 'Account verified')
  }

  return (
    <div>
      <PageHeader title="Bank Accounts" subtitle="Companies ki bank details dekhein aur verify karein">
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus size={16} /> Add Account
        </button>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={rows}
        exportName="bank-accounts"
        searchKeys={[(b) => companyMap[b.company_id]?.name, 'bank_name', 'account_title', 'account_no', 'iban']}
        filters={[{ key: 'verified_label', label: 'Status', options: ['Verified', 'Unverified'] }]}
      />

      <Modal open={!!form} title={form?.item ? 'Edit Bank Account' : 'Add Bank Account'} onClose={() => setForm(null)}>
        {form && (
          <EntityForm
            fields={fields}
            initial={form.item}
            onCancel={() => setForm(null)}
            onSubmit={async (v) => {
              const ok = form.item ? await update('bank_accounts', form.item.id, v) : await add('bank_accounts', v)
              if (!ok) return
              notify(form.item ? 'Bank account update ho gaya' : 'Bank account add ho gaya')
              setForm(null)
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message="Ye bank account delete karna hai?"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (await remove('bank_accounts', deleting.id)) notify('Bank account delete ho gaya')
        }}
      />
    </div>
  )
}
