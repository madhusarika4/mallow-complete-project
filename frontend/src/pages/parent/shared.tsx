import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Bunny, { type Accessory } from '../../components/Bunny'
import { AXIS, GRID, PASTEL, tooltipStyle } from '../../lib/charts'
import { Badge, ProgressBar } from '../../ui'
import type { Child } from '../../lib/types'

export interface Daily { date: string; label: string; minutes: number; conversations: number; activities: number; avg_score: number | null }
export interface ChildStats {
  child: Child; days: number
  totals: { minutes_today: number; minutes_week: number; general_minutes_used_today: number; general_minutes_remaining_today: number; educational_minutes: number; educational_sessions: number; conversations: number; messages: number; activities: number; learning_activities: number; games: number; quizzes: number; creations: number; safety_flags_open: number; safety_flags_total: number; high_severity_open: number; safety_notifications_failed: number }
  limit: { minutes: number; used_minutes: number; percent: number; status: 'ok' | 'near' | 'reached' }
  daily: Daily[]; distribution: { kind: string; label: string; count: number }[]
  emotions: { emotion: string; count: number }[]; languages: { language: string; count: number }[]
}
export interface Incident { id: number; child_id: number; nickname: string; is_demo: number; is_sample?: number; session_id: number | null; category: string; detail: string; severity: 'info' | 'medium' | 'high'; created_at: string; reviewed_at: string | null; parent_note: string; language: string; notification_status: string; notification_channel: string; notification_recipient: string; notification_attempted_at: string | null; notification_delivered_at: string | null }

const NOTIFICATION_FAILED = new Set(['', 'failed', 'not_attempted', 'pending', 'attempted', 'dashboard_only'])

export function notificationProblem(i: Incident) {
  return i.severity === 'high' && !i.reviewed_at && !i.is_sample && NOTIFICATION_FAILED.has(i.notification_status)
}

export function notificationLabel(i: Incident) {
  if (i.severity !== 'high' || i.is_sample) return ''
  if (i.notification_status === 'delivered') return 'Trusted-adult notification delivered'
  if (i.notification_status === 'pending') return 'Trusted-adult notification pending'
  if (i.notification_status === 'attempted') return 'Notification sent for delivery; confirmation is pending'
  if (i.notification_status === 'failed') return 'Trusted-adult notification failed'
  if (i.notification_status === 'not_attempted') return 'No notification was attempted'
  if (i.notification_status === 'dashboard_only') return 'No external alert configured; parent must review this note'
  return ''
}

export const BAND_LABEL: Record<string, string> = { '0-3': 'Parent-led infant/toddler care', '4-6': 'Little explorer', '7-9': 'Curious learner', '10-12': 'Young thinker' }
export const BAND_BG: Record<string, string> = { '0-3': 'from-lav-soft to-blush', '4-6': 'from-peach-soft to-blush', '7-9': 'from-mint-soft to-teal-soft', '10-12': 'from-lav-soft to-lav' }
export const BAND_ACC: Record<string, Accessory> = { '0-3': 'nightcap', '4-6': 'flower', '7-9': 'scarf', '10-12': 'glasses' }

export const ACTIVITY_LABELS: Record<string, { label: string; hint: string }> = {
  chat: { label: 'Chat & voice with Mallow', hint: 'Typing or talking with the companion' },
  stories: { label: 'Stories', hint: 'Bedtime and interactive stories' },
  games: { label: 'Games', hint: 'Memory, counting and word games' },
  riddles: { label: 'Riddles', hint: 'Gentle riddles and puzzles' },
  quizzes: { label: 'Quizzes', hint: 'Short quizzes with explanations' },
  learning: { label: 'Learning', hint: 'Colours, shapes, subjects and revision' },
  create: { label: 'Create & draw', hint: 'Drawing and making things' },
  quests: { label: 'Quests', hint: 'Step-by-step learning adventures' },
  science: { label: 'Science', hint: 'Curious science exploration' },
  maths: { label: 'Maths', hint: 'Number challenges and practice' },
  writing: { label: 'Creative writing', hint: 'Stories, poems and writing prompts' },
  journal: { label: 'Journal', hint: 'A private place to write (text stays private)' },
  projects: { label: 'Projects & plans', hint: 'Planning projects, goals and revision' },
  study: { label: 'Study tools', hint: 'Homework guidance, flashcards, focus timer' },
}
export const ACTIVITY_KEYS = Object.keys(ACTIVITY_LABELS)

export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`)

export function ageText(c: Child) {
  if (c.is_infant && c.age_months != null && c.age_months < 36) return `${c.age_months} month${c.age_months === 1 ? '' : 's'}`
  if (c.is_infant && c.age != null) return `${c.age} yr${c.age === 1 ? '' : 's'}`
  return c.age != null ? `Age ${c.age}` : `Ages ${c.age_band}`
}

export function StatTile({ icon, label, value, sub, tone = 'bg-white' }: { icon: string; label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className={`rounded-3xl border border-line p-4 shadow-soft ${tone}`}>
      <div className="flex items-center gap-2 text-sm font-bold text-ink-soft"><span aria-hidden className="text-lg">{icon}</span>{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </div>
  )
}

export function Panel({ title, hint, children, right, className = '' }: { title: string; hint?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-4xl border border-line bg-paper/90 p-5 shadow-soft ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-display text-xl font-bold">{title}</h2>{hint && <p className="text-sm text-ink-soft">{hint}</p>}</div>{right}</div>
      {children}
    </section>
  )
}

export function PageHeader({ title, sub, right, art }: { title: string; sub?: string; right?: ReactNode; art?: ReactNode }) {
  return (
    <header className="relative mb-5 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-4xl border border-line bg-gradient-to-r from-blush-soft via-paper to-lav-soft p-5 shadow-soft">
      <div className="flex items-center gap-4">{art}<div><h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>{sub && <p className="mt-1 max-w-xl text-ink-soft">{sub}</p>}</div></div>
      {right}
    </header>
  )
}

export function LimitBar({ limit }: { limit: ChildStats['limit'] }) {
  const tone = limit.status === 'reached' ? 'rose' : limit.status === 'near' ? 'peach' : 'mint'
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-bold text-ink-soft"><span>{fmtMin(limit.used_minutes)} of {limit.minutes}m today</span><span>{limit.status === 'reached' ? 'Limit reached' : limit.status === 'near' ? 'Nearly there' : 'Within limit'}</span></div>
      <ProgressBar value={limit.percent} tone={tone} label="Daily usage" />
    </div>
  )
}

export function ChildCard({ stats, to }: { stats: ChildStats; to: string }) {
  const c = stats.child
  return (
    <Link to={to} data-testid={`family-card-${c.id}`} className={`tap group relative flex flex-col gap-3 rounded-4xl border border-line bg-gradient-to-br ${BAND_BG[c.age_band]} p-4 shadow-soft transition hover:-translate-y-1 hover:shadow-lift`}>
      <div className="flex items-center gap-3">
        <Bunny size={84} accessory={BAND_ACC[c.age_band]} shadow={false} />
        <div className="min-w-0">
          <div className="truncate font-display text-xl font-bold">{c.nickname}</div>
          <div className="text-sm font-semibold text-ink-soft">{ageText(c)} · {BAND_LABEL[c.age_band]}</div>
          {c.is_infant && c.developmental_stage && <div className="text-xs text-ink-soft">Developmental stage: {c.developmental_stage}</div>}
          <div className="mt-1 flex flex-wrap gap-1">{c.is_demo && <Badge tone="butter">Demo</Badge>}{stats.totals.safety_flags_open > 0 && <Badge tone={stats.totals.high_severity_open ? 'rose' : 'peach'}>🛡 {stats.totals.safety_flags_open} to review</Badge>}{stats.totals.safety_notifications_failed > 0 && <Badge tone="rose">Alert not confirmed</Badge>}</div>
        </div>
      </div>
      <LimitBar limit={stats.limit} />
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-ink-soft">
        <div className="rounded-2xl bg-white/70 py-1.5"><div className="text-base text-ink">{fmtMin(stats.totals.minutes_week)}</div>this week</div>
        <div className="rounded-2xl bg-white/70 py-1.5"><div className="text-base text-ink">{stats.totals.conversations}</div>chats</div>
        <div className="rounded-2xl bg-white/70 py-1.5"><div className="text-base text-ink">{stats.totals.activities}</div>activities</div>
      </div>
    </Link>
  )
}

const axis = { stroke: AXIS, fontSize: 12, tickLine: false as const, axisLine: false as const }

export function MinutesChart({ data, names }: { data: Record<string, number | string>[]; names?: string[] }) {
  const keys = names ?? ['minutes']
  return (
    <div className="h-64 w-full" role="img" aria-label="Daily minutes chart">
      <ResponsiveContainer><BarChart data={data} margin={{ left: -18, right: 4, top: 8 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} unit="m" allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#F1ECFA' }} formatter={(v) => [`${v} min`]} />
        {keys.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {keys.map((k, i) => <Bar key={k} dataKey={k} name={keys.length === 1 ? 'Minutes' : k} fill={PASTEL[i % PASTEL.length]} radius={[8, 8, 0, 0]} maxBarSize={28} />)}
      </BarChart></ResponsiveContainer>
    </div>
  )
}

export function DistributionChart({ data }: { data: { label: string; count: number }[] }) {
  if (!data.length) return <NoData text="No activity yet in this range." />
  const total = data.reduce((a, b) => a + b.count, 0)
  return (
    <div className="flex flex-wrap items-center gap-4" role="img" aria-label="Activity distribution">
      <div className="relative h-44 w-44 shrink-0"><ResponsiveContainer><PieChart><Pie data={data} dataKey="count" nameKey="label" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="#FFFDF9" strokeWidth={2}>{data.map((_, i) => <Cell key={i} fill={PASTEL[i % PASTEL.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="font-display text-2xl font-bold">{total}</div><div className="text-[11px] font-bold text-ink-soft">things done</div></div></div></div>
      <ul className="min-w-[8rem] flex-1 space-y-1 text-sm">{data.slice(0, 7).map((d, i) => <li key={d.label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: PASTEL[i % PASTEL.length] }} />{d.label}</span><b>{d.count}</b></li>)}</ul>
    </div>
  )
}

export function ScoreChart({ data }: { data: Daily[] }) {
  const has = data.some((d) => d.avg_score != null)
  if (!has) return <NoData text="Quiz and learning scores will appear here." />
  return (
    <div className="h-52 w-full" role="img" aria-label="Learning score trend">
      <ResponsiveContainer><LineChart data={data} margin={{ left: -18, right: 8, top: 8 }}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis {...axis} domain={[0, 100]} unit="%" /><Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Average score']} /><Line type="monotone" dataKey="avg_score" stroke={PASTEL[2]} strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} connectNulls /></LineChart></ResponsiveContainer>
    </div>
  )
}

export function NoData({ text }: { text: string }) {
  return <div className="grid place-items-center rounded-3xl bg-white/60 px-4 py-8 text-center text-sm text-ink-soft">{text}</div>
}

export const SEVERITY: Record<string, { tone: 'rose' | 'peach' | 'lav'; label: string }> = { high: { tone: 'rose', label: 'Please check in' }, medium: { tone: 'peach', label: 'Worth a look' }, info: { tone: 'lav', label: 'For your information' } }
export const CATEGORY_LABEL: Record<string, string> = {
  serious_disclosure: 'Child may feel unsafe or upset', parent_blocked_topic: 'Blocked topic', sexual_content: 'Unsuitable content request', graphic_violence: 'Violent content request', weapons: 'Weapons request',
  drugs: 'Drugs request', personal_info: 'Personal information', bypass: 'Tried to change the rules', secrecy: 'Asked to keep a secret', self_harm_instructions: 'Self-harm request', moderation: 'Flagged by moderation', check_error: 'Safety check error',
}
