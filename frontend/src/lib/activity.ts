import { api } from './api'
import type { ActivityKind, Language, Progress } from './types'

export const logActivity = (childId: number, a: { kind: ActivityKind; title?: string; detail?: string; score?: number; max?: number; seconds?: number; language?: Language }) =>
  api(`/children/${childId}/activities`, { body: { kind: a.kind, title: a.title ?? '', detail: a.detail ?? '', score: a.score ?? null, max_score: a.max ?? null, duration_seconds: Math.round(a.seconds ?? 0), language: a.language ?? 'English' } })

export const getProgress = (childId: number) => api<Progress>(`/children/${childId}/progress`)
