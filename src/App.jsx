import { Routes, Route, Navigate } from 'react-router-dom'
import { LayoutDashboard, Users, Wallet, Landmark, Loader2, PiggyBank, FileText } from 'lucide-react'
import { useStore } from './store/StoreContext'
import { supabaseConfigured } from './lib/supabase'
import { homeFor } from './lib/utils'
import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/AdminDashboard'
import Companies from './pages/admin/Companies'
import Payments from './pages/admin/Payments'
import CompanyDashboard from './pages/company/CompanyDashboard'
import CompanyBank from './pages/company/CompanyBank'
import CompanyStatements from './pages/company/CompanyStatements'

function RequireRole({ role, children }) {
  const { session } = useStore()
  if (!session || session.role !== role) return <Navigate to="/login" replace />
  return children
}

function FullScreen({ children }) {
  return <div className="flex min-h-screen items-center justify-center p-4 text-center text-slate-500">{children}</div>
}

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/customers', label: 'Customer Profile', icon: Users },
  { to: '/admin/payments', label: 'Payments', icon: Wallet },
]

const companyNav = [
  { to: '/company', label: 'Dashboard', icon: LayoutDashboard, end: true },
  {
    to: '/company/finance',
    label: 'Finance',
    icon: PiggyBank,
    children: [
      { to: '/company/finance/statements', label: 'My Statements', icon: FileText },
      { to: '/company/finance/account', label: 'Account Details', icon: Landmark },
    ],
  },
]

export default function App() {
  const { session, authLoading, companies } = useStore()

  if (!supabaseConfigured) {
    return (
      <FullScreen>
        <div className="card max-w-md p-6">
          <p className="font-semibold text-slate-900">Supabase configure nahi hai</p>
          <p className="mt-2 text-sm">
            Project root mein <code>.env</code> file mein <code>VITE_SUPABASE_URL</code> aur <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> set karein, phir dev server restart karein.
          </p>
        </div>
      </FullScreen>
    )
  }

  if (authLoading) {
    return (
      <FullScreen>
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </FullScreen>
    )
  }

  const company = companies.find((c) => c.id === session?.company_id)

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={homeFor(session.role)} replace /> : <Login />} />

      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <DashboardLayout nav={adminNav} title="Admin Panel" userName="Super Admin" userRole="Administrator" />
          </RequireRole>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="customers" element={<Companies />} />
        <Route path="payments" element={<Payments />} />
      </Route>

      <Route
        path="/company"
        element={
          <RequireRole role="company">
            <DashboardLayout nav={companyNav} variant="light" title="Company Panel" userName={company?.owner_name} userRole={company?.name} />
          </RequireRole>
        }
      >
        <Route index element={<CompanyDashboard />} />
        <Route path="finance" element={<Navigate to="/company/finance/statements" replace />} />
        <Route path="finance/statements" element={<CompanyStatements />} />
        <Route path="finance/account" element={<CompanyBank />} />
      </Route>

      <Route path="*" element={<Navigate to={session ? homeFor(session.role) : '/login'} replace />} />
    </Routes>
  )
}
