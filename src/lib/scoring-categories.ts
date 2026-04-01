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
