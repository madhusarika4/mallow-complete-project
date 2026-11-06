// Server timestamps without a timezone (SQLite CURRENT_TIMESTAMP) are UTC; infant logs are local wall-clock.
export function parseUtc(s: string): Date {
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(s)) return new Date(s)
  return new Date(s.replace(' ', 'T') + 'Z')
}
export const parseLocal = (s: string) => new Date(s.length <= 10 ? s + 'T00:00:00' : s)
export function relDay(d: Date): string {
  const now = new Date(); const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(now) - start(d)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
export const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
export const whenLabel = (d: Date) => `${relDay(d)} · ${clock(d)}`
export function ago(d: Date): string {
  const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m ago`
  return `${Math.floor(h / 24)}d ago`
}
export const hm = (min: number) => { const h = Math.floor(min / 60); const m = Math.round(min % 60); return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m` }
export const toLocalInput = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
export const todayISO = () => toLocalInput().slice(0, 10)
