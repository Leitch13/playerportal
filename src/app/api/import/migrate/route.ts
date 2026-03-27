import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface MigrateRow {
  first_name?: string
  last_name?: string
  date_of_birth?: string
  parent_name?: string
  parent_email?: string
  parent_phone?: string
  group_name?: string
  medical_info?: string
  age_group?: string
  _rowIndex: number
}

interface ImportStats {
  players_imported: number
  players_skipped: number
  parents_created: number
  groups_created: number
  enrolments_created: number
  errors: { row: number; error: string }[]
}

function parseDOB(dob: string): string | null {
  // Try DD/MM/YYYY
  let match = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  // Try YYYY-MM-DD (already ISO)
  match = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return dob
  // Try DD-MM-YYYY
  match = dob.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return null
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

  let body: { rows: MigrateRow[]; classNames?: string[]; sendWelcomeEmails?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { rows, classNames = [], sendWelcomeEmails = false } = body
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const stats: ImportStats = {
    players_imported: 0,
    players_skipped: 0,
    parents_created: 0,
    groups_created: 0,
    enrolments_created: 0,
    errors: [],
  }

  // Pre-fetch existing training groups
  const { data: existingGroups } = await supabase
    .from('training_groups')
    .select('id, name')
    .eq('organisation_id', orgId)

  const groupMap = new Map<string, string>()
  if (existingGroups) {
    for (const g of existingGroups) {
      groupMap.set(g.name.toLowerCase(), g.id)
    }
  }

  // Create any new groups from the classes file
  for (const className of classNames) {
    const key = className.toLowerCase().trim()
    if (key && !groupMap.has(key)) {
      const { data: newGroup, error: groupError } = await supabase
        .from('training_groups')
        .insert({
          name: className.trim(),
          organisation_id: orgId,
        })
        .select('id')
        .single()

      if (!groupError && newGroup) {
        groupMap.set(key, newGroup.id)
        stats.groups_created++
      }
    }
  }

  // Pre-fetch existing parents in this org
  const { data: existingParents } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('organisation_id', orgId)
    .eq('role', 'parent')

  const parentMap = new Map<string, string>()
  if (existingParents) {
    for (const p of existingParents) {
      if (p.email) parentMap.set(p.email.toLowerCase(), p.id)
    }
  }

  // Pre-fetch existing players for duplicate detection
  const { data: existingPlayers } = await supabase
    .from('players')
    .select('id, first_name, last_name, date_of_birth')
    .eq('organisation_id', orgId)

  const playerDupSet = new Set<string>()
  if (existingPlayers) {
    for (const p of existingPlayers) {
      const key = `${(p.first_name || '').toLowerCase()}|${(p.last_name || '').toLowerCase()}|${p.date_of_birth || ''}`
      playerDupSet.add(key)
    }
  }

  // Process rows
  for (const row of rows) {
    try {
      const firstName = (row.first_name || '').trim()
      const lastName = (row.last_name || '').trim()

      if (!firstName || !lastName) {
        stats.errors.push({
          row: row._rowIndex,
          error: 'Missing first name or last name',
        })
        continue
      }

      // Parse DOB
      let dateOfBirth: string | null = null
      if (row.date_of_birth) {
        dateOfBirth = parseDOB(row.date_of_birth.trim())
      }

      // Duplicate check
      const dupKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dateOfBirth || ''}`
      if (playerDupSet.has(dupKey)) {
        stats.players_skipped++
        continue
      }

      // Look up or create parent
      let parentId: string | null = null
      const parentEmail = (row.parent_email || '').trim().toLowerCase()

      if (parentEmail) {
        if (parentMap.has(parentEmail)) {
          parentId = parentMap.get(parentEmail)!
        } else {
          const { data: newParent, error: parentError } = await supabase
            .from('profiles')
            .insert({
              email: parentEmail,
              full_name: (row.parent_name || '').trim() || parentEmail,
              phone: (row.parent_phone || '').trim() || null,
              role: 'parent',
              organisation_id: orgId,
            })
            .select('id')
            .single()

          if (!parentError && newParent) {
            parentId = newParent.id
            parentMap.set(parentEmail, newParent.id)
            stats.parents_created++
          } else {
            // Try to find existing parent across orgs
            const { data: anyParent } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', parentEmail)
              .single()

            if (anyParent) {
              parentId = anyParent.id
              parentMap.set(parentEmail, anyParent.id)
            }
          }
        }
      }

      // Create player
      const fullName = `${firstName} ${lastName}`
      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert({
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          date_of_birth: dateOfBirth,
          age_group: (row.age_group || '').trim() || null,
          medical_info: (row.medical_info || '').trim() || null,
          parent_id: parentId,
          organisation_id: orgId,
        })
        .select('id')
        .single()

      if (playerError) {
        stats.errors.push({ row: row._rowIndex, error: playerError.message })
        continue
      }

      // Mark as seen for duplicate detection
      playerDupSet.add(dupKey)
      stats.players_imported++

      // Create/find group and enrolment
      const groupName = (row.group_name || '').trim()
      if (groupName && newPlayer) {
        const groupKey = groupName.toLowerCase()
        let groupId = groupMap.get(groupKey)

        // Create group if it does not exist
        if (!groupId) {
          const { data: newGroup, error: groupError } = await supabase
            .from('training_groups')
            .insert({
              name: groupName,
              organisation_id: orgId,
            })
            .select('id')
            .single()

          if (!groupError && newGroup) {
            groupId = newGroup.id
            groupMap.set(groupKey, newGroup.id)
            stats.groups_created++
          }
        }

        if (groupId) {
          const { error: enrolmentError } = await supabase
            .from('enrolments')
            .insert({
              player_id: newPlayer.id,
              training_group_id: groupId,
              status: 'active',
            })

          if (!enrolmentError) {
            stats.enrolments_created++
          } else {
            stats.errors.push({
              row: row._rowIndex,
              error: `Player imported but enrolment failed: ${enrolmentError.message}`,
            })
          }
        }
      }
    } catch (err) {
      stats.errors.push({
        row: row._rowIndex,
        error: (err as Error).message || 'Unknown error',
      })
    }
  }

  // Note: sendWelcomeEmails is accepted but welcome email sending
  // would be handled by a separate background job / Supabase edge function.
  // The flag is stored for future implementation.
  void sendWelcomeEmails

  return NextResponse.json(stats)
}
