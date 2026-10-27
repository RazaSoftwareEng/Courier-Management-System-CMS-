import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, LogOut, Truck, X } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Toast } from '../components/ui'

export default function DashboardLayout({ nav, title, userName, userRole }) {
  const [open, setOpen] = useState(false)
  const { logout, settings } = useStore()
  const navigate = useNavigate()

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="rounded-lg bg-indigo-600 p-2 text-white">
          <Truck size={20} />
        </div>
        <div>
          <p className="font-semibold text-white">{settings.system_name}</p>
          <p className="text-xs text-slate-400">{title}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`
            }
          >
            <item.icon size={18} />
            <span className="flex-1">{item.label}</span>
            {item.badge > 0 && <span className="rounded-full bg-amber-500 px-2 text-xs font-semibold text-white">{item.badge}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-3">
        <button
          onClick={async () => {
            await logout()
            navigate('/login')
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-800 hover:text-white"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
          <button className="absolute left-66 top-4 text-white" onClick={() => setOpen(false)}>
            <X size={24} />
          </button>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
              <p className="truncate text-xs text-slate-500">{userRole}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700">
              {userName?.[0]}
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  )
}
