import { useMemo, useState } from 'react'
import { useStore } from '../../store/StoreContext'
import { PageHeader } from '../../components/ui'
import StatementImport from '../../components/StatementImport'
import StatementList from '../../components/StatementList'

export default function Statements() {
  const { companies } = useStore()
  const [companyId, setCompanyId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const company = useMemo(() => companies.find((c) => c.id === companyId), [companies, companyId])

  return (
    <div className="space-y-6">
      <PageHeader title="Statements" subtitle="Company select karein, phir statement detail ki Excel file upload karein" />

      <StatementImport companyId={companyId} onCompanyChange={setCompanyId} onDone={() => setRefreshKey((k) => k + 1)} />

      {/* Company select na ho to sab companies ki statements */}
      <StatementList
        companyId={companyId}
        title={company ? `${company.name} — Uploaded Statements` : 'All Uploaded Statements'}
        refreshKey={refreshKey}
      />
    </div>
  )
}
