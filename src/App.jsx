import { Routes, Route, Navigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, Package, HandCoins, Wallet, Landmark, Settings as SettingsIcon, Loader2, Bike, ClipboardList, PiggyBank, FileText } from 'lucide-react'
import { useStore } from './store/StoreContext'
import { supabaseConfigured } from './lib/supabase'
import { homeFor } from './lib/utils'
import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import ParcelsPage from './components/ParcelsPage'
import CustomersPage from './components/CustomersPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import Companies from './pages/admin/Companies'
import PaymentRequests from './pages/admin/PaymentRequests'
import Payments from './pages/admin/Payments'
import Statements from './pages/admin/Statements'
import BankAccounts from './pages/admin/BankAccounts'
import Settings from './pages/admin/Settings'
import Riders from './pages/admin/Riders'
import RiderDashboard from './pages/rider/RiderDashboard'
import RiderParcels from './pages/rider/RiderParcels'
import RiderReport from './pages/rider/RiderReport'
import CompanyBank from './pages/company/CompanyBank'
import CompanyStatements from './pages/company/CompanyStatements'
import CompanyBulkUpload from './pages/company/CompanyBulkUpload'


function RequireRole({ role, children }) {
  const { session } = useStore()
  if (!session || session.role !== role) return <Navigate to="/login" replace />
  return children
}

function FullScreen({ children }) {
  return <div className="flex min-h-screen items-center justify-center p-4 text-center text-slate-500">{children}</div>
}

export default function App() {
  const { session, authLoading, companies, payment_requests } = useStore()

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

  const pendingCount = payment_requests.filter((r) => r.status === 'Pending').length
  const company = companies.find((c) => c.id === session?.company_id)

  const adminNav = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/companies', label: 'Companies', icon: Building2 },
    { to: '/admin/customers', label: 'Customers', icon: Users },
    { to: '/admin/parcels', label: 'Parcels', icon: Package },
    { to: '/admin/payment-requests', label: 'Payment Requests', icon: HandCoins, badge: pendingCount },
    { to: '/admin/payments', label: 'Payments', icon: Wallet },
    { to: '/admin/statements', label: 'Statements', icon: FileText },
    { to: '/admin/riders', label: 'Riders', icon: Bike },
    { to: '/admin/banks', label: 'Bank Accounts', icon: Landmark },
    { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
  ]

  // Filhaal company ko sirf Finance dikhaya ja raha hai
  const companyNav = [
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

  const riderNav = [
    { to: '/rider', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/rider/parcels', label: 'My Parcels', icon: Package },
    { to: '/rider/report', label: 'Daily Report', icon: ClipboardList },
  ]

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
        <Route path="companies" element={<Companies />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="parcels" element={<ParcelsPage />} />
        <Route path="payment-requests" element={<PaymentRequests />} />
        <Route path="payments" element={<Payments />} />
        <Route path="statements" element={<Statements />} />
        <Route path="riders" element={<Riders />} />
        <Route path="banks" element={<BankAccounts />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route
        path="/company"
        element={
          <RequireRole role="company">
            <DashboardLayout nav={companyNav} variant="light" title="Company Panel" userName={company?.owner_name} userRole={company?.name} />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="/company/finance/statements" replace />} />
        <Route path="orders" element={<ParcelsPage companyId={session?.company_id} />} />
        <Route path="orders/import" element={<CompanyBulkUpload />} />
        <Route path="finance" element={<Navigate to="/company/finance/statements" replace />} />
        <Route path="finance/statements" element={<CompanyStatements />} />
        <Route path="finance/account" element={<CompanyBank />} />
      </Route>

      <Route
        path="/rider"
        element={
          <RequireRole role="rider">
            <DashboardLayout nav={riderNav} title="Rider Panel" userName={session?.name} userRole="Rider" />
          </RequireRole>
        }
      >
        <Route index element={<RiderDashboard />} />
        <Route path="parcels" element={<RiderParcels />} />
        <Route path="report" element={<RiderReport />} />
      </Route>

      <Route path="*" element={<Navigate to={session ? homeFor(session.role) : '/login'} replace />} />
    </Routes>
  )
}
