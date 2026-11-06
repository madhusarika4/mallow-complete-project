import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import { Star } from '../../components/Decor'
import type { Child, Language } from '../../lib/types'

export interface Kit { child: Child; lang: Language; refresh: () => void }
export const KitCtx = createContext<Kit>(null as unknown as Kit)
export const useKit = () => useContext(KitCtx)

export const shuffle = <T,>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }
export const pick = <T,>(a: T[], n: number) => shuffle(a).slice(0, n)

export function useElapsed() { const t0 = useRef(Date.now()); return () => Math.round((Date.now() - t0.current) / 1000) }

/** Is this parent-controlled area switched on for the child? */
export const allowed = (child: Child, key: string) => child.activities.includes(key)

export function Locked({ what = 'This' }: { what?: string }) {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-3 rounded-4xl border border-line bg-white/70 p-8 text-center shadow-soft" data-testid="locked">
      <Bunny size={150} mood="sleepy" />
      <h2 className="text-2xl font-bold">{what} is resting</h2>
      <p className="text-ink-soft">A grown-up turned this off for now. Let's try something else!</p>
      <Link to="/child/0" className="hidden" />
    </div>
  )
}

export function BackBar({ title, to, emoji }: { title: string; to: string; emoji?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <Link to={to} aria-label="Back" data-testid="back" className="tap grid h-14 w-14 place-items-center rounded-full bg-white text-2xl shadow-soft">←</Link>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{emoji && <span className="mr-2" aria-hidden>{emoji}</span>}{title}</h1>
    </div>
  )
}

export function Stars({ n, of = 3, size = 44 }: { n: number; of?: number; size?: number }) {
  return <div className="flex justify-center gap-2" role="img" aria-label={`${n} of ${of} stars`}>{Array.from({ length: of }).map((_, i) => <Star key={i} size={size} className={i < n ? 'animate-pop' : 'opacity-25 grayscale'} style={{ animationDelay: `${i * 0.18}s` }} />)}</div>
}

export function Result({ stars, title, line, onAgain, backTo }: { stars: number; title: string; line: string; onAgain: () => void; backTo: string }) {
  return (
    <div className="mx-auto flex max-w-md animate-pop flex-col items-center gap-4 rounded-5xl border border-line bg-white/80 p-8 text-center shadow-lift" data-testid="result">
      <Bunny size={200} pose="wave" mood="happy" />
      <h2 className="text-4xl font-bold">{title}</h2>
      <Stars n={stars} />
      <p className="text-xl text-ink-soft">{line}</p>
      <div className="flex w-full flex-col gap-3">
        <button onClick={onAgain} data-testid="again" className="tap rounded-full bg-lav-deep px-6 py-4 text-xl font-bold text-white shadow-soft">Play again 🔁</button>
        <Link to={backTo} className="tap rounded-full bg-white px-6 py-4 text-center text-xl font-bold text-ink-soft shadow-inset">All done</Link>
      </div>
    </div>
  )
}

/** Big friendly answer button used by every multiple-choice game. */
export function Choice({ children, state, onClick, disabled, label }: { children: ReactNode; state?: 'right' | 'wrong' | null; onClick: () => void; disabled?: boolean; label?: string }) {
  const cls = state === 'right' ? 'bg-mint border-mint-deep scale-105' : state === 'wrong' ? 'bg-blush border-rose animate-wiggle' : 'bg-white border-line hover:bg-lav-soft'
  return <button aria-label={label} disabled={disabled} onClick={onClick} className={`tap grid min-h-[5.5rem] place-items-center rounded-4xl border-2 px-4 py-3 font-display text-3xl font-bold shadow-soft transition ${cls}`}>{children}</button>
}

export function useRound<T>(make: () => T[]) {
  const [items, setItems] = useState<T[]>(make)
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const reset = () => { setItems(make()); setI(0); setScore(0); setDone(false) }
  const next = (gained: boolean) => { const s = score + (gained ? 1 : 0); setScore(s); if (i + 1 >= items.length) setDone(true); else setI(i + 1); return s }
  return { items, i, score, done, reset, next, cur: items[i] }
}

export function useFeedback() {
  const [fb, setFb] = useState<{ pick: number; right: boolean } | null>(null)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  const run = (pick: number, right: boolean, after: () => void, ms = 1100) => { setFb({ pick, right }); timer.current = window.setTimeout(() => { setFb(null); after() }, ms) }
  return { fb, run, busy: fb !== null }
}
