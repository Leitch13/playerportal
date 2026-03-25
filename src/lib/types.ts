export type UserRole = 'admin' | 'coach' | 'parent'
export type PaymentStatus = 'unpaid' | 'paid' | 'overdue' | 'partial'
export type EnrolmentStatus = 'active' | 'paused' | 'cancelled'

export interface Organisation {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
  accent_color: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  organisation_id: string
  address: string | null
  secondary_contact_name: string | null
  secondary_contact_phone: string | null
  notes: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  parent_id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  age_group: string | null
  position: string | null
  photo_url: string | null
  medical_info: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  kit_size: string | null
  school: string | null
  notes: string | null
  created_at: string
  updated_at: string
  parent?: Profile
}

export interface TrainingGroup {
  id: string
  name: string
  day_of_week: string | null
  time_slot: string | null
  location: string | null
  coach_id: string | null
  created_at: string
  coach?: Profile
}

export interface Enrolment {
  id: string
  player_id: string
  group_id: string
  status: EnrolmentStatus
  enrolled_at: string
  player?: Player
  group?: TrainingGroup
}

export interface Attendance {
  id: string
  player_id: string
  group_id: string
  session_date: string
  present: boolean
  note: string | null
  created_at: string
  player?: Player
  group?: TrainingGroup
}

export interface ProgressReview {
  id: string
  player_id: string
  coach_id: string
  review_date: string
  attitude: number
  effort: number
  technical_quality: number
  game_understanding: number
  confidence: number
  physical_movement: number
  strengths: string | null
  focus_next: string | null
  parent_summary: string | null
  created_at: string
  player?: Player
  coach?: Profile
}

export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  subject: string | null
  body: string
  read: boolean
  created_at: string
  sender?: Profile
  recipient?: Profile
}

export interface Payment {
  id: string
  parent_id: string
  player_id: string | null
  amount: number         // amount due
  amount_paid: number    // amount received so far
  description: string | null
  status: PaymentStatus
  due_date: string | null
  paid_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  parent?: Profile
  player?: Player
}

export interface TrainingPlan {
  id: string
  group_id: string
  week_starting: string
  title: string
  description: string | null
  focus_areas: string | null
  created_at: string
  group?: TrainingGroup
}

export interface Document {
  id: string
  title: string
  description: string | null
  url: string
  doc_type: string
  player_id: string | null
  parent_id: string | null
  uploaded_by: string | null
  folder: string
  created_at: string
  updated_at: string
  player?: Player
  parent?: Profile
}

export interface SessionNote {
  id: string
  group_id: string
  session_date: string
  coach_id: string
  title: string | null
  notes: string
  focus_areas: string | null
  players_of_note: string | null
  created_at: string
  updated_at: string
  group?: TrainingGroup
  coach?: Profile
}

export const DOC_TYPES = [
  { value: 'link', label: 'Link' },
  { value: 'canva', label: 'Canva' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
] as const

export const POSITIONS = [
  'Goalkeeper', 'Defender', 'Centre-Back', 'Full-Back',
  'Midfielder', 'Central Midfield', 'Winger',
  'Forward', 'Striker',
] as const

export const KIT_SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const

// Score categories for progress reviews
export const SCORE_CATEGORIES = [
  { key: 'attitude', label: 'Attitude' },
  { key: 'effort', label: 'Effort' },
  { key: 'technical_quality', label: 'Technical Quality' },
  { key: 'game_understanding', label: 'Game Understanding' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'physical_movement', label: 'Physical Movement' },
] as const

// Payment status labels for display
export const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
] as const

export type SubscriptionStatus = 'incomplete' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing' | 'paused'

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  amount: number
  interval: string
  sessions_per_week: number
  stripe_price_id: string | null
  stripe_product_id: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  parent_id: string
  player_id: string | null
  plan_id: string
  status: SubscriptionStatus
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  created_at: string
  updated_at: string
  parent?: Profile
  player?: Player
  plan?: SubscriptionPlan
}
