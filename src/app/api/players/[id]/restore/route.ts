/**
 * Sprint 7 — Restore Player API
 *
 * POST /api/players/[id]/restore
 *
 * Behaviour:
 *   1. Auth admin in the player's org.
 *   2. Call restore_player_safe RPC — flips archive flags back to NULL.
 *   3. Write audit_log row.
 *
 * Does NOT:
 *   • Re-enrol the player into any class.
 *   • Reactivate or recreate Stripe subscriptions.
 *   • Resurrect cancelled cancellations rows.
 *   • Bypass capacity protection (Sprint 11 / 078 / 079 RPCs).
 *
 * Rationale per Phase 0 audit: any auto-restore of state risks capacity
 * bypass, Stripe state divergence, and unexpected charges to a family
 * that didn't ask to come back. Admin must deliberately re-enrol after
 * restore. If the parent re-subscribes via the public booking page,
 * the existing webhook auto-enrols them through the standard path.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: playerId } = await ctx.params
    if (!playerId) {
      return NextResponse.json({ ok: false, error: 'player id required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organisation_id')
      .eq('id', user.id)
      .single()
    const role = (profile as { role?: string } | null)?.role
    const orgId = (profile as { organisation_id?: string } | null)?.organisation_id || null
    if (role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Only admins can restore players' }, { status: 403 })
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('restore_player_safe', {
      p_player_id: playerId,
    })

    if (rpcErr) {
      return NextResponse.json({ ok: false, error: `restore_player_safe failed: ${rpcErr.message}` }, { status: 500 })
    }

    const result = rpcData as {
      ok: boolean
      error?: string
      player_id?: string
      player_name?: string
      was_archived?: boolean
    } | null

    if (!result || result.ok === false) {
      const err = result?.error || 'unknown_rpc_failure'
      const status = err === 'forbidden_role' ? 403
        : err === 'unauthorized' ? 401
        : err === 'not_found' ? 404
        : 500
      return NextResponse.json({ ok: false, error: err }, { status })
    }

    await supabase.from('audit_log').insert({
      organisation_id: orgId,
      user_id: user.id,
      action: 'restore_player',
      entity_type: 'player',
      entity_id: playerId,
      details: {
        player_name: result.player_name || null,
        was_archived: result.was_archived === true,
      },
    })

    return NextResponse.json({
      ok: true,
      playerId,
      playerName: result.player_name || null,
      wasArchived: result.was_archived === true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
