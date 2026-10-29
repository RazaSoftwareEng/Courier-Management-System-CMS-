import { supabase } from './supabase'
import { LINE_COLUMNS } from '../data/statementColumns'

// Statements store mein load nahi hote (lines hazaron mein ho sakti hain), seedha yahan se parhe jate hain

export async function fetchStatements(companyId) {
  let q = supabase.from('statements').select('*').order('period_end', { ascending: false })
  if (companyId) q = q.eq('company_id', companyId)
  const { data, error } = await q
  if (error) throw error
  return data
}

// Supabase ek request mein 1000 rows tak deta hai, is liye pages mein
export async function fetchLines(statementId) {
  const cols = LINE_COLUMNS.map((c) => c.key).join(',')
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('statement_lines').select(cols).eq('statement_id', statementId).order('tracking_no').range(from, from + 999)
    if (error) throw error
    all.push(...data)
    if (data.length < 1000) return all
  }
}

export async function importStatement(companyId, { number, start, end }, lines) {
  const { error } = await supabase.rpc('import_statement', { p_company_id: companyId, p_number: number, p_start: start, p_end: end, p_lines: lines })
  if (error) throw error
}

export async function deleteStatement(id) {
  const { error } = await supabase.from('statements').delete().eq('id', id)
  if (error) throw error
}

export async function markStatementPaid(id, paymentId) {
  const { error } = await supabase.from('statements').update({ status: 'Paid', payment_id: paymentId, paid_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
