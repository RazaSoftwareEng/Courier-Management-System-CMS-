import { useState } from 'react'

// fields: [{ name, label, type: text|email|number|select|textarea|checkbox, options, required, full, placeholder }]
export default function EntityForm({ fields, initial = {}, onSubmit, onCancel, submitLabel = 'Save' }) {
  const [values, setValues] = useState(() => {
    const v = {}
    fields.forEach((f) => {
      v[f.name] = initial[f.name] ?? f.default ?? (f.type === 'checkbox' ? false : '')
    })
    return v
  })

  const [busy, setBusy] = useState(false)
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))

  const submit = async (e) => {
    e.preventDefault()
    const out = { ...values }
    fields.forEach((f) => {
      if (f.type === 'number') out[f.name] = Number(out[f.name]) || 0
    })
    setBusy(true)
    try {
      await onSubmit(out)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.name} className={`block ${f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
            {f.type === 'checkbox' ? (
              <span className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                {f.label}
              </span>
            ) : (
              <>
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  {f.label} {f.required && <span className="text-rose-500">*</span>}
                </span>
                {f.type === 'select' ? (
                  <select className="input" required={f.required} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                    <option value="">Select...</option>
                    {f.options.map((o) => {
                      const opt = typeof o === 'string' ? { value: o, label: o } : o
                      return (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      )
                    })}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea className="input" rows={3} required={f.required} placeholder={f.placeholder} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />
                ) : (
                  <input
                    className="input"
                    type={f.type || 'text'}
                    step={f.type === 'number' ? 'any' : undefined}
                    min={f.min}
                    minLength={f.minLength}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={values[f.name]}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                )}
              </>
            )}
          </label>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
