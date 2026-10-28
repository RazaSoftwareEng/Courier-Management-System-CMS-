import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, signupClient, setRememberSession } from '../lib/supabase'

// Saara data Supabase se aata hai. RLS ki wajah se company ko sirf apna data milta hai,
// admin ko sab kuch. Pages isi context ke add/update/remove use karte hain.

const TABLES = ['companies', 'customers', 'parcels', 'bank_accounts', 'payment_requests', 'payments', 'rates', 'riders']
const SELECT = { parcels: '*, parcel_history(status, note, created_at)' }
const DEFAULT_SETTINGS = { system_name: 'CourierPro', support_phone: '', commission_percent: 0 }

const emptyData = () => ({ ...Object.fromEntries(TABLES.map((t) => [t, []])), settings: DEFAULT_SETTINGS })

const normalize = (table, row) => {
  if (table !== 'parcels') return row
  const { parcel_history, ...parcel } = row
  const history = [...(parcel_history || [])]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((h) => ({ status: h.status, note: h.note, at: h.created_at }))
  return { ...parcel, history }
}

const friendly = (error) => {
  const msg = error?.message || 'Kuch ghalat ho gaya'
  if (msg.includes('Invalid login credentials')) return 'Email ya password ghalat hai'
  if (msg.includes('Email not confirmed')) return 'Email abhi confirm nahi hui'
  if (msg.includes('riders_cnic_key')) return 'Is CNIC ka rider pehle se maujood hai'
  if (msg.includes('riders_phone_key')) return 'Is phone number ka rider pehle se maujood hai'
  if (msg.includes('duplicate key')) return 'Ye record pehle se maujood hai'
  if (msg.includes('violates check constraint')) {
    // 004_validation.sql ke constraint names se
    const checks = {
      phone_fmt: 'Phone 03XXXXXXXXX format mein hona chahiye',
      cnic_fmt: 'CNIC 35202-1234567-1 format mein hona chahiye',
      vehicle_fmt: 'Bike number LEA-1234 format mein hona chahiye',
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
    let q = supabase.from(table).select(SELECT[table] || '*')
    q = table === 'rates' ? q.order('city') : q.order('created_at', { ascending: false })
    const { data: rows, error } = await q
    if (error) throw error
    return rows.map((r) => normalize(table, r))
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
      if (profile.role === 'rider') {
        if (!profile.rider_id) return { error: 'Ye account kisi rider se link nahi hai. Admin se rabta karein.' }
        const { data: rider } = await supabase.from('riders').select('name').eq('id', profile.rider_id).maybeSingle()
        // my_rider_id() sirf Active rider deta hai
        if (!rider) return { error: 'Aapka rider account active nahi hai. Admin se rabta karein.' }
        companyName = rider.name
      }

      await loadAll()
      const s = {
        role: profile.role,
        company_id: profile.company_id,
        rider_id: profile.rider_id,
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

  // Live updates: admin parcel status badle ya request pay kare to dusri screen khud refresh ho.
  // RLS realtime par bhi lagta hai, is liye company ko sirf apne records ke events milte hain.
  useEffect(() => {
    if (!session) return
    const pending = new Set()
    let timer
    const channel = supabase.channel('db-changes')
    ;['parcels', 'parcel_history', 'payment_requests', 'payments', 'bank_accounts', 'companies', 'riders'].forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        pending.add(table === 'parcel_history' ? 'parcels' : table)
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
      const { data: row, error } = await supabase.from(table).insert(item).select(SELECT[table] || '*').single()
      if (error && onError) {
        console.error(error)
        onError(friendly(error))
        return null
      }
      if (error) return fail(error)
      const record = normalize(table, row)
      setData((d) => ({ ...d, [table]: [record, ...d[table]] }))
      return record
    },
    [fail]
  )

  const update = useCallback(
    async (table, id, patch) => {
      const { data: row, error } = await supabase.from(table).update(patch).eq('id', id).select(SELECT[table] || '*').single()
      if (error) return fail(error)
      const record = normalize(table, row)
      setData((d) => ({ ...d, [table]: d[table].map((r) => (r.id === id ? record : r)) }))
      return record
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

  // Company / rider ka login account (Supabase Auth user). Profile trigger email se company ya rider link kar deta hai.
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

  const refetchParcel = useCallback(
    async (parcelId) => {
      const { data: row, error } = await supabase.from('parcels').select(SELECT.parcels).eq('id', parcelId).single()
      if (error) return fail(error)
      setData((d) => ({ ...d, parcels: d.parcels.map((p) => (p.id === parcelId ? normalize('parcels', row) : p)) }))
      return true
    },
    [fail]
  )

  const updateParcelStatus = useCallback(
    async (parcelId, status, note) => {
      const { error } = await supabase.rpc('update_parcel_status', { p_parcel_id: parcelId, p_status: status, p_note: note || null })
      if (error) return fail(error)
      return refetchParcel(parcelId)
    },
    [fail, refetchParcel]
  )

  // Rider ka apna status update (sirf agla step; database check karta hai)
  const riderUpdateStatus = useCallback(
    async (parcelId, status, note, codReceived) => {
      const { error } = await supabase.rpc('rider_update_status', {
        p_parcel_id: parcelId,
        p_status: status,
        p_note: note || null,
        p_cod_received: !!codReceived,
      })
      if (error) return fail(error)
      return refetchParcel(parcelId)
    },
    [fail, refetchParcel]
  )

  // kind: 'pickup' ya 'delivery'; riderId null = rider hata dena
  const assignRider = useCallback(
    async (parcelId, riderId, kind = 'delivery') => {
      const { error } = await supabase.rpc('assign_rider', { p_parcel_id: parcelId, p_rider_id: riderId || null, p_kind: kind })
      if (error) return fail(error)
      return refetchParcel(parcelId)
    },
    [fail, refetchParcel]
  )

  const markRequestPaid = useCallback(
    async (requestId, reference, note) => {
      const { error } = await supabase.rpc('mark_request_paid', { p_request_id: requestId, p_reference: reference, p_note: note || null })
      if (error) return fail(error)
      await reload('payment_requests', 'payments')
      return true
    },
    [fail, reload]
  )

  const updateSettings = useCallback(
    async (patch) => {
      const { data: row, error } = await supabase.from('settings').update(patch).eq('id', 1).select('*').single()
      if (error) return fail(error)
      setData((d) => ({ ...d, settings: row }))
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
    riderUpdateStatus,
    updateParcelStatus,
    assignRider,
    markRequestPaid,
    updateSettings,
    reload: loadAll,
    notify,
    toast,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
