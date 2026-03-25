import { createClient } from '@/lib/supabase/client'

export type AuditAction =
  | 'player.created' | 'player.updated' | 'player.deleted'
  | 'group.created' | 'group.updated' | 'group.deleted'
  | 'enrolment.created' | 'enrolment.cancelled'
  | 'payment.created' | 'payment.refunded'
  | 'announcement.sent'
  | 'settings.updated'
  | 'team.invited' | 'team.removed'
  | 'export.downloaded'
  | 'waitlist.offered' | 'waitlist.removed'
  | 'trial.confirmed' | 'trial.cancelled'
  | 'reminder.sent'

export async function logAudit(params: {
  action: AuditAction
  entityType: string
  entityId?: string
  details?: Record<string, unknown>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: orgId } = await supabase.rpc('get_my_org')

  await supabase.from('audit_log').insert({
    organisation_id: orgId,
    user_id: user?.id,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId || null,
    details: params.details || {},
  })
}
