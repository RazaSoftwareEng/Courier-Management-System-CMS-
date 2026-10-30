import { useEffect, useState } from 'react'
import { useStore, friendly } from '../store/StoreContext'
import { supabase } from './supabase'
import { fetchStatements } from './statements'

// Statements store mein nahi hote. Yahan se parhe jate hain, aur nayi upload par khud update
// (realtime, aur tab par wapis aane par). companyId na ho to sab companies (admin).
// null = abhi load ho rahi hain
export function useStatements(companyId) {
  const { notify } = useStore()
  const [statements, setStatements] = useState(null)

  useEffect(() => {
    const load = () =>
      fetchStatements(companyId)
        .then(setStatements)
        .catch((e) => {
          setStatements((s) => s || [])
          notify(friendly(e), 'error')
        })
    load()
    const channel = supabase
      .channel(`dashboard-statements-${companyId || 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statements' }, load)
      .subscribe()
    const onFocus = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [companyId, notify])

  return statements
}
