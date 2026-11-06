import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Bunny from '../components/Bunny'
import { Doodles, Flower, Star, Squiggle } from '../components/Decor'
import { useApp } from '../lib/app'
import { api } from '../lib/api'
import { Badge, Button, errMsg, Input, Field, useToast } from '../ui'
import type { Accessory } from '../components/Bunny'

const BAND_STYLE: Record<string, { bg: string; acc: Accessory; label: string }> = {
  '4-6': { bg: 'from-peach-soft to-blush', acc: 'flower', label: 'Little explorer' },
  '7-9': { bg: 'from-mint-soft to-teal-soft', acc: 'scarf', label: 'Curious learner' },
  '10-12': { bg: 'from-lav-soft to-lav', acc: 'glasses', label: 'Young thinker' },
}

export default function Home() {
  const { boot, children, loading, error, refresh } = useApp()
  if (loading) return <div className="grid min-h-screen place-items-center"><Bunny size={160} state="thinking" /></div>
  if (error || !boot) return <div className="mx-auto max-w-md p-10 text-center"><Bunny mood="sad" size={160} /><h1 className="mt-4 text-2xl font-bold">I can't reach the Mallow server</h1><p className="mt-2 text-ink-soft">{error ?? 'Please start it again with'} <code className="rounded bg-white px-1.5">python run.py</code></p><Button className="mt-4" onClick={refresh}>Try again</Button></div>
  if (!boot.consent || !boot.pin_set) return <Onboarding />
  return <Picker kids={children.filter((c) => !c.is_infant)} />
}

function Picker({ kids }: { kids: ReturnType<typeof useApp>['children'] }) {
  const { boot } = useApp()
  return (
    <main className="relative mx-auto min-h-screen max-w-5xl px-5 py-10">
      <header className="mb-10 text-center">
        <div className="mx-auto w-fit"><Bunny size={150} pose="wave" mood="happy" /></div>
        <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Who's here today?</h1>
        <div className="mx-auto mt-2 flex w-fit"><Squiggle /></div>
        <p className="mt-3 text-ink-soft">{boot?.companion_name ?? 'Mallow'} is an AI friend. Pick your picture to begin.</p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="child-cards">
        {kids.map((c) => {
          const st = BAND_STYLE[c.age_band] ?? BAND_STYLE['7-9']
          return (
            <Link key={c.id} to={`/child/${c.id}`} data-testid={`child-card-${c.id}`} className={`tap group relative flex flex-col items-center gap-1 overflow-hidden rounded-4xl border border-line bg-gradient-to-br ${st.bg} p-5 pt-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift`}>
              {c.is_demo && <Badge tone="butter" className="absolute right-4 top-4">Demo</Badge>}
              <Bunny size={150} accessory={st.acc} pose={c.age_band === '10-12' ? 'read' : 'sit'} />
              <div className="font-display text-2xl font-bold">{c.nickname}</div>
              <div className="text-sm font-semibold text-ink-soft">{c.age != null ? `Age ${c.age} · ` : ''}{st.label}</div>
            </Link>
          )
        })}
        <Link to="/parent" data-testid="parent-card" className="tap relative flex flex-col items-center justify-center gap-2 rounded-4xl border-2 border-dashed border-rose-soft bg-white/60 p-6 text-center transition hover:-translate-y-1 hover:bg-white">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-blush text-4xl">🔒</div>
          <div className="font-display text-2xl font-bold">Parent space</div>
          <div className="text-sm text-ink-soft">Dashboard, safety, children, infant care</div>
        </Link>
      </div>
      {kids.length === 0 && <p className="mt-6 text-center text-ink-soft">No children yet. A grown-up can add a child in <Link className="font-bold text-lav-deep underline" to="/parent/children">Parent space</Link>.</p>}
    </main>
  )
}

function Onboarding() {
  const { boot, refresh, unlock } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(boot?.consent ? 2 : 0)
  const [agree, setAgree] = useState(false)
  const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)

  const consent = async () => { setBusy(true); try { await api('/auth/consent', { method: 'POST' }); setStep(2) } catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) } }
  const makePin = async () => {
    setErr(null)
    if (pin.length < 4) return setErr('Use at least 4 characters.')
    if (pin !== pin2) return setErr('The two PINs do not match.')
    setBusy(true)
    try { const r = await api<{ token: string }>('/auth/setup-pin', { body: { pin } }); await unlock(r.token); setStep(3) } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const demo = async () => { setBusy(true); try { await api('/demo/seed', { method: 'POST' }); await refresh(); toast('Demo family added. It is clearly marked and can be removed anytime.'); nav('/parent') } catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) } }

  return (
    <main className="relative mx-auto grid min-h-screen max-w-3xl place-items-center px-5 py-10">
      <div className="relative w-full overflow-hidden rounded-5xl border border-line bg-paper/90 p-6 shadow-lift sm:p-10 paper-grain">
        <Doodles />
        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 4`}>{[0, 1, 2, 3].map((i) => <span key={i} className={`h-2 w-8 rounded-full ${i <= step ? 'bg-lav-deep' : 'bg-line'}`} />)}</div>
          {step === 0 && <>
            <Bunny size={230} pose="wave" mood="happy" />
            <h1 className="text-4xl font-bold sm:text-5xl">Hello, I'm Mallow</h1>
            <p className="max-w-lg text-lg text-ink-soft">A gentle, parent-supervised AI friend for children aged 4 to 12. We talk, learn, play and make things, in English, Telugu and Hinglish.</p>
            <Button size="lg" onClick={() => setStep(1)} data-testid="onboard-start">Let's set up</Button>
          </>}
          {step === 1 && <>
            <Bunny size={150} mood="calm" />
            <h2 className="text-3xl font-bold">Before we begin</h2>
            <ul className="max-w-xl space-y-2 text-left text-[15px] text-ink-soft">
              <li>🐰 Mallow is an <b>AI</b>. It is not a person, not a parent, and not a safety device. Grown-ups should stay involved.</li>
              <li>🔒 Messages, language and age band go to the AI services <b>you</b> configure. Names and profile details stay on this computer.</li>
              <li>🎙️ Voice recordings are processed in memory and <b>never saved</b>.</li>
              <li>👀 Chat summaries and safety notes are saved here so parents can review them. Children are told this.</li>
              <li>🤝 Mallow never keeps secrets from parents and never asks for private details.</li>
            </ul>
            <label className="flex max-w-xl cursor-pointer items-start gap-3 rounded-2xl bg-white/80 p-4 text-left text-[15px] shadow-inset"><input data-testid="consent-check" type="checkbox" className="mt-1 h-5 w-5 accent-[#9D86C9]" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>I understand, and I am the parent or carer setting this up.</span></label>
            <Button size="lg" disabled={!agree} loading={busy} onClick={consent} data-testid="consent-continue">Continue</Button>
          </>}
          {step === 2 && <>
            <Bunny size={150} mood="calm" accessory="scarf" />
            <h2 className="text-3xl font-bold">Make a parent PIN</h2>
            <p className="max-w-md text-ink-soft">The PIN keeps Parent space, safety notes and settings for grown-ups only.</p>
            <form className="w-full max-w-xs space-y-3 text-left" onSubmit={(e) => { e.preventDefault(); void makePin() }}>
              <Field label="New PIN" hint="At least 4 characters" error={err}>{(id) => <Input id={id} data-testid="pin-new" type="password" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} />}</Field>
              <Field label="Confirm PIN">{(id) => <Input id={id} data-testid="pin-confirm" type="password" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value)} />}</Field>
              <Button type="submit" size="lg" className="w-full" loading={busy} data-testid="pin-create">Create PIN</Button>
            </form>
          </>}
          {step === 3 && <>
            <Bunny size={170} pose="wave" mood="love" />
            <h2 className="text-3xl font-bold">All set! What next?</h2>
            <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
              <button onClick={() => nav('/parent/children?add=1')} data-testid="onboard-add-child" className="tap rounded-3xl border border-line bg-mint-soft p-5 text-left shadow-soft hover:-translate-y-0.5"><Flower size={34} /><div className="mt-2 font-display text-xl font-bold">Add my child</div><p className="text-sm text-ink-soft">Start fresh with your own family.</p></button>
              <button onClick={demo} disabled={busy} data-testid="onboard-demo" className="tap rounded-3xl border border-line bg-butter-soft p-5 text-left shadow-soft hover:-translate-y-0.5"><Star size={30} /><div className="mt-2 font-display text-xl font-bold">Look around with a demo family</div><p className="text-sm text-ink-soft">Three children and a baby with two weeks of clearly labelled sample data. Remove it anytime.</p></button>
            </div>
          </>}
        </div>
      </div>
    </main>
  )
}
