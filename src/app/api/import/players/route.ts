import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface PlayerRecord {
  first_name: string
  last_name: string
  date_of_birth?: string
  age_group?: string
  parent_email?: string
  parent_name?: string
  parent_phone?: string
  group_name?: string
  medical_info?: string
  _rowIndex: number
}

interface ImportError {
  row: number
  error: string
}

function parseDOB(dob: string): string | null {
  const match = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: orgId } = await supabase.rpc('get_my_org')
  if (!orgId) {
    return NextResponse.json({ error: 'No organisation found' }, { status: 400 })
  }

  let body: { players: PlayerRecord[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { players } = body
  if (!Array.isArray(players) || players.length === 0) {
    return NextResponse.json({ error: 'No players provided' }, { status: 400 })
  }

  let imported = 0
  const errors: ImportError[] = []

  // Pre-fetch training groups for this org
  const { data: trainingGroups } = await supabase
    .from('training_groups')
    .select('id, name')
    .eq('organisation_id', orgId)

  const groupMap = new Map<string, string>()
  if (trainingGroups) {
    for (const g of trainingGroups) {
      groupMap.set(g.name.toLowerCase(), g.id)
    }
  }

  // Process in chunks of 10
  const chunkSize = 10
  for (let i = 0; i < players.length; i += chunkSize) {
    const chunk = players.slice(i, i + chunkSize)

    for (const player of chunk) {
      try {
        let parentId: string | null = null

        // Look up or create parent if parent_email provided
        if (player.parent_email) {
          const { data: existingParent } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', player.parent_email)
            .eq('organisation_id', orgId)
            .single()

          if (existingParent) {
            parentId = existingParent.id
          } else {
            // Create a new parent profile via auth invite or direct insert
            const { data: newParent, error: parentError } = await supabase
              .from('profiles')
              .insert({
                email: player.parent_email,
                full_name: player.parent_name || player.parent_email,
                phone: player.parent_phone || null,
                role: 'parent',
                organisation_id: orgId,
              })
              .select('id')
              .single()

            if (parentError) {
              // Parent might exist in another org or there could be a constraint
              // Try fetching without org filter
              const { data: anyParent } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', player.parent_email)
                .single()

              if (anyParent) {
                parentId = anyParent.id
              }
              // If still no parent, continue without one
            } else if (newParent) {
              parentId = newParent.id
            }
          }
        }

        // Parse date_of_birth
        let dateOfBirth: string | null = null
        if (player.date_of_birth) {
          dateOfBirth = parseDOB(player.date_of_birth)
        }

        // Create player record
        const fullName = `${player.first_name} ${player.last_name}`
        const { data: newPlayer, error: playerError } = await supabase
          .from('players')
          .insert({
            first_name: player.first_name,
            last_name: player.last_name,
            full_name: fullName,
            date_of_birth: dateOfBirth,
            age_group: player.age_group || null,
            medical_info: player.medical_info || null,
            parent_id: parentId,
            organisation_id: orgId,
          })
          .select('id')
          .single()

        if (playerError) {
          errors.push({ row: player._rowIndex, error: playerError.message })
          continue
        }

        // Create enrolment if group_name provided
        if (player.group_name && newPlayer) {
          const groupId = groupMap.get(player.group_name.toLowerCase())
          if (groupId) {
            const { error: enrolmentError } = await supabase
              .from('enrolments')
              .insert({
                player_id: newPlayer.id,
                training_group_id: groupId,
                status: 'active',
              })

            if (enrolmentError) {
              // Player was created but enrolment failed - log but count as imported
              errors.push({
                row: player._rowIndex,
                error: `Player imported but enrolment failed: ${enrolmentError.message}`,
              })
            }
          }
          // If group not found, silently skip enrolment - player is still imported
        }

        imported++
      } catch (err) {
        errors.push({
          row: player._rowIndex,
          error: (err as Error).message || 'Unknown error',
        })
      }
    }
  }

  return NextResponse.json({ imported, errors })
}
