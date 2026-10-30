import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, signupClient, setRememberSession } from '../lib/supabase'

// Saara data Supabase se aata hai. RLS ki wajah se company ko sirf apna data milta hai,
// admin ko sab kuch. Pages isi context ke add/update/remove use karte hain.

const TABLES = ['companies', 'bank_accounts', 'payments']
const DEFAULT_SETTINGS = { system_name: 'CourierPro' }

const emptyData = () => ({ ...Object.fromEntries(TABLES.map((t) => [t, []])), settings: DEFAULT_SETTINGS })

export const friendly = (error) => {
  const msg = error?.message || 'Kuch ghalat ho gaya'
  if (msg.includes('Invalid login credentials')) return 'Email ya password ghalat hai'
  if (msg.includes('Email not confirmed')) return 'Email abhi confirm nahi hui'
  if (msg.includes('duplicate key')) return 'Ye record pehle se maujood hai'
  if (msg.includes('violates check constraint')) {
    // 004_validation.sql ke constraint names se
    const checks = {
      phone_fmt: 'Phone 03XXXXXXXXX format mein hona chahiye',
      iban_fmt: 'IBAN sahi nahi (PK + 22 characters)',
      account_fmt: 'Account number 8 se 20 digits ka hona chahiye',
      email_fmt: 'Email sahi nahi',
      _len: 'Koi field bohat lambi ya bohat chhoti hai',
      _max: 'Value had se zyada hai',
    }
    const hit = Object.keys(checks).find((k) => msg.includes(k))
    return hit ? checks[hit] : 'Kuch fields ka format sahi nahi'
  }
  if (msg.includes('violates foreign key')) return 'Is record se dusra data juda hua hai, pehle woh delete karein'
  if (msg.includes('row-level security') || msg.includes('0 rows') || msg.includes('coerce the result')) return 'Aapko is kaam ki ijazat nahi'
  return msg
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [data, setData] = useState(emptyData)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const fail = useCallback(
    (error) => {
      console.error(error)
      notify(friendly(error), 'error')
      return null
    },
    [notify]
  )

  const fetchTable = async (table) => {
    const { data: rows, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
    if (error) throw error
    return rows
  }

  const loadAll = useCallback(async () => {
    // Ek table fail ho (e.g. migration abhi nahi chali) to baqi data phir bhi load ho
    const results = await Promise.allSettled(TABLES.map(fetchTable))
    const failed = results.find((r) => r.status === 'rejected')
    if (failed) fail(failed.reason)
    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle()
    setData({
      ...Object.fromEntries(TABLES.map((t, i) => [t, results[i].status === 'fulfilled' ? results[i].value : []])),
      settings: settings || DEFAULT_SETTINGS,
    })
  }, [fail])

  const reload = useCallback(
    async (...tables) => {
      try {
        const results = await Promise.all(tables.map(fetchTable))
        setData((d) => ({ ...d, ...Object.fromEntries(tables.map((t, i) => [t, results[i]])) }))
      } catch (e) {
        fail(e)
      }
    },
    [fail]
  )

  // Login user ka profile parh kar role tay karna. Error ho to { error } wapis.
  const resolveSession = useCallback(
    async (authSession) => {
      if (!authSession) return { error: null }
      const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', authSession.user.id).maybeSingle()
      if (error || !profile) return { error: 'Is account ka profile nahi mila' }

      let companyName = null
      if (profile.role === 'company') {
        if (!profile.company_id) return { error: 'Ye account kisi company se link nahi hai. Admin se rabta karein.' }
        const { data: company } = await supabase.from('companies').select('name, owner_name').eq('id', profile.company_id).maybeSingle()
        // my_company_id() sirf Active company deta hai, is liye Pending/Suspended ko kuch nahi milta
        if (!company) return { error: 'Aapka account active nahi hai (Pending/Suspended). Admin se rabta karein.' }
        companyName = company.owner_name
      }
      // Portal sirf admin aur company ke liye hai
      if (!['admin', 'company'].includes(profile.role)) return { error: 'Ye portal sirf admin aur company ke liye hai' }

      await loadAll()
      const s = {
        role: profile.role,
        company_id: profile.company_id,
        email: profile.email,
        name: profile.full_name || companyName || profile.email,
      }
      setSession(s)
      return { session: s }
    },
    [loadAll]
  )

  useEffect(() => {
    if (!supabase) return setAuthLoading(false)
    supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
      const res = await resolveSession(authSession)
      if (res.error) await supabase.auth.signOut()
      setAuthLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setData(emptyData())
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [resolveSession])

  // Live updates: admin payment add kare to company ki screen khud refresh ho.
  // RLS realtime par bhi lagta hai, is liye company ko sirf apne records ke events milte hain.
  useEffect(() => {
    if (!session) return
    const pending = new Set()
    let timer
    const channel = supabase.channel('db-changes')
    ;TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        pending.add(table)
        clearTimeout(timer)
        timer = setTimeout(() => {
          const tables = [...pending]
          pending.clear()
          reload(...tables)
        }, 400)
      })
    })
    channel.subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [session, reload])

  const login = async (email, password, remember) => {
    setRememberSession(remember)
    const { data: auth, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return { error: friendly(error) }
    const res = await resolveSession(auth.session)
    if (res.error) await supabase.auth.signOut()
    return res
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  // ---------- CRUD (null / false wapis = error, jo toast mein dikh jata hai) ----------

  const add = useCallback(
    // onError diya ho to toast ki jagah error message wapis milta hai (bulk upload ke liye)
    async (table, item, { onError } = {}) => {
      const { data: row, error } = await supabase.from(table).insert(item).select('*').single()
      if (error && onError) {
        console.error(error)
        onError(friendly(error))
        return null
      }
      if (error) return fail(error)
      setData((d) => ({ ...d, [table]: [row, ...d[table]] }))
      return row
    },
    [fail]
  )

  const update = useCallback(
    async (table, id, patch) => {
      const { data: row, error } = await supabase.from(table).update(patch).eq('id', id).select('*').single()
      if (error) return fail(error)
      setData((d) => ({ ...d, [table]: d[table].map((r) => (r.id === id ? row : r)) }))
      return row
    },
    [fail]
  )

  const remove = useCallback(
    async (table, id) => {
      const { data: rows, error } = await supabase.from(table).delete().eq('id', id).select('id')
      if (error) return fail(error)
      if (!rows.length) return fail({ message: '0 rows' })
      setData((d) => ({ ...d, [table]: d[table].filter((r) => r.id !== id) }))
      return true
    },
    [fail]
  )

  // Company delete par database cascade se saara related data delete hota hai
  const removeCompany = useCallback(
    async (id) => {
      const ok = await remove('companies', id)
      if (ok) await loadAll()
      return ok
    },
    [remove, loadAll]
  )

  // Company ka login account (Supabase Auth user). Profile trigger email se company link kar deta hai.
  const createLogin = useCallback(
    async (email, password, fullName) => {
      // Verification email ka link company ko login page par wapis laata hai
      const { error } = await signupClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/login` },
      })
      if (error) return fail(error)
      return true
    },
    [fail]
  )

  const value = {
    ...data,
    data,
    session,
    authLoading,
    login,
    logout,
    add,
    update,
    remove,
    removeCompany,
    createLogin,
    reload: loadAll,
    notify,
    toast,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
