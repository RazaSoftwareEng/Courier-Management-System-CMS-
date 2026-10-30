import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { homeFor } from '../lib/utils'

// Sirf email yaad rakhi jati hai. Password browser ka password manager save karta hai
// (autocomplete attributes ki wajah se), aur "Remember me" login session ko yaad rakhta hai.
const REMEMBER_KEY = 'ccms-remember'

const loadRemembered = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) || ''
  } catch {
    return ''
  }
}

export default function Login() {
  const { login, settings } = useStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState(loadRemembered)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => !!loadRemembered())
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await login(email, password, remember)
    setBusy(false)
    if (res.error) return setError(res.error)

    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim())
      else localStorage.removeItem(REMEMBER_KEY)
    } catch {
      // storage blocked
    }
    navigate(homeFor(res.session.role))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-white">
          <div className="rounded-2xl bg-indigo-600 p-3">
            <Truck size={32} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">{settings.system_name}</h1>
          <p className="text-sm text-indigo-200">Courier Company Management System</p>
        </div>

        <form onSubmit={submit} className="card space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
            <p className="text-sm text-slate-500">Admin aur company isi form se login karein</p>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email</span>
            <input
              className="input"
              type="email"
              name="email"
              autoComplete="username"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember me
          </label>

          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

          <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />} Login
          </button>
        </form>
      </div>
    </div>
  )
}
