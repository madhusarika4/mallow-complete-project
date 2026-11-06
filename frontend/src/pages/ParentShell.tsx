import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, Link, useLocation } from 'react-router-dom'
import Bunny from '../components/Bunny'
import { Doodles } from '../components/Decor'
import { useApp } from '../lib/app'
import { api } from '../lib/api'
import { Button, Field, Input, Spinner } from '../ui'
import Overview from './parent/Overview'
import ChildDetail from './parent/ChildDetail'
import Children from './parent/Children'
import Safety from './parent/Safety'
import Settings from './parent/Settings'
import InfantCare from './infant'
import Companion from './parent/Companion'
import type { Incident } from './parent/shared'

function PinGate() {
  const { unlock } = useApp()
  const [pin, setPin] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true); setErr(null)
    try { const r = await api<{ token: string }>('/auth/login', { body: { pin } }); await unlock(r.token) } catch (e) { setErr((e as Error).message); setPin('') } finally { setBusy(false) }
  }
  return (
    <main className="relative mx-auto grid min-h-screen max-w-md place-items-center px-5">
      <div className="relative w-full overflow-hidden rounded-5xl border border-line bg-paper/90 p-8 text-center shadow-lift paper-grain"><Doodles />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Bunny size={150} accessory="scarf" />
          <h1 className="text-3xl font-bold">Parent space</h1>
          <p className="text-sm text-ink-soft">Enter your PIN to continue.</p>
          <form className="w-full space-y-3 text-left" onSubmit={(e) => { e.preventDefault(); void submit() }}>
            <Field label="Parent PIN" error={err}>{(id) => <Input id={id} data-testid="pin-input" type="password" autoFocus autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} />}</Field>
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={pin.length < 4} data-testid="pin-unlock">Unlock</Button>
          </form>
          <Link to="/" className="text-sm font-bold text-ink-soft underline">Back to children</Link>
          <p className="text-xs text-ink-faint">Forgot it? The PIN can only be reset by deleting the database file, which removes all saved data.</p>
        </div>
      </div>
    </main>
  )
}

const NAV = [
  { to: '/parent', label: 'Family', icon: '🏡', end: true },
  { to: '/parent/children', label: 'Children', icon: '🧒' },
  { to: '/parent/companion', label: 'Companion', icon: '💬' },
  { to: '/parent/safety', label: 'Safety', icon: '🛡️' },
  { to: '/parent/infant', label: 'Infant care', icon: '🍼' },
  { to: '/parent/settings', label: 'Settings', icon: '⚙️' },
]

function SafetyBadge() {
  const [openFlags, setOpenFlags] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let off = false
    const q = new URLSearchParams({ status: 'open' })
    api<Incident[]>(`/safety/incidents?${q}`)
      .then((items) => { if (!off) setOpenFlags(items.length) })
      .catch(() => { if (!off) setFailed(true) })
    return () => { off = true }
  }, [])

  if (openFlags != null && openFlags > 0) {
    return <span className="ml-auto rounded-full bg-rose px-2 text-xs text-white" aria-label={`${openFlags} safety incidents to review`}>{openFlags}</span>
  }
  if (failed) {
    return <span className="ml-auto rounded-full bg-rose px-2 text-xs text-white" aria-label="Safety incident count unavailable" title="Safety incident count unavailable">!</span>
  }
  return null
}

export default function ParentShell() {
  const { unlocked, loading, lock, children, boot } = useApp()
  const loc = useLocation()

  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner size={32} /></div>
  if (boot && (!boot.consent || !boot.pin_set)) return <Navigate to="/" replace />
  if (!unlocked) return <PinGate />
  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-4 p-3 sm:p-5 lg:flex-row">
      <aside className="lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-64 lg:shrink-0">
        <div className="relative flex h-full flex-col gap-3 overflow-hidden rounded-4xl border border-line bg-paper/90 p-4 shadow-soft paper-grain">
          <div className="relative z-10 flex items-center gap-3 lg:flex-col lg:items-center lg:py-3">
            <div className="hidden lg:block"><Bunny size={120} accessory="scarf" /></div>
            <div className="lg:text-center"><div className="font-display text-2xl font-bold">Parent space</div><div className="text-xs text-ink-soft">{children.filter((c) => !c.is_infant).length} children · {children.filter((c) => c.is_infant).length} babies</div></div>
          </div>
          <nav aria-label="Parent sections" className="relative z-10 flex gap-1 overflow-x-auto scroll-soft lg:flex-col">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} data-testid={`nav-${n.label.toLowerCase().replace(' ', '-')}`} className={({ isActive }) => `tap flex items-center gap-2.5 whitespace-nowrap rounded-2xl px-4 py-2.5 text-[15px] font-bold ${isActive ? 'bg-lav text-lav-deep shadow-inset' : 'text-ink-soft hover:bg-white'}`}><span aria-hidden>{n.icon}</span>{n.label}{n.label === 'Safety' ? <SafetyBadge key={loc.pathname} /> : null}</NavLink>)}
          </nav>
          <div className="relative z-10 mt-auto hidden space-y-2 lg:block">
            <Link to="/" className="tap block rounded-2xl bg-mint-soft px-4 py-2.5 text-center text-sm font-bold text-mint-deep">👧 Open child view</Link>
            <Button variant="soft" tone="ink" className="w-full" onClick={lock} data-testid="lock">Lock</Button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 pb-16" key={loc.pathname.split('/')[2] ?? 'home'}>
        <div className="mb-3 flex justify-end gap-2 lg:hidden"><Link to="/" className="tap rounded-full bg-mint-soft px-4 py-2 text-sm font-bold text-mint-deep">Child view</Link><Button size="sm" variant="soft" tone="ink" onClick={lock}>Lock</Button></div>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="child/:id" element={<ChildDetail />} />
          <Route path="children" element={<Children />} />
          <Route path="companion" element={<Companion />} />
          <Route path="safety" element={<Safety />} />
          <Route path="infant/*" element={<InfantCare />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/parent" replace />} />
        </Routes>
      </main>
    </div>
  )
}
