import { useEffect } from 'react'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useStore } from '../store/StoreContext'

const statusStyles = {
  // statements / companies
  Pending: 'bg-amber-100 text-amber-800',
  Paid: 'bg-emerald-100 text-emerald-700',
  Active: 'bg-emerald-100 text-emerald-700',
  Suspended: 'bg-rose-100 text-rose-700',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  )
}

const tones = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600',
  slate: 'bg-slate-100 text-slate-600',
  orange: 'bg-orange-50 text-orange-600',
}

export function StatCard({ label, value, icon: Icon, tone = 'indigo', hint }) {
  return (
    <div className="card h-full min-w-0 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-snug text-slate-500">{label}</p>
        {Icon && (
          <div className={`shrink-0 rounded-lg p-2 ${tones[tone]}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-xl font-semibold text-slate-900 sm:text-2xl" title={typeof value === 'string' ? value : undefined}>
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Modal({ open, title, onClose, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Modal khula ho to peeche ka page scroll na ho
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  if (!open) return null
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-6xl' }[size]
  // Mobile par neeche se khulne wali sheet, bari screen par beech mein; height screen se zyada nahi, andar scroll
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl ${width}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="truncate pr-2 text-base font-semibold sm:text-lg">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Delete', onConfirm, onClose }) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className="btn-danger"
          onClick={async () => {
            onClose()
            await onConfirm()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function Toast() {
  const { toast } = useStore()
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div key={toast.key} className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      {ok ? <CheckCircle2 size={18} className="text-emerald-400" /> : <AlertCircle size={18} className="text-rose-400" />}
      {toast.message}
    </div>
  )
}

export function Section({ title, action, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function IconButton({ icon: Icon, title, onClick, tone = 'slate' }) {
  const color = { slate: 'hover:text-indigo-600', rose: 'hover:text-rose-600', emerald: 'hover:text-emerald-600' }[tone]
  return (
    <button title={title} onClick={onClick} className={`rounded-md p-1.5 text-slate-400 hover:bg-slate-100 ${color}`}>
      <Icon size={16} />
    </button>
  )
}
