export type Band = '0-3' | '4-6' | '7-9' | '10-12'
export type Language = 'English' | 'Telugu' | 'Hinglish'
export type Mode = 'chat' | 'story' | 'bedtime' | 'study' | 'homework' | 'explain'

export interface Child {
  id: number; nickname: string; age_band: Band; age: number | null; age_months?: number | null; developmental_stage?: string | null; dob: string | null
  is_infant: boolean; is_demo: boolean; languages: Language[]; preferred_language: Language
  voice_enabled: boolean; activities: string[]; daily_minutes: number
  used_minutes_today: number; remaining_minutes_today: number; limit_reached: boolean
  voice_engine: string; voice_id: string; voice_language: string; avatar: string
  blocked_topics?: string[]; dob_exact?: boolean; created_at?: string
}
export interface Bootstrap {
  consent: boolean; pin_set: boolean; parent_unlocked: boolean; companion_name: string
  child_count: number; demo_count: number; languages: Language[]; helpline: string
  services: { llm: boolean; moderation: boolean; stt: boolean; voice_output: boolean; voice_output_label: string; offline_companion: boolean }
}
export interface ChatMessage { id: number | string; role: 'child' | 'mallow'; text: string; language?: string; emotion?: string; pending?: boolean; failed?: boolean }
export interface CompanionMessage { id: number | string; role: 'user' | 'assistant'; text: string; language?: string; created_at?: string; pending?: boolean; failed?: boolean; urgent?: boolean }
export type CompanionAudience = 'parent' | 'infant'
export interface TurnResult {
  reply: string; message_id: number | null; blocked: boolean; is_disclosure: boolean; limit_reached: boolean
  offline: boolean; provider_error: boolean; emotion: string; mood: string; safety_layer: string; helpline: string | null; duplicate: boolean
}
export interface Progress { stars: number; streak_days: number; total: number; by_kind: Record<string, number> }
export type ActivityKind = 'game' | 'quiz' | 'story' | 'riddle' | 'drawing' | 'learning' | 'quest' | 'science' | 'math' | 'writing' | 'build' | 'journal' | 'project' | 'study' | 'feelings' | 'flashcards' | 'focus' | 'plan'
export interface Step { text: string; done: boolean }
export interface Project { id: number; kind: 'project' | 'plan' | 'goal'; title: string; goal: string; due_on: string | null; steps: Step[]; status: 'active' | 'done' }
export interface Creation { id: number; kind: string; title: string; content: string; created_at: string }
export interface JournalEntry { id: number; text: string; mood: string; created_at: string }
