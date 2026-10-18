import type { SupabaseClient } from '@supabase/supabase-js'

/** Bookings on this camp (unpaid or paid) with a real parent email missing a backup contact or a date of birth. */
export async function missingDetails(svc: SupabaseClient, campId: string) {
  const { data: rows } = await svc.from('camp_bookings').select('id, parent_name, parent_email, child_name, child_dob, payment_status').eq('camp_id', campId).in('payment_status', ['pending', 'paid'])
  const ids = (rows ?? []).map((r) => r.id as string)
  const { data: backups } = ids.length ? await svc.from('audit_log').select('entity_id').eq('action', 'camp.backup_contact').in('entity_id', ids) : { data: [] }
  const has = new Set((backups ?? []).map((b) => b.entity_id as string))
  return (rows ?? [])
    .filter((r) => r.parent_email && !String(r.parent_email).endsWith('@theplayerportal.net'))
    .map((r) => ({ ...r, needBackup: !has.has(r.id as string), needDob: !r.child_dob }))
    .filter((r) => r.needBackup || r.needDob)
}
