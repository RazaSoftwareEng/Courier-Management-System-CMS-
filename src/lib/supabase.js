import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key)

// "Remember me" on ho to login localStorage mein (browser band karne ke baad bhi),
// warna sessionStorage mein (tab band hote hi logout)
const REMEMBER_KEY = 'ccms-remember-session'

export const setRememberSession = (remember) => {
  try {
    if (remember) localStorage.setItem(REMEMBER_KEY, '1')
    else localStorage.removeItem(REMEMBER_KEY)
  } catch {
    // storage blocked
  }
}

const authStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k) ?? sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      const remember = localStorage.getItem(REMEMBER_KEY) === '1'
      ;(remember ? localStorage : sessionStorage).setItem(k, v)
      ;(remember ? sessionStorage : localStorage).removeItem(k)
    } catch {
      // storage blocked
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k)
      sessionStorage.removeItem(k)
    } catch {
      // storage blocked
    }
  },
}

export const supabase = supabaseConfigured ? createClient(url, key, { auth: { storage: authStorage } }) : null

// Admin jab nayi company ka login banata hai to ye alag client use hota hai,
// taa ke admin ka apna session replace na ho.
export const signupClient = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'ccms-signup' } })
  : null
