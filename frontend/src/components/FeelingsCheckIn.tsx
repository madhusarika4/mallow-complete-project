import { useState } from 'react'
import { Link } from 'react-router-dom'
import Bunny from './Bunny'
import ReadAloud from './ReadAloud'
import { logActivity } from '../lib/activity'
import type { Child } from '../lib/types'
import { Button } from '../ui'
import { BackBar, Locked, allowed } from '../pages/child46/kit'

const CHOICES = [
  ['happy', 'Happy', '😊'],
  ['calm', 'Calm', '🌿'],
  ['okay', 'Okay', '🙂'],
  ['sad', 'Sad', '😔'],
  ['worried', 'Worried', '😟'],
  ['angry', 'Angry', '😤'],
] as const

/** Shared emotional check-in for older children. Saves a feelings activity, never free text. */
export default function FeelingsCheckIn({ child }: { child: Child }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  if (!allowed(child, 'chat')) {
    return <div><BackBar title="Feelings" to={`/child/${child.id}`} /><Locked what="Feelings" /></div>
  }

  const save = () => {
    if (!picked) return
    const detail = `${picked}${note.trim() ? `: ${note.trim()}` : ''}`.slice(0, 500)
    void logActivity(child.id, { kind: 'feelings', title: 'Feeling check-in', detail, score: 1, max: 1, language: child.preferred_language }).catch(() => undefined)
    setSaved(true)
  }

  return (
    <div className="space-y-5">
      <BackBar title="Feelings" to={`/child/${child.id}`} />
      <section className="mx-auto max-w-3xl rounded-5xl border border-line bg-white/80 p-5 text-center shadow-lift sm:p-7">
        <Bunny size={160} mood={picked === 'sad' || picked === 'worried' ? 'sad' : picked === 'happy' ? 'happy' : 'calm'} />
        <h2 className="font-display text-3xl font-bold">How is your heart today?</h2>
        <div className="mt-2 flex justify-center"><ReadAloud child={child} text="How is your heart today? Pick the feeling that fits best. There is no wrong feeling." compact mood="calm" mode="chat" label="Hear the question" /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {CHOICES.map(([id, label, emoji]) => (
            <button key={id} onClick={() => { setPicked(id); setSaved(false) }} className={`tap rounded-4xl border border-line px-4 py-4 text-xl font-bold shadow-soft ${picked === id ? 'bg-mint-soft ring-2 ring-mint-deep' : 'bg-white'}`}>
              <span className="mr-2 text-2xl" aria-hidden>{emoji}</span>{label}
            </button>
          ))}
        </div>
        {picked && (
          <div className="mt-4 text-left">
            <label htmlFor="feeling-note" className="text-sm font-bold text-ink-soft">Want to say more? (optional)</label>
            <textarea id="feeling-note" value={note} onChange={(e) => { setNote(e.target.value); setSaved(false) }} maxLength={400} placeholder="Something happened today…" className="mt-1 min-h-[6rem] w-full rounded-3xl border border-line bg-white p-3 text-[16px] shadow-inset focus:border-lav-deep focus:outline-none focus:ring-2 focus:ring-lav" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={save} disabled={saved}>{saved ? 'Saved' : 'Save check-in'}</Button>
              <Link to={`/child/${child.id}/chat`} className="tap rounded-full bg-lav-soft px-4 py-2 text-sm font-bold text-lav-deep">Talk to Mallow</Link>
            </div>
          </div>
        )}
        {saved && <p className="mt-4 rounded-4xl bg-lav-soft px-5 py-4 text-left text-lg font-bold text-lav-deep">Thanks for checking in. Every feeling is allowed. If it feels too big, tell a grown-up you trust.</p>}
      </section>
    </div>
  )
}
