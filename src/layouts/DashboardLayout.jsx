import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Menu, LogOut, Truck, X, ChevronDown } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Toast } from '../components/ui'

// Sidebar themes: dark (admin/rider) aur light (company, seller-center style)
const themes = {
  dark: {
    shell: 'bg-slate-900 text-slate-300',
    brand: 'text-white',
    sub: 'text-slate-400',
    link: (active) => (active ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'),
    child: (active) => (active ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'),
    group: (inside) => `hover:bg-slate-800 hover:text-white ${inside ? 'text-white' : ''}`,
    rail: 'ml-5 border-l border-slate-700 pl-3',
    footer: 'border-slate-800',
    logout: 'hover:bg-slate-800 hover:text-white',
  },
  light: {
    shell: 'border-r border-slate-200 bg-white text-slate-700',
    brand: 'text-slate-900',
    sub: 'text-slate-500',
    link: (active) => (active ? 'bg-indigo-50 font-medium text-indigo-600' : 'hover:bg-slate-50 hover:text-indigo-600'),
    child: (active) =>
      active ? '-mx-3 rounded-none border-l-4 border-indigo-600 bg-indigo-50 pl-11 font-semibold text-indigo-600' : 'pl-8 hover:bg-slate-50 hover:text-indigo-600',
    group: (inside) => `hover:bg-slate-50 ${inside ? 'text-indigo-600' : 'hover:text-indigo-600'}`,
    rail: '',
    footer: 'border-slate-200',
    logout: 'hover:bg-slate-50 hover:text-indigo-600',
  },
}

const linkClass = (fn) => ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${fn(isActive)}`

// Nav item jis ke children hon woh dropdown banta hai; child route active ho to khula rehta hai
function NavGroup({ item, theme, onNavigate }) {
  const { pathname } = useLocation()
  const inside = pathname.startsWith(item.to)
  const [expanded, setExpanded] = useState(inside)

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${theme.group(inside)}`}
      >
        <item.icon size={18} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown size={16} className={`transition ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className={`mt-1 space-y-1 ${theme.rail}`}>
          {item.children.map((child) => (
            <NavLink key={child.to} to={child.to} onClick={onNavigate} className={linkClass(theme.child)}>
              {theme.rail && <child.icon size={16} />}
              <span className="flex-1">{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ nav, title, userName, userRole, variant = 'dark' }) {
  const theme = themes[variant]
  const [open, setOpen] = useState(false)
  const { logout, settings } = useStore()
  const navigate = useNavigate()

  const sidebar = (
    <div className={`flex h-full flex-col ${theme.shell}`}>
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="rounded-lg bg-indigo-600 p-2 text-white">
          <Truck size={20} />
        </div>
        <div>
          <p className={`font-semibold ${theme.brand}`}>{settings.system_name}</p>
          <p className={`text-xs ${theme.sub}`}>{title}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) =>
          item.children ? (
            <NavGroup key={item.to} item={item} theme={theme} onNavigate={() => setOpen(false)} />
          ) : (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={linkClass(theme.link)}>
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 && <span className="rounded-full bg-amber-500 px-2 text-xs font-semibold text-white">{item.badge}</span>}
            </NavLink>
          ),
        )}
      </nav>
      <div className={`border-t p-3 ${theme.footer}`}>
        <button
          onClick={async () => {
            await logout()
            navigate('/login')
          }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${theme.logout}`}
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
