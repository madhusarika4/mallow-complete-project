import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import MallowChat from '../../components/MallowChat'
import ReadAloud, { SpeakButton, SpokenFeedback } from '../../components/ReadAloud'
import FeelingsCheckIn from '../../components/FeelingsCheckIn'
import Research from './Research'
import { Doodles } from '../../components/Decor'
import { getProgress, logActivity } from '../../lib/activity'
import { api } from '../../lib/api'
import type { ActivityKind, Child, Progress } from '../../lib/types'
import { Badge, Button, Card, Field, Input, Segmented, Select, Textarea, useToast } from '../../ui'
import { BackBar, Choice, Locked, Result, allowed, useElapsed } from '../../pages/child46/kit'
import { DEBATES, FOCUS_STEPS, SUBJECTS, WRITING_PROMPTS, type Subject } from './data'

function track(childId: number, kind: ActivityKind, title: string, detail = '', score?: number, max?: number, seconds?: number) {
  void logActivity(childId, { kind, title, detail, score, max, seconds }).catch(() => undefined)
}

export default function Experience({ child }: { child: Child }) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <Routes>
        <Route index element={<Home child={child} />} />
        <Route path="study" element={<Study child={child} />} />
        <Route path="study/:subjectId" element={<SubjectPage child={child} />} />
        <Route path="homework" element={<Homework child={child} />} />
        <Route path="research" element={<Research child={child} />} />
        <Route path="write" element={<Writing child={child} />} />
        <Route path="debate" element={<Debate child={child} />} />
        <Route path="projects" element={<Projects child={child} />} />
        <Route path="journal" element={<Journal child={child} />} />
        <Route path="feelings" element={<FeelingsCheckIn child={child} />} />
        <Route path="focus" element={<Focus child={child} />} />
        <Route path="chat" element={<Chat child={child} />} />
        <Route path="*" element={<Navigate to={`/child/${child.id}`} replace />} />
      </Routes>
    </main>
  )
}

function Home({ child }: { child: Child }) {
  const [progress, setProgress] = useState<Progress | null>(null)
  useEffect(() => { getProgress(child.id).then(setProgress).catch(() => undefined) }, [child.id])
  const cards = [
    { to: 'study', gate: 'study', title: 'Study hub', line: 'Clear explanations, examples and quick checks.', emoji: '🔬', tone: 'from-mint-soft to-teal-soft' },
    { to: 'homework', gate: 'chat', title: 'Homework helper', line: 'Work through a problem without just copying answers.', emoji: '📚', tone: 'from-lav-soft to-lav' },
    { to: 'research', gate: 'study', title: 'Research desk', line: 'Plan a safe search and check your sources.', emoji: '🔎', tone: 'from-mint-soft to-teal-soft' },
    { to: 'write', gate: 'writing', title: 'Writing studio', line: 'Prompts, drafts and saved pieces you can hear aloud.', emoji: '✍️', tone: 'from-blush-soft to-peach-soft' },
    { to: 'debate', gate: 'study', title: 'Think it through', line: 'Practise arguing both sides of a real question.', emoji: '⚖️', tone: 'from-butter-soft to-peach-soft' },
    { to: 'projects', gate: 'projects', title: 'Project planner', line: 'Break a goal into steps and tick them off.', emoji: '🗂️', tone: 'from-lav-soft to-blush' },
    { to: 'journal', gate: 'journal', title: 'Private journal', line: 'A quiet place to write. Text stays private.', emoji: '🕯️', tone: 'from-teal-soft to-mint-soft' },
    { to: 'feelings', gate: 'chat', title: 'Feelings', line: 'Check in, name the feeling, and decide what helps.', emoji: '💛', tone: 'from-teal-soft to-butter-soft' },
    { to: 'focus', gate: 'study', title: 'Focus timer', line: 'Short focused sessions with real breaks.', emoji: '⏳', tone: 'from-peach-soft to-butter-soft' },
    { to: 'chat', gate: 'chat', title: 'Talk with Mallow', line: 'Voice or text, for questions big and small.', emoji: '💬', tone: 'from-lav-soft to-mint-soft' },
  ]
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-5xl border border-line bg-paper/90 p-5 shadow-lift paper-grain sm:p-7">
        <Doodles />
        <div className="relative z-10 grid items-center gap-5 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-lav-deep">Ages 10-12</p>
            <h1 className="mt-1 font-display text-4xl font-bold sm:text-5xl">Hello, {child.nickname}</h1>
            <p className="mt-2 max-w-2xl text-lg text-ink-soft">More independence, more depth. Choose what you want to understand, make, or think about.</p>
            <div className="mt-3"><ReadAloud child={child} text={`Hi ${child.nickname}. Choose what you want to understand, make, or think about. I am here if you want to talk it through.`} compact mood="calm" mode="chat" label="Hear this page" /></div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/" className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Choose child</Link>
              <Link to="/parent" className="tap rounded-full bg-lav-soft px-4 py-2 text-sm font-bold text-lav-deep shadow-inset">Grown-up space</Link>
            </div>
          </div>
          <Bunny size={190} pose="read" mood="calm" accessory="glasses" />
        </div>
      </section>
      {progress && (
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Progress">
          <Tile label="Stars saved" value={progress.stars} />
          <Tile label="Things tried" value={progress.total} />
          <Tile label="Day streak" value={progress.streak_days} />
        </section>
      )}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Activities">
        {cards.map((c) => {
          const on = !c.gate || allowed(child, c.gate)
          return (
            <div key={c.to} className="relative">
              <Link to={c.to} data-testid={`thinker-${c.to}`} className={`tap group flex min-h-[13rem] flex-col rounded-5xl border border-line bg-gradient-to-br ${c.tone} p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lift`}>
                <div className="text-4xl" aria-hidden>{c.emoji}</div>
                <h2 className="mt-2 font-display text-2xl font-bold">{c.title}</h2>
                <p className="mt-1 pr-12 text-sm font-semibold text-ink-soft">{on ? c.line : 'Resting for now. A grown-up turned this off.'}</p>
                <span className="mt-auto inline-flex w-fit rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-ink-soft shadow-inset">{on ? 'Open' : 'Resting'}</span>
              </Link>
              <div className="absolute bottom-3 right-3"><SpeakButton child={child} text={`${c.title}. ${c.line}`} label={`Hear ${c.title}`} /></div>
            </div>
          )
        })}
      </section>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  return <div className="rounded-4xl border border-line bg-white/75 p-4 text-center shadow-soft"><div className="font-display text-4xl font-bold">{value}</div><div className="text-sm font-bold text-ink-soft">{label}</div></div>
}

function Page({ child, gate, title, to = `/child/${child.id}`, children }: { child: Child; gate?: string; title: string; to?: string; children: React.ReactNode }) {
  if (gate && !allowed(child, gate)) return <div><BackBar title={title} to={to} /><Locked what={title} /></div>
  return <div className="space-y-5"><BackBar title={title} to={to} />{children}</div>
}

function Study({ child }: { child: Child }) {
  return (
    <Page child={child} gate="study" title="Study hub">
      <div className="grid gap-4 sm:grid-cols-2">
        {SUBJECTS.map((s) => (
          <Link key={s.id} to={s.id} className="tap rounded-5xl border border-line bg-white/80 p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
            <div className="flex items-center gap-4"><div className="grid h-20 w-20 place-items-center rounded-4xl text-4xl" style={{ background: s.tint }}>{s.emoji}</div><div><h2 className="font-display text-3xl font-bold">{s.title}</h2><p className="text-sm text-ink-soft">{s.blurb}</p><p className="mt-1 text-xs font-bold" style={{ color: s.deep }}>{s.concepts.length} explanations · {s.checks.length} quick checks</p></div></div>
          </Link>
        ))}
      </div>
    </Page>
  )
}

function SubjectPage({ child }: { child: Child }) {
  const { subjectId } = useParams()
  const subject = SUBJECTS.find((s) => s.id === subjectId)
  if (!subject) return <Navigate to={`/child/${child.id}/study`} replace />
  return <SubjectBody child={child} subject={subject} />
}

function SubjectBody({ child, subject }: { child: Child; subject: Subject }) {
  const [i, setI] = useState(0)
  const [quiz, setQuiz] = useState(false)
  const c = subject.concepts[i]
  return (
    <Page child={child} gate="study" title={subject.title} to={`/child/${child.id}/study`}>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 sm:p-7">
          <div className="flex items-center justify-between gap-2"><Badge tone="mint">Concept {i + 1} of {subject.concepts.length}</Badge><span className="text-3xl" aria-hidden>{subject.emoji}</span></div>
          <h2 className="mt-3 font-display text-3xl font-bold">{c.title}</h2>
          <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">{c.text}</p>
          <div className="mt-3 rounded-3xl bg-lav-soft p-4 text-[15px] leading-relaxed"><b>Example: </b>{c.example}</div>
          <div className="mt-4"><ReadAloud child={child} text={`${c.title}. ${c.text} ${c.example}`} mood="calm" mode="explain" label="Read the explanation" /></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="soft" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))}>← Previous</Button>
            {i < subject.concepts.length - 1 ? <Button onClick={() => setI((x) => x + 1)}>Next concept →</Button> : <Button tone="mint" onClick={() => setQuiz(true)}>Quick check 🎯</Button>}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5" tone="mint">
            <h3 className="font-display text-xl font-bold">Study smarter</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-soft">
              <li>• Explain it out loud in your own words.</li>
              <li>• Make one example that is not in the text.</li>
              <li>• Test yourself before you feel ready.</li>
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="font-display text-xl font-bold">Ask a deeper question</h3>
            <p className="text-sm text-ink-soft">Take a “why” or “how do we know?” question to Mallow.</p>
            <Link to={`/child/${child.id}/chat?context=${encodeURIComponent(`${subject.title}: ${c.title}. ${c.text}`)}`} className="tap mt-3 inline-block rounded-full bg-lav-deep px-4 py-2 text-sm font-bold text-white">💬 Ask Mallow</Link>
          </Card>
        </div>
      </div>
      {quiz && <CheckQuiz child={child} subject={subject} onClose={() => setQuiz(false)} />}
    </Page>
  )
}

function CheckQuiz({ child, subject, onClose }: { child: Child; subject: Subject; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const elapsed = useElapsed()
  const q = subject.checks[i]
  if (i >= subject.checks.length) return <Result stars={score === subject.checks.length ? 3 : score >= 1 ? 2 : 1} title="Quick check done" line={`${score} of ${subject.checks.length} correct`} onAgain={() => { setI(0); setScore(0); setPicked(null) }} backTo={`/child/${child.id}/study`} />
  const choose = (idx: number) => {
    if (picked != null) return
    setPicked(idx)
    if (idx === q.answer) setScore((s) => s + 1)
    if (i + 1 >= subject.checks.length) track(child.id, 'quiz', `${subject.title} quick check`, subject.id, score + (idx === q.answer ? 1 : 0), subject.checks.length, elapsed())
  }
  return (
    <Card className="mx-auto max-w-3xl p-5 sm:p-7">
      <div className="flex items-center justify-between"><span className="text-sm font-bold uppercase tracking-widest text-lav-deep">Check {i + 1} of {subject.checks.length}</span><button onClick={onClose} className="tap rounded-full bg-white px-3 py-1 text-sm font-bold text-ink-soft shadow-inset">Close</button></div>
      <h2 className="mt-2 font-display text-3xl font-bold">{q.q}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2"><ReadAloud child={child} text={`${q.q}. Choices: ${q.options.join(', ')}.`} compact mood="calm" mode="explain" label="Hear the question and choices" /><Link to={`/child/${child.id}/chat?context=${encodeURIComponent(`Quiz question: ${q.q}`)}`} className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Ask Mallow</Link></div>
      {picked != null && <SpokenFeedback child={child} text={picked === q.answer ? 'Correct. Well done!' : `Not quite. The answer is ${q.options[q.answer]}. ${q.why}`} mood={picked === q.answer ? 'happy' : 'calm'} />}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {q.options.map((o, idx) => <Choice key={o} state={picked != null ? (idx === q.answer ? 'right' : idx === picked ? 'wrong' : null) : null} disabled={picked != null} onClick={() => choose(idx)}>{o}</Choice>)}
      </div>
      {picked != null && (
        <div className="mt-4 rounded-3xl bg-mint-soft p-4">
          <p className="font-bold">{picked === q.answer ? 'Correct.' : `The answer is ${q.options[q.answer]}.`}</p>
          <p className="text-sm text-ink-soft">{q.why}</p>
          <Button className="mt-3" onClick={() => { setPicked(null); setI((x) => x + 1) }}>{i + 1 >= subject.checks.length ? 'See result' : 'Next check →'}</Button>
        </div>
      )}
    </Card>
  )
}

function Homework({ child }: { child: Child }) {
  return (
    <Page child={child} gate="chat" title="Homework helper">
      <MallowChat
        child={child}
        variant="study"
        mode="homework"
        starters={[
          { label: 'Explain fractions', text: 'I do not understand how to compare fractions. Can you explain with an example?', mode: 'homework' },
          { label: 'Science method', text: 'How do I write a good method for a science experiment?', mode: 'homework' },
          { label: 'Essay plan', text: 'Help me plan an essay about whether homework should be optional.', mode: 'homework' },
          { label: 'Check my reasoning', text: 'Here is my answer. Can you help me check the reasoning instead of giving the answer?', mode: 'homework' },
        ]}
        modes={[{ id: 'homework', label: 'Homework' }, { id: 'explain', label: 'Explain' }, { id: 'study', label: 'Study' }, { id: 'chat', label: 'Chat' }]}
      />
    </Page>
  )
}

interface Creation { id: number; kind: string; title: string; content: string; created_at: string }

function Writing({ child }: { child: Child }) {
  const toast = useToast()
  const [prompt, setPrompt] = useState(WRITING_PROMPTS[0])
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<Creation[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { api<Creation[]>(`/children/${child.id}/creations?kind=writing`).then(setSaved).catch(() => undefined) }, [child.id])
  const save = async () => {
    if (!text.trim()) { toast('Write something first.', 'err'); return }
    setBusy(true)
    try {
      const c = await api<Creation>(`/children/${child.id}/creations`, { body: { kind: 'writing', title: title.trim() || prompt.slice(0, 60), content: text.trim() } })
      setSaved((s) => [c, ...s]); toast('Saved. Nice work.')
      track(child.id, 'writing', 'Writing studio', 'Saved a piece', 1, 1)
    } catch { toast('Could not save right now.', 'err') } finally { setBusy(false) }
  }
  return (
    <Page child={child} gate="writing" title="Writing studio">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Jump-off prompts</h2>
          <ul className="mt-3 space-y-2">{WRITING_PROMPTS.map((p) => <li key={p}><button onClick={() => setPrompt(p)} className={`tap w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold shadow-inset ${prompt === p ? 'bg-lav text-lav-deep' : 'bg-white/80 text-ink-soft hover:bg-lav-soft'}`}>{p}</button></li>)}</ul>
        </Card>
        <Card className="p-5">
          <Field label="Title (optional)">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Give it a name" />}</Field>
          <label htmlFor="write-draft" className="mt-3 block text-sm font-bold text-ink-soft">Your piece</label>
          <Textarea id="write-draft" value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} placeholder={prompt} className="mt-1 min-h-[16rem] text-[16px] leading-relaxed" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => void save()} loading={busy} disabled={!text.trim()}>Save piece</Button>
            <ReadAloud child={child} text={text.trim() || prompt} mode="story" label="Hear it read" />
          </div>
        </Card>
      </div>
      {saved.length > 0 && <Card className="p-5"><h2 className="font-display text-2xl font-bold">Saved work</h2><ul className="mt-2 space-y-2">{saved.slice(0, 8).map((s) => <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 shadow-inset"><b className="truncate">{s.title}</b><span className="text-xs text-ink-soft">{s.created_at.slice(0, 10)}</span><ReadAloud child={child} text={s.content} compact mode="story" label="Hear" /></li>)}</ul></Card>}
    </Page>
  )
}

function Debate({ child }: { child: Child }) {
  const [idx, setIdx] = useState(0)
  const [side, setSide] = useState<'for' | 'against'>('for')
  const [argument, setArgument] = useState('')
  const [counter, setCounter] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const elapsed = useElapsed()
  const d = DEBATES[idx]
  const own = side === 'for' ? d.forPoints : d.againstPoints
  const other = side === 'for' ? d.againstPoints : d.forPoints
  const reset = () => { setArgument(''); setCounter(''); setSubmitted(false) }
  const submit = () => {
    setSubmitted(true)
    track(child.id, 'study', 'Think it through', d.q, 1, 1, elapsed())
  }
  return (
    <Page child={child} gate="study" title="Think it through">
      <Card className="mx-auto max-w-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone="butter">Question {idx + 1} of {DEBATES.length}</Badge><button onClick={() => { setIdx((i) => (i + 1) % DEBATES.length); reset(); setSide('for') }} className="tap rounded-full bg-white px-3 py-1 text-sm font-bold text-ink-soft shadow-inset">Next question →</button></div>
        <h2 className="mt-3 font-display text-3xl font-bold">{d.q}</h2>
        <div className="mt-3"><ReadAloud child={child} text={d.q} compact mood="calm" mode="explain" label="Hear the question" /></div>
        <div className="mt-4"><Segmented label="Pick a side" value={side} onChange={(s) => { setSide(s); reset() }} options={[{ value: 'for', label: 'For' }, { value: 'against', label: 'Against' }]} /></div>
        <label htmlFor="debate-arg" className="mt-4 block text-sm font-bold text-ink-soft">Your strongest argument</label>
        <Textarea id="debate-arg" value={argument} onChange={(e) => setArgument(e.target.value)} maxLength={1200} placeholder="Give a reason and an example…" className="mt-1" />
        <label htmlFor="debate-counter" className="mt-3 block text-sm font-bold text-ink-soft">Now steel-man the other side</label>
        <Textarea id="debate-counter" value={counter} onChange={(e) => setCounter(e.target.value)} maxLength={1200} placeholder="What is the best point someone who disagrees could make?" className="mt-1" />
        <div className="mt-3 flex flex-wrap items-center gap-2"><Button onClick={submit} disabled={!argument.trim() || !counter.trim()}>Think it through</Button><ReadAloud child={child} text={`${d.q}. For: ${d.forPoints.join('. ')}. Against: ${d.againstPoints.join('. ')}.`} compact mode="explain" label="Hear both sides" /></div>
        {submitted && (
          <div className="mt-4 space-y-3">
            <div className="rounded-3xl bg-mint-soft p-4"><p className="font-bold">Your side ({side})</p><ul className="mt-1 space-y-1 text-sm text-ink-soft">{own.map((p) => <li key={p}>• {p}</li>)}</ul></div>
            <div className="rounded-3xl bg-lav-soft p-4"><p className="font-bold">The other side</p><ul className="mt-1 space-y-1 text-sm text-ink-soft">{other.map((p) => <li key={p}>• {p}</li>)}</ul></div>
            <p className="text-sm text-ink-soft">Strong thinking can hold two ideas at once. What would change your mind?</p>
          </div>
        )}
      </Card>
    </Page>
  )
}

interface Project { id: number; kind: string; title: string; goal: string; due_on: string | null; steps: { text: string; done: boolean }[]; status: string }

function Projects({ child }: { child: Child }) {
  const toast = useToast()
  const [items, setItems] = useState<Project[] | null>(null)
  const [kind, setKind] = useState<'project' | 'plan' | 'goal'>('project')
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [steps, setSteps] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => api<Project[]>(`/children/${child.id}/projects`).then(setItems).catch(() => setItems([]))
  useEffect(() => { void load() }, [child.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const add = async () => {
    if (!title.trim()) { toast('Give the project a name.', 'err'); return }
    setBusy(true)
    try {
      await api(`/children/${child.id}/projects`, { body: { kind, title: title.trim(), goal: goal.trim(), steps: steps.split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, done: false })) } })
      setTitle(''); setGoal(''); setSteps(''); toast('Project created.'); await load()
    } catch { toast('Could not create the project.', 'err') } finally { setBusy(false) }
  }
  const toggle = async (p: Project, i: number) => {
    const next = p.steps.map((s, k) => k === i ? { ...s, done: !s.done } : s)
    try { await api(`/children/${child.id}/projects/${p.id}`, { method: 'PATCH', body: { steps: next } }); await load() } catch { toast('Could not update the step.', 'err') }
  }
  const finish = async (p: Project) => {
    try { await api(`/children/${child.id}/projects/${p.id}`, { method: 'PATCH', body: { status: p.status === 'done' ? 'active' : 'done' } }); await load() } catch { toast('Could not update the project.', 'err') }
  }
  return (
    <Page child={child} gate="projects" title="Project planner">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Start something</h2>
          <div className="mt-2"><Segmented label="Type" value={kind} onChange={(k) => setKind(k)} options={[{ value: 'project', label: 'Project' }, { value: 'plan', label: 'Learning plan' }, { value: 'goal', label: 'Goal' }]} /></div>
          <div className="mt-2"><ReadAloud child={child} text="Choose a project, learning plan, or goal. Break it into small steps so you know what to do next." compact label="Hear how" /></div>
          <Field label="Title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Science fair model" />}</Field>
          <Field label="Goal (optional)">{(id) => <Input id={id} value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={400} placeholder="What does done look like?" />}</Field>
          <label htmlFor="project-steps" className="mt-3 block text-sm font-bold text-ink-soft">Steps (one per line)</label>
          <Textarea id="project-steps" value={steps} onChange={(e) => setSteps(e.target.value)} maxLength={2000} placeholder={'Research the topic\nGather materials\nBuild a first version'} className="mt-1" />
          <Button className="mt-3" onClick={() => void add()} loading={busy} disabled={!title.trim()}>Create {kind === 'project' ? 'project' : kind === 'plan' ? 'plan' : 'goal'}</Button>
        </Card>
        <div className="space-y-4">
          {items === null ? <Card className="p-5 text-sm text-ink-soft">Loading projects…</Card> : items.length === 0 ? <Card className="p-5 text-sm text-ink-soft">No projects yet. Break a goal into small steps and start.</Card> : items.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-display text-2xl font-bold">{p.title}</h3>{p.goal && <p className="text-sm text-ink-soft">{p.goal}</p>}<p className="text-xs font-bold uppercase tracking-widest text-ink-faint">{p.kind === 'plan' ? 'Learning plan' : p.kind === 'goal' ? 'Goal' : 'Project'}</p></div><Badge tone={p.status === 'done' ? 'mint' : 'lav'}>{p.status === 'done' ? 'Done' : 'Active'}</Badge></div>
              <ul className="mt-3 space-y-1.5">{p.steps.map((s, i) => <li key={i}><button onClick={() => void toggle(p, i)} className="tap flex w-full items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-left text-sm shadow-inset"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${s.done ? 'border-mint-deep bg-mint-deep text-white' : 'border-line'}`}>{s.done ? '✓' : ''}</span><span className={s.done ? 'text-ink-faint line-through' : ''}>{s.text}</span></button></li>)}</ul>
              <div className="mt-3"><Button size="sm" variant="soft" tone={p.status === 'done' ? 'ink' : 'mint'} onClick={() => void finish(p)}>{p.status === 'done' ? 'Reopen' : 'Mark complete'}</Button></div>
            </Card>
          ))}
        </div>
      </div>
    </Page>
  )
}

interface JournalEntry { id: number; text: string; mood: string; created_at: string }

function Journal({ child }: { child: Child }) {
  const toast = useToast()
  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [text, setText] = useState('')
  const [mood, setMood] = useState('')
  const [support, setSupport] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => api<JournalEntry[]>(`/children/${child.id}/journal`).then(setEntries).catch(() => setEntries([]))
  useEffect(() => { void load() }, [child.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      const r = await api<{ id: number; support: string | null }>(`/children/${child.id}/journal`, { body: { text: text.trim(), mood } })
      setText(''); setMood(''); setSupport(r.support); toast('Saved to your journal.'); await load()
    } catch { toast('Could not save the entry.', 'err') } finally { setBusy(false) }
  }
  const del = async (id: number) => { try { await api(`/children/${child.id}/journal/${id}`, { method: 'DELETE' }); await load() } catch { toast('Could not delete the entry.', 'err') } }
  return (
    <Page child={child} gate="journal" title="Private journal">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Write freely</h2>
          <p className="text-sm text-ink-soft">Your grown-up can see how many entries you have, but not what you wrote. If you write something that worries Mallow about your safety, Mallow may encourage you to talk to a trusted adult.</p>
          <div className="mt-2"><ReadAloud child={child} text="This journal is private. Your grown-up can see how many entries you have, but not what you wrote. If something worries Mallow about your safety, Mallow may encourage you to talk to a trusted adult." compact mood="calm" mode="chat" label="Hear how this works" /></div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} placeholder="Today I…" className="mt-3 min-h-[14rem] text-[16px] leading-relaxed" />
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem]"><Field label="Mood (optional)">{(id) => <Select id={id} value={mood} onChange={(e) => setMood(e.target.value)}><option value="">Prefer not to say</option>{['happy', 'calm', 'okay', 'sad', 'worried', 'angry'].map((m) => <option key={m} value={m}>{m}</option>)}</Select>}</Field></div>
            <Button onClick={() => void save()} loading={busy} disabled={!text.trim()}>Save entry</Button>
          </div>
          {support && <div role="note" className="mt-3 rounded-3xl bg-blush px-4 py-3 text-sm font-semibold text-rose-deep">{support}</div>}
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Past entries</h2>
          {entries === null ? <p className="text-sm text-ink-soft">Loading…</p> : entries.length === 0 ? <p className="mt-2 text-sm text-ink-soft">Nothing yet. This space is yours whenever you need it.</p> : (
            <ul className="mt-2 max-h-[28rem] space-y-2 overflow-y-auto pr-1 scroll-soft">{entries.map((e) => <li key={e.id} className="rounded-3xl bg-white/80 p-3 shadow-inset"><div className="flex items-center justify-between gap-2 text-xs text-ink-soft"><span>{e.created_at.slice(0, 10)}{e.mood ? ` · ${e.mood}` : ''}</span><button onClick={() => void del(e.id)} className="tap rounded-full px-2 py-1 font-bold text-[#C2566F] hover:bg-[#FFE9ED]">Delete</button></div><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{e.text}</p></li>)}</ul>
          )}
        </Card>
      </div>
    </Page>
  )
}

function Focus({ child }: { child: Child }) {
  const [minutes, setMinutes] = useState(15)
  const [left, setLeft] = useState(15 * 60)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const started = useRef(0)
  const completed = useRef(false)
  const tick = useRef<number | null>(null)
  useEffect(() => { setLeft(minutes * 60); setRunning(false); setDone(false); completed.current = false }, [minutes])
  useEffect(() => {
    if (!running) return
    tick.current = window.setInterval(() => {
      setLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => { if (tick.current) window.clearInterval(tick.current) }
  }, [running])
  useEffect(() => {
    if (left !== 0 || completed.current) return
    completed.current = true
    setRunning(false)
    setDone(true)
    track(child.id, 'focus', 'Focus session', `${minutes} minutes`, minutes, minutes, started.current ? Math.round((Date.now() - started.current) / 1000) : minutes * 60)
  }, [left, minutes, child.id])
  const start = () => { if (left === 0) setLeft(minutes * 60); started.current = Date.now(); completed.current = false; setDone(false); setRunning(true) }
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return (
    <Page child={child} gate="study" title="Focus timer">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6 text-center">
          <Segmented label="Session length" value={minutes} onChange={(m) => setMinutes(m)} options={[{ value: 5, label: '5 min' }, { value: 15, label: '15 min' }, { value: 25, label: '25 min' }]} />
          <div className="my-6 font-display text-7xl font-bold tabular-nums" aria-live="polite">{mm}:{ss}</div>
          <div className="flex flex-wrap justify-center gap-2">
            {!running && <Button size="lg" onClick={start}>{left === 0 ? 'Go again' : done ? 'Go again' : 'Start focus'}</Button>}
            {running && <Button size="lg" variant="soft" tone="peach" onClick={() => setRunning(false)}>Pause</Button>}
            <Button size="lg" variant="ghost" onClick={() => { setRunning(false); setLeft(minutes * 60); setDone(false) }}>Reset</Button>
          </div>
          {done && <div className="mt-5 rounded-3xl bg-mint-soft p-4"><SpokenFeedback child={child} text="Focus session complete. Take a short break before the next one." mood="happy" /><p className="text-xl font-bold">Session complete. 🌿</p><p className="text-sm text-ink-soft">Take a short break before the next one.</p></div>}
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">A simple focus routine</h2>
          <div className="mt-2"><ReadAloud child={child} text={`A simple focus routine. ${FOCUS_STEPS.join(' ')}`} compact mood="calm" mode="explain" label="Hear the routine" /></div>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">{FOCUS_STEPS.map((s, i) => <li key={s} className="flex gap-2 rounded-2xl bg-white/80 px-3 py-2 shadow-inset"><span className="font-bold text-lav-deep">{i + 1}.</span><span>{s}</span></li>)}</ol>
          <p className="mt-3 text-xs text-ink-faint">Timer stays in this tab. Mallow does not listen while you focus.</p>
        </Card>
      </div>
    </Page>
  )
}

function Chat({ child }: { child: Child }) {
  const [params] = useSearchParams()
  return (
    <Page child={child} gate="chat" title="Talk with Mallow">
      <MallowChat
        child={child}
        variant="study"
        context={params.get('context') ?? ''}
        starters={[
          { label: 'Big question', text: 'Why do humans dream? Give me the main theories and what we still do not know.', mode: 'explain' },
          { label: 'Study plan', text: 'Help me make a revision plan for a test in five days.', mode: 'study' },
          { label: 'Explain simply', text: 'Explain how vaccines work as if I am twelve, with an analogy.', mode: 'explain' },
          { label: 'Talk it out', text: 'I feel stressed about school. Can you help me think it through without judging me?', mode: 'chat' },
        ]}
        modes={[{ id: 'chat', label: 'Chat' }, { id: 'explain', label: 'Explain' }, { id: 'study', label: 'Study' }, { id: 'homework', label: 'Homework' }]}
      />
    </Page>
  )
}
