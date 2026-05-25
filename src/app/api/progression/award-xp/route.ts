import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Award XP to a player's skills. Handles:
 * - type: "attendance" — +10 XP to all skills for attending a session
 * - type: "review" — XP based on review scores per skill
 * - type: "coach_assessment" — Direct level set from coach quick-assess form
 */

// XP required for each level (level -> xp_to_next)
function xpForLevel(level: number): number {
  // Progressive: 100, 120, 150, 180, 220, 270, 330, 400, 500, 0 (max)
  const table = [0, 100, 120, 150, 180, 220, 270, 330, 400, 500, 0]
  return table[Math.min(level, 10)] || 100
}

interface SkillRow {
  id: string
  player_id: string
  skill_name: string
  current_level: number
  current_xp: number
  xp_to_next: number
  organisation_id: string
  last_assessed_at: string | null
  created_at: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type } = body

    /* ---- Attendance: +10 XP to all skills for a player ---- */
    if (type === 'attendance') {
      const { player_id } = body
      if (!player_id) {
        return NextResponse.json({ error: 'player_id required' }, { status: 400 })
      }

      const { data: skills } = await supabase
        .from('skill_levels')
        .select('*')
        .eq('player_id', player_id)

      if (!skills || skills.length === 0) {
        return NextResponse.json({ message: 'No skills found' }, { status: 200 })
      }

      const updates = (skills as SkillRow[]).map((s) => processXpGain(s, 10))
      for (const u of updates) {
        await supabase
          .from('skill_levels')
          .update({
            current_level: u.current_level,
            current_xp: u.current_xp,
            xp_to_next: u.xp_to_next,
          })
          .eq('id', u.id)
      }

      return NextResponse.json({ success: true, skills: updates })
    }

    /* ---- Review: XP based on review scores ---- */
    if (type === 'review') {
      const { player_id, scores } = body
      // scores: Record<skill_name, score (1-5)>
      if (!player_id || !scores) {
        return NextResponse.json({ error: 'player_id and scores required' }, { status: 400 })
      }

      const { data: skills } = await supabase
        .from('skill_levels')
        .select('*')
        .eq('player_id', player_id)

      if (!skills || skills.length === 0) {
        return NextResponse.json({ message: 'No skills found' }, { status: 200 })
      }

      // Map score_categories keys to skill names
      const keyToSkill: Record<string, string> = {
        ball_control: 'Ball Control',
        passing: 'Passing',
        shooting: 'Shooting',
        dribbling: 'Dribbling',
        defending: 'Defending',
        game_sense: 'Game Sense',
        teamwork: 'Teamwork',
        fitness: 'Fitness',
      }

      const updates: SkillRow[] = []
      for (const s of skills as SkillRow[]) {
        let xpGain = 10 // base XP for having a review
        // Check if there's a matching score
        for (const [key, skillName] of Object.entries(keyToSkill)) {
          if (skillName === s.skill_name && scores[key]) {
            // Higher score = more XP: score * 5 (max 25)
            xpGain = Math.round((scores[key] as number) * 5)
            break
          }
        }
        updates.push(processXpGain(s, xpGain))
      }

      for (const u of updates) {
        await supabase
          .from('skill_levels')
          .update({
            current_level: u.current_level,
            current_xp: u.current_xp,
            xp_to_next: u.xp_to_next,
            last_assessed_at: new Date().toISOString(),
          })
          .eq('id', u.id)
      }

      return NextResponse.json({ success: true, skills: updates })
    }

    /* ---- Coach Assessment: direct level set ---- */
    if (type === 'coach_assessment') {
      const { skills: assessedSkills } = body
      if (!assessedSkills || !Array.isArray(assessedSkills)) {
        return NextResponse.json({ error: 'skills array required' }, { status: 400 })
      }

      // Verify user is coach/admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'coach'].includes(profile.role)) {
        return NextResponse.json({ error: 'Only coaches/admins can assess' }, { status: 403 })
      }

      const updatedSkills: SkillRow[] = []

      for (const assessed of assessedSkills) {
        const { id, new_level } = assessed as { id: string; new_level: number }
        const clampedLevel = Math.max(1, Math.min(10, new_level))

        const { data: updated } = await supabase
          .from('skill_levels')
          .update({
            current_level: clampedLevel,
            current_xp: 0,
            xp_to_next: xpForLevel(clampedLevel),
            last_assessed_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single()

        if (updated) {
          updatedSkills.push(updated as SkillRow)
        }
      }

      return NextResponse.json({ success: true, skills: updatedSkills })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** Process an XP gain for a skill, handling level-up logic */
function processXpGain(skill: SkillRow, xpGain: number): SkillRow {
  let { current_level, current_xp, xp_to_next } = skill

  // Don't go past level 10
  if (current_level >= 10) {
    return skill
  }

  current_xp += xpGain

  // Level up loop (can level up multiple times if big XP gain)
  while (current_xp >= xp_to_next && current_level < 10) {
    current_xp -= xp_to_next
    current_level += 1
    xp_to_next = xpForLevel(current_level)
  }

  // Cap at level 10
  if (current_level >= 10) {
    current_level = 10
    current_xp = 0
    xp_to_next = 0
  }

  return {
    ...skill,
    current_level,
    current_xp,
    xp_to_next,
  }
}
