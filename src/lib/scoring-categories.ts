import { SCORE_CATEGORIES } from '@/lib/types'

/**
 * Scoring category as stored in the database.
 */
export interface ScoringCategory {
  id: string
  organisation_id: string
  name: string
  description: string | null
  icon: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

/**
 * Normalized category shape used throughout the app.
 * `key` is a snake_case version of the name for compatibility with progress_reviews columns.
 */
export interface NormalizedCategory {
  key: string
  label: string
  icon?: string | null
}

/**
 * Convert a category name to a snake_case key.
 */
export function toKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Convert database scoring categories to the normalized shape used by UI components.
 * Falls back to SCORE_CATEGORIES if none provided.
 */
export function normalizeCategories(
  dbCategories: ScoringCategory[] | null | undefined
): NormalizedCategory[] {
  if (!dbCategories || dbCategories.length === 0) {
    return SCORE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))
  }
  return dbCategories.map((c) => ({
    key: toKey(c.name),
    label: c.name,
    icon: c.icon,
  }))
}

/**
 * Default template sets that academies can load.
 */
export const FOOTBALL_DEFAULTS = [
  { name: 'Ball Control', icon: '\u26BD', description: 'First touch, trapping, receiving the ball' },
  { name: 'Passing', icon: '\uD83C\uDFAF', description: 'Short and long passing accuracy' },
  { name: 'Shooting', icon: '\uD83D\uDE80', description: 'Finishing and shot technique' },
  { name: 'Dribbling', icon: '\u26A1', description: 'Ball carrying and close control' },
  { name: 'Defending', icon: '\uD83D\uDEE1\uFE0F', description: 'Tackling, positioning, marking' },
  { name: 'Game Sense', icon: '\uD83E\uDDE0', description: 'Reading the game, decision making' },
  { name: 'Teamwork', icon: '\uD83E\uDD1D', description: 'Communication and working with others' },
  { name: 'Fitness', icon: '\uD83D\uDCAA', description: 'Speed, stamina, agility' },
]

export const GOALKEEPER_DEFAULTS = [
  { name: 'Shot Stopping', icon: '\uD83E\uDDE4', description: 'Saving shots on target' },
  { name: 'Distribution', icon: '\uD83C\uDFAF', description: 'Throwing, kicking, passing from goal' },
  { name: 'Positioning', icon: '\uD83D\uDDFA\uFE0F', description: 'Angles and positioning in goal' },
  { name: 'Communication', icon: '\uD83D\uDDE3\uFE0F', description: 'Organising the defence' },
  { name: 'Handling', icon: '\uD83E\uDD32', description: 'Catching and holding the ball' },
  { name: 'Footwork', icon: '\uD83E\uDDB6', description: 'Movement and agility around the goal' },
  { name: 'Aerial Ability', icon: '\u2708\uFE0F', description: 'Dealing with crosses and high balls' },
  { name: 'Decision Making', icon: '\uD83E\uDDE0', description: 'When to come out, stay, or distribute' },
]

export const CUSTOM_SPORT_DEFAULTS = [
  { name: 'Technical', icon: '\u2699\uFE0F', description: 'Sport-specific technical skills' },
  { name: 'Tactical', icon: '\uD83D\uDDFA\uFE0F', description: 'Game awareness and tactical decisions' },
  { name: 'Physical', icon: '\uD83D\uDCAA', description: 'Strength, speed, endurance' },
  { name: 'Mental', icon: '\uD83E\uDDE0', description: 'Focus, resilience, composure' },
  { name: 'Creativity', icon: '\uD83C\uDFA8', description: 'Improvisation and creative play' },
  { name: 'Work Rate', icon: '\uD83D\uDD25', description: 'Effort and intensity' },
]

// Age-appropriate scoring sets for very young players (2-5).
// Tactical IQ doesn't matter; coordination and confidence do.
export const SOCCER_TOTS_DEFAULTS = [
  { name: 'Coordination', icon: '\uD83E\uDD38', description: 'Hand-eye and foot-eye coordination' },
  { name: 'Confidence', icon: '\u2728', description: 'Willingness to try new things' },
  { name: 'Listening', icon: '\uD83D\uDC42', description: 'Following coach instructions' },
  { name: 'Sharing', icon: '\uD83E\uDD1D', description: 'Playing nicely with other children' },
  { name: 'Fun', icon: '\uD83D\uDE03', description: 'Engagement and enjoyment of the session' },
  { name: 'Effort', icon: '\u26A1', description: 'Trying hard and staying engaged' },
]

// 1-2-1 and intensity sessions \u2014 these are advanced/high-performance players.
// Focus on tactical IQ, mental toughness, decision making.
export const ONE_TO_ONE_DEFAULTS = [
  { name: 'Tactical IQ', icon: '\uD83E\uDDE0', description: 'Reading the game and decision making' },
  { name: 'Technical Quality', icon: '\u26BD', description: 'Precision in 1v1, finishing, control' },
  { name: 'Mental Strength', icon: '\uD83D\uDCAA', description: 'Composure under pressure, focus' },
  { name: 'Movement', icon: '\uD83C\uDFC3', description: 'Off-ball runs, positioning, awareness' },
  { name: 'Pressing', icon: '\uD83D\uDD25', description: 'Defensive intensity and recovery' },
  { name: 'Coachability', icon: '\uD83C\uDFAF', description: 'Applies feedback quickly' },
]

// Older group sessions \u2014 standard football skills assessment.
export const GROUP_DEFAULTS = FOOTBALL_DEFAULTS

// Accelerator / Elite \u2014 performance pathway players.
export const ACCELERATOR_DEFAULTS = [
  { name: 'Game Intelligence', icon: '\uD83E\uDDE0', description: 'Reading the game, scanning, decisions' },
  { name: 'Technical Excellence', icon: '\u26BD', description: 'First touch, passing, shooting under pressure' },
  { name: 'Athletic Profile', icon: '\uD83D\uDCAA', description: 'Speed, agility, strength for age' },
  { name: 'Mental Edge', icon: '\uD83D\uDD25', description: 'Resilience, composure, leadership' },
  { name: 'Position-Specific', icon: '\uD83C\uDFAF', description: 'Specialist skills for their role' },
  { name: 'Coachability', icon: '\uD83C\uDF93', description: 'Applies feedback session-to-session' },
]

// Soccer camp / one-off camps \u2014 simple, holiday-vibe scoring.
export const CAMP_DEFAULTS = [
  { name: 'Effort', icon: '\u26A1', description: 'Worked hard all day' },
  { name: 'Skills Improvement', icon: '\uD83D\uDCC8', description: 'Visibly improved during the camp' },
  { name: 'Attitude', icon: '\u2728', description: 'Positive, respectful, supportive of others' },
  { name: 'Fun Factor', icon: '\uD83D\uDE03', description: 'Engagement and enjoyment' },
]

// Map class_type \u2192 default template. Used by the admin UI's per-tab "Load Defaults" button.
export const DEFAULTS_BY_CLASS_TYPE: Record<string, { name: string; icon: string; description: string }[]> = {
  soccer_tots: SOCCER_TOTS_DEFAULTS,
  '1-2-1': ONE_TO_ONE_DEFAULTS,
  '2-1': ONE_TO_ONE_DEFAULTS,
  intensity: ONE_TO_ONE_DEFAULTS,
  gk: GOALKEEPER_DEFAULTS,
  group: GROUP_DEFAULTS,
  small_group: GROUP_DEFAULTS,
  academy: ACCELERATOR_DEFAULTS,
  accelerator: ACCELERATOR_DEFAULTS,
  elite: ACCELERATOR_DEFAULTS,
  camp: CAMP_DEFAULTS,
  girls: GROUP_DEFAULTS,
  adults: GROUP_DEFAULTS,
  trial: CAMP_DEFAULTS,
}
