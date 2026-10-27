// Form fields ke rules. Patterns supabase/migrations/004_validation.sql ke check constraints se match karte hain.
// normalize: user ka likha hua standard format mein (e.g. "+92 300-1234567" -> "03001234567")

const digits = (v) => v.replace(/\D/g, '')

export const RULES = {
  personName: {
    maxLength: 60,
    normalize: (v) => v.trim().replace(/\s+/g, ' '),
    pattern: /^[A-Za-z][A-Za-z .'-]*$/,
    message: 'Sirf English letters aur space (max 60)',
  },
  name: { maxLength: 80, normalize: (v) => v.trim().replace(/\s+/g, ' ') },
  phone: {
    maxLength: 15,
    inputMode: 'tel',
    placeholder: '03001234567',
    normalize: (v) => {
      let d = v.replace(/[\s-]/g, '')
      if (d.startsWith('+92')) d = '0' + d.slice(3)
      else if (d.startsWith('92') && d.length === 12) d = '0' + d.slice(2)
      return d
    },
    pattern: /^03\d{9}$/,
    message: 'Mobile number 03XXXXXXXXX (11 digits)',
  },
  cnic: {
    maxLength: 15,
    inputMode: 'numeric',
    placeholder: '35202-1234567-1',
    normalize: (v) => {
      const d = digits(v)
      return d.length === 13 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : v.trim()
    },
    pattern: /^\d{5}-\d{7}-\d$/,
    message: 'CNIC 13 digits: 35202-1234567-1',
  },
  vehicle: {
    maxLength: 12,
    placeholder: 'LEA-1234',
    normalize: (v) => v.trim().toUpperCase().replace(/[\s-]+/g, '-'),
    pattern: /^[A-Z]{2,4}-\d{2,4}(-\d{1,4})?$/,
    message: 'Bike number: LEA-1234 ya LE-21-1234',
  },
  iban: {
    maxLength: 30,
    placeholder: 'PK36MEZN0001234567890123',
    normalize: (v) => v.replace(/\s/g, '').toUpperCase(),
    pattern: /^PK\d{2}[A-Z]{4}\d{16}$/,
    message: 'IBAN 24 characters: PK + 2 digits + 4 letters + 16 digits',
  },
  accountNo: {
    maxLength: 24,
    inputMode: 'numeric',
    normalize: (v) => v.replace(/[\s-]/g, ''),
    pattern: /^\d{8,20}$/,
    message: 'Account number 8 se 20 digits',
  },
  email: {
    maxLength: 100,
    normalize: (v) => v.trim().toLowerCase(),
    pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
    message: 'Sahi email likhein, e.g. name@company.com',
  },
  address: { maxLength: 200, normalize: (v) => v.trim() },
  city: { maxLength: 40, normalize: (v) => v.trim() },
  reference: { maxLength: 50, normalize: (v) => v.trim() },
  text: { maxLength: 200, normalize: (v) => v.trim() },
}

// { value, error } wapis; khaali optional field valid hai
export function check(ruleName, raw, { required = false, label = 'Ye field' } = {}) {
  const rule = RULES[ruleName] || {}
  const value = rule.normalize ? rule.normalize(String(raw ?? '')) : String(raw ?? '').trim()
  if (!value) return { value, error: required ? `${label} zaroori hai` : null }
  if (rule.maxLength && value.length > rule.maxLength) return { value, error: `Zyada se zyada ${rule.maxLength} characters` }
  if (rule.pattern && !rule.pattern.test(value)) return { value, error: rule.message }
  return { value, error: null }
}

export function checkNumber(raw, { min, max, label = 'Value', required = true } = {}) {
  if (raw === '' || raw === null || raw === undefined) return { value: 0, error: required ? `${label} zaroori hai` : null }
  const n = Number(raw)
  if (!Number.isFinite(n)) return { value: n, error: `${label} sahi number nahi` }
  if (min !== undefined && n < min) return { value: n, error: `${label} kam az kam ${min.toLocaleString()}` }
  if (max !== undefined && n > max) return { value: n, error: `${label} zyada se zyada ${max.toLocaleString()}` }
  return { value: n, error: null }
}

// Numbers ki limits (database constraints ke mutabiq)
export const LIMITS = {
  weight: { min: 0.1, max: 100 },
  cod: { min: 0, max: 1000000 },
  charges: { min: 0, max: 50000 },
  amount: { min: 1, max: 10000000 },
  commission: { min: 0, max: 100 },
}
