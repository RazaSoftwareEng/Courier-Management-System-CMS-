import { useState } from 'react'
import { RULES, check, checkNumber } from '../lib/validation'

// fields: [{ name, label, type: text|email|number|select|textarea|checkbox|password, options, required, full, placeholder,
//            rule (lib/validation RULES key), min, max, minLength, suggestions (datalist) }]
export default function EntityForm({ fields, initial = {}, onSubmit, onCancel, submitLabel = 'Save' }) {
  const [values, setValues] = useState(() => {
    const v = {}
    fields.forEach((f) => {
      v[f.name] = initial[f.name] ?? f.default ?? (f.type === 'checkbox' ? false : '')
    })
    return v
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => (e[name] ? { ...e, [name]: null } : e))
  }

  const validate = (f, raw) => {
    if (f.type === 'number') return checkNumber(raw, { min: f.min, max: f.max, label: f.label, required: f.required })
    if (f.type === 'checkbox' || f.type === 'select') return { value: raw, error: f.required && !raw ? `${f.label} select karein` : null }
    if (f.type === 'password') {
      const error = f.required && !raw ? `${f.label} zaroori hai` : raw && f.minLength && raw.length < f.minLength ? `Kam az kam ${f.minLength} characters` : null
      return { value: raw, error }
    }
    return check(f.rule || 'text', raw, { required: f.required, label: f.label })
  }

  // Field chhorte hi format theek karna (e.g. CNIC mein dashes) aur error dikhana
  const onBlur = (f) => {
    if (f.type === 'select' || f.type === 'checkbox' || f.type === 'password') return
    const { value, error } = validate(f, values[f.name])
    if (f.type !== 'number') setValues((v) => ({ ...v, [f.name]: value }))
    setErrors((e) => ({ ...e, [f.name]: error }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const out = {}
    const errs = {}
    fields.forEach((f) => {
      const { value, error } = validate(f, values[f.name])
      out[f.name] = f.type === 'number' ? Number(value) || 0 : value
      // Khaali optional text field database mein null jaye
      if (!f.required && out[f.name] === '' && f.type !== 'select') out[f.name] = null
      if (error) errs[f.name] = error
    })
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return

    setBusy(true)
    try {
      await onSubmit(out)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const rule = RULES[f.rule] || {}
          const err = errors[f.name]
          const cls = `input ${err ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}`
          const common = {
            className: cls,
            value: values[f.name] ?? '',
            onChange: (e) => set(f.name, e.target.value),
            onBlur: () => onBlur(f),
            'aria-invalid': !!err,
          }
          return (
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
                    <select {...common}>
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
                    <textarea {...common} rows={3} maxLength={rule.maxLength} placeholder={f.placeholder} />
                  ) : (
                    <input
                      {...common}
                      type={f.type || 'text'}
                      step={f.type === 'number' ? 'any' : undefined}
                      min={f.min}
                      max={f.max}
                      maxLength={f.type === 'number' ? undefined : f.maxLength || rule.maxLength}
                      inputMode={rule.inputMode}
                      placeholder={f.placeholder || rule.placeholder}
                      list={f.suggestions ? `dl-${f.name}` : undefined}
                    />
                  )}
                  {f.suggestions && (
                    <datalist id={`dl-${f.name}`}>
                      {f.suggestions.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  )}
                  {err && <span className="mt-1 block text-xs text-rose-600">{err}</span>}
                </>
              )}
            </label>
          )
        })}
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
