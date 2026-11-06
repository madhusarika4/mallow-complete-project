import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import MallowChat from '../../components/MallowChat'
import ReadAloud, { SpeakButton, SpokenFeedback } from '../../components/ReadAloud'
import { Doodles, Star } from '../../components/Decor'
import { getProgress, logActivity } from '../../lib/activity'
import { api } from '../../lib/api'
import type { ActivityKind, Child, Progress } from '../../lib/types'
import { Button, Card, Input, Segmented, useToast } from '../../ui'
import { BackBar, Choice, Locked, Result, allowed, pick, shuffle, useElapsed } from '../../pages/child46/kit'
import { HANGMAN, HEROES, MEMORY_EMOJI, PLACES, PROBLEMS, QUESTS, SCRAMBLE, STARTERS, TOPICS, type Topic } from './data'
import { Feelings, Projects } from './Extras'

const CARD = 'tap group relative min-h-[11rem] overflow-hidden rounded-5xl border border-line bg-white/80 p-5 text-left shadow-soft transition hover:-translate-y-1 hover:shadow-lift'

function track(childId: number, kind: ActivityKind, title: string, detail = '', score?: number, max?: number, seconds?: number) {
  void logActivity(childId, { kind, title, detail, score, max, seconds }).catch(() => undefined)
}

export default function Experience({ child }: { child: Child }) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <Routes>
        <Route index element={<Home child={child} />} />
        <Route path="learn" element={<Explore child={child} />} />
        <Route path="learn/:topicId" element={<TopicPage child={child} />} />
        <Route path="quests" element={<Quests child={child} />} />
        <Route path="quests/:questId" element={<QuestRunner child={child} />} />
        <Route path="games" element={<Games child={child} />} />
        <Route path="create" element={<Create child={child} />} />
        <Route path="projects" element={<Projects child={child} />} />
        <Route path="feelings" element={<Feelings child={child} />} />
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
    { to: 'learn', gate: 'learning', title: 'Explore', line: 'Space, animals, bodies, weather and more.', emoji: '🪐', tone: 'from-lav-soft to-lav' },
    { to: 'quests', gate: 'quests', title: 'Quests', line: 'Five-step adventures with a badge at the end.', emoji: '🗺️', tone: 'from-mint-soft to-teal-soft' },
    { to: 'games', gate: 'games', title: 'Word & memory games', line: 'Scrambles, hangman and pair matching.', emoji: '🧩', tone: 'from-butter-soft to-peach-soft' },
    { to: 'create', gate: 'writing', title: 'Story maker', line: 'Build a story with Mallow, then read it aloud.', emoji: '✍️', tone: 'from-blush-soft to-peach-soft' },
    { to: 'projects', gate: 'projects', title: 'Projects', line: 'Break a big idea into small steps you can finish.', emoji: '🗂️', tone: 'from-mint-soft to-lav-soft' },
    { to: 'feelings', gate: '', title: 'Feelings', line: 'Check in with yourself and talk it out.', emoji: '💛', tone: 'from-teal-soft to-butter-soft' },
    { to: 'chat', gate: 'chat', title: 'Talk with Mallow', line: 'Ask questions by voice or text.', emoji: '💬', tone: 'from-lav-soft to-blush' },
  ]
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-5xl border border-line bg-paper/90 p-5 shadow-lift paper-grain sm:p-7">
        <Doodles />
        <div className="relative z-10 grid items-center gap-5 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-mint-deep">Ages 7-9</p>
            <h1 className="mt-1 font-display text-4xl font-bold sm:text-5xl">Hi, {child.nickname}</h1>
            <p className="mt-2 max-w-2xl text-lg text-ink-soft">Pick something to explore. Mallow will explain, quiz you, or just listen.</p>
            <div className="mt-3"><ReadAloud child={child} text={`Hi ${child.nickname}. Pick something to explore. I can explain, quiz you, or just listen.`} compact mood="happy" mode="chat" label="Hear this page" /></div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/" className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Choose child</Link>
              <Link to="/parent" className="tap rounded-full bg-lav-soft px-4 py-2 text-sm font-bold text-lav-deep shadow-inset">Grown-up space</Link>
            </div>
          </div>
          <Bunny size={190} pose="wave" mood="happy" accessory="scarf" />
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
              <Link to={c.to} data-testid={`explorer-${c.to}`} className={`${CARD} block bg-gradient-to-br ${c.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><div className="text-4xl" aria-hidden>{c.emoji}</div><h2 className="mt-2 font-display text-3xl font-bold">{c.title}</h2><p className="mt-1 pr-12 font-semibold text-ink-soft">{on ? c.line : 'Resting for now. A grown-up turned this off.'}</p></div>
                  <Star size={40} className="opacity-70" />
                </div>
                <span className="absolute bottom-4 left-5 rounded-full bg-white/85 px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">{on ? 'Open' : 'Resting'}</span>
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

function Page({ child, gate, title, to = `/child/${child.id}`, children }: { child: Child; gate?: string; title: string; to?: string; children: ReactNode }) {
  if (gate && !allowed(child, gate)) return <div><BackBar title={title} to={to} /><Locked what={title} /></div>
  return <div className="space-y-5"><BackBar title={title} to={to} />{children}</div>
}

function Explore({ child }: { child: Child }) {
  return (
    <Page child={child} gate="learning" title="Explore">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((topic) => (
          <Link key={topic.id} to={topic.id} className="tap rounded-5xl border border-line bg-white/80 p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
            <div className="mb-3 grid h-24 place-items-center rounded-4xl text-5xl" style={{ background: topic.tint }}>{topic.emoji}</div>
            <h2 className="font-display text-3xl font-bold">{topic.title}</h2>
            <p className="font-semibold text-ink-soft">{topic.blurb}</p>
            <p className="mt-2 text-sm font-bold" style={{ color: topic.deep }}>6 facts · a quiz →</p>
          </Link>
        ))}
      </div>
    </Page>
  )
}

function TopicPage({ child }: { child: Child }) {
  const { topicId } = useParams()
  const topic = TOPICS.find((t) => t.id === topicId)
  if (!topic) return <Navigate to={`/child/${child.id}/learn`} replace />
  return <TopicBody child={child} topic={topic} />
}

function TopicBody({ child, topic }: { child: Child; topic: Topic }) {
  const [i, setI] = useState(0)
  const [showQuiz, setShowQuiz] = useState(false)
  const fact = topic.facts[i]
  const spoken = `${fact.title}. ${fact.text}`
  return (
    <Page child={child} gate="learning" title={topic.title} to={`/child/${child.id}/learn`}>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-ink-soft shadow-inset">Fact {i + 1} of {topic.facts.length}</span>
            <span className="text-4xl" aria-hidden>{fact.emoji}</span>
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold">{fact.title}</h2>
          <p className="mt-2 text-xl leading-relaxed text-ink-soft">{fact.text}</p>
          <div className="mt-4"><ReadAloud child={child} text={spoken} mood="calm" mode="explain" label="Read this fact" /></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="soft" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))}>← Back</Button>
            {i < topic.facts.length - 1
              ? <Button onClick={() => setI((x) => x + 1)}>Next fact →</Button>
              : <Button tone="mint" onClick={() => setShowQuiz(true)}>Take the quiz 🎯</Button>}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5" tone="mint">
            <h3 className="font-display text-xl font-bold">Did you know?</h3>
            <p className="mt-1 leading-relaxed text-ink-soft">{topic.didYouKnow}</p>
            <div className="mt-3"><ReadAloud child={child} text={topic.didYouKnow} compact mood="happy" mode="explain" label="Hear it" /></div>
          </Card>
          <Card className="p-5">
            <h3 className="font-display text-xl font-bold">Ask Mallow</h3>
            <p className="text-sm text-ink-soft">Curious about something in {topic.title.toLowerCase()}? Take the question to chat.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={`/child/${child.id}/chat?context=${encodeURIComponent(`${topic.title}: ${topic.didYouKnow}`)}`} className="tap rounded-full bg-lav-deep px-4 py-2 text-sm font-bold text-white">💬 Chat about this</Link>
              <button onClick={() => setShowQuiz(true)} className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Quiz me</button>
            </div>
          </Card>
        </div>
      </div>
      {showQuiz && <QuizPanel child={child} topic={topic} onClose={() => setShowQuiz(false)} />}
    </Page>
  )
}

function QuizPanel({ child, topic, onClose }: { child: Child; topic: Topic; onClose: () => void }) {
  const items = useMemo(() => topic.quiz.map((q) => ({ ...q, options: shuffle(q.options), answer: q.options[q.answer] })), [topic])
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const elapsed = useElapsed()
  const q = items[i]
  const done = i >= items.length
  if (done) {
    const stars = score >= 4 ? 3 : score >= 2 ? 2 : 1
    return <Result stars={stars} title={`${topic.title} quiz done`} line={`${score} of ${items.length} right`} onAgain={() => { setI(0); setScore(0); setPicked(null) }} backTo={`/child/${child.id}/learn`} />
  }
  const choose = (opt: string) => {
    if (picked) return
    const right = opt === q.answer
    setPicked(opt)
    if (right) setScore((s) => s + 1)
    if (i + 1 >= items.length) track(child.id, 'quiz', `${topic.title} quiz`, topic.id, score + (right ? 1 : 0), items.length, elapsed())
  }
  return (
    <Card className="mx-auto max-w-3xl p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold uppercase tracking-widest text-mint-deep">Question {i + 1} of {items.length}</span>
        <button onClick={onClose} className="tap rounded-full bg-white px-3 py-1 text-sm font-bold text-ink-soft shadow-inset">Close</button>
      </div>
      <h2 className="mt-2 font-display text-3xl font-bold">{q.q}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2"><ReadAloud child={child} text={`${q.q}. Choices: ${q.options.join(', ')}.`} compact mood="calm" mode="explain" label="Hear the question and choices" /><Link to={`/child/${child.id}/chat?context=${encodeURIComponent(`Quiz question: ${q.q}`)}`} className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Ask Mallow</Link></div>
      {picked && <SpokenFeedback child={child} text={picked === q.answer ? 'Correct. Well done!' : `Not quite. The answer is ${q.answer}.`} mood={picked === q.answer ? 'happy' : 'calm'} />}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {q.options.map((opt) => {
          const state = picked ? (opt === q.answer ? 'right' : opt === picked ? 'wrong' : null) : null
          return <Choice key={opt} state={state} disabled={!!picked} onClick={() => choose(opt)}>{opt}</Choice>
        })}
      </div>
      {picked && (
        <div className="mt-4 rounded-3xl bg-mint-soft p-4">
          <p className="font-bold">{picked === q.answer ? 'Correct! 🎉' : `Not quite. The answer is ${q.answer}.`}</p>
          <p className="text-sm text-ink-soft">{q.why}</p>
          <Button className="mt-3" onClick={() => { setPicked(null); setI((x) => x + 1) }}>{i + 1 >= items.length ? 'See my score' : 'Next question →'}</Button>
        </div>
      )}
    </Card>
  )
}

function Quests({ child }: { child: Child }) {
  return (
    <Page child={child} gate="quests" title="Quests">
      <div className="grid gap-4 md:grid-cols-2">
        {QUESTS.map((q) => (
          <Link key={q.id} to={q.id} className="tap rounded-5xl border border-line bg-white/80 p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-4xl text-4xl" style={{ background: q.tint }}>{q.emoji}</div>
              <div><h2 className="font-display text-3xl font-bold">{q.title}</h2><p className="text-sm text-ink-soft">{q.intro}</p><p className="mt-1 text-xs font-bold" style={{ color: q.deep }}>{q.steps.length} steps · badge: {q.badge}</p></div>
            </div>
          </Link>
        ))}
      </div>
    </Page>
  )
}

function QuestRunner({ child }: { child: Child }) {
  const { questId } = useParams()
  const quest = QUESTS.find((q) => q.id === questId)
  if (!quest) return <Navigate to={`/child/${child.id}/quests`} replace />
  return <QuestBody child={child} quest={quest} />
}

function QuestBody({ child, quest }: { child: Child; quest: (typeof QUESTS)[number] }) {
  const [i, setI] = useState(0)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'right' | 'wrong'>('idle')
  const [done, setDone] = useState(false)
  const elapsed = useElapsed()
  const step = quest.steps[i]
  const promptText = step.prompt + (step.kind === 'choice' && step.options ? ` Options: ${step.options.join(', ')}.` : '')

  const check = (answer: string) => {
    const ok = step.kind === 'choice'
      ? Number(answer) === step.answer
      : (step.answer as string[]).some((a) => a.toLowerCase() === answer.trim().toLowerCase())
    setStatus(ok ? 'right' : 'wrong')
    if (ok && i + 1 >= quest.steps.length) {
      setDone(true)
      track(child.id, 'quest', quest.title, quest.id, quest.steps.length, quest.steps.length, elapsed())
    }
  }
  const next = () => { setStatus('idle'); setValue(''); setI((x) => x + 1) }
  if (done) return <Page child={child} gate="quests" title={quest.title} to={`/child/${child.id}/quests`}><Result stars={3} title={`Badge earned: ${quest.badge}`} line={`${quest.title} complete!`} onAgain={() => { setDone(false); setI(0); setStatus('idle'); setValue('') }} backTo={`/child/${child.id}/quests`} /></Page>

  return (
    <Page child={child} gate="quests" title={quest.title} to={`/child/${child.id}/quests`}>
      <Card className="mx-auto max-w-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: quest.deep }}>Step {i + 1} of {quest.steps.length}</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-soft shadow-inset">{quest.emoji} {quest.badge}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white shadow-inner"><div className="h-full rounded-full bg-mint-deep transition-all" style={{ width: `${((i + (status === 'right' ? 1 : 0)) / quest.steps.length) * 100}%` }} /></div>
        <h2 className="mt-4 font-display text-3xl font-bold">{step.prompt}</h2>
        <div className="mt-3"><ReadAloud child={child} text={promptText} compact mood="calm" mode="explain" label="Hear the step" /></div>

        {step.kind === 'choice' && step.options ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {step.options.map((opt, idx) => {
              const state = status === 'idle' ? null : idx === step.answer ? 'right' : status === 'wrong' && value === String(idx) ? 'wrong' : null
              return <Choice key={opt} state={state} disabled={status !== 'idle'} onClick={() => { setValue(String(idx)); check(String(idx)) }}>{opt}</Choice>
            })}
          </div>
        ) : (
          <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!value.trim()) return; check(value) }}>
            <Input data-testid="quest-input" value={value} onChange={(e) => setValue(e.target.value)} disabled={status !== 'idle'} placeholder="Type your answer" className="max-w-xs" />
            <Button type="submit" disabled={!value.trim() || status !== 'idle'}>Check</Button>
          </form>
        )}

        {status === 'wrong' && <><SpokenFeedback child={child} text={`Not quite. Here is a hint. ${step.hint}`} mood="calm" /><p className="mt-4 rounded-3xl bg-butter-soft px-4 py-3 font-semibold text-[#7a6418]">Not yet. Hint: {step.hint}</p></>}
        {status === 'right' && (
          <div className="mt-4 rounded-3xl bg-mint-soft p-4">
            <SpokenFeedback child={child} text={`Yes! ${step.explain}`} mood="happy" /><p className="font-bold">Yes! 🎉</p><p className="text-sm text-ink-soft">{step.explain}</p>
            <Button className="mt-3" onClick={next} data-testid="quest-next">{i + 1 >= quest.steps.length ? 'Finish quest' : 'Next step →'}</Button>
          </div>
        )}
        {status === 'idle' && <p className="mt-3 text-sm text-ink-soft">Stuck? Hint: {step.hint}</p>}
      </Card>
    </Page>
  )
}

function Games({ child }: { child: Child }) {
  const [mode, setMode] = useState<'scramble' | 'hangman' | 'memory'>('scramble')
  return (
    <Page child={child} gate="games" title="Word & memory games">
      <Segmented label="Choose a game" value={mode} onChange={setMode} options={[{ value: 'scramble', label: 'Word scramble' }, { value: 'hangman', label: 'Hangman' }, { value: 'memory', label: 'Memory pairs' }]} />
      {mode === 'scramble' ? <ScrambleGame child={child} /> : mode === 'hangman' ? <HangmanGame child={child} /> : <MemoryGame child={child} />}
    </Page>
  )
}

function ScrambleGame({ child }: { child: Child }) {
  const make = () => pick(SCRAMBLE, 6).map((x) => ({ ...x, letters: shuffle(x.w.split('')) }))
  const [items, setItems] = useState(make)
  const [i, setI] = useState(0)
  const [guess, setGuess] = useState('')
  const [score, setScore] = useState(0)
  const [state, setState] = useState<'idle' | 'right' | 'wrong'>('idle')
  const elapsed = useElapsed()
  const cur = items[i]
  if (i >= items.length) return <Result stars={score >= 5 ? 3 : score >= 3 ? 2 : 1} title="Scramble done" line={`${score} of ${items.length} words`} onAgain={() => { setItems(make()); setI(0); setScore(0); setGuess(''); setState('idle') }} backTo={`/child/${child.id}`} />
  const submit = () => {
    const right = guess.trim().toUpperCase() === cur.w
    setState(right ? 'right' : 'wrong')
    if (right) { setScore((s) => s + 1); if (i + 1 >= items.length) track(child.id, 'game', 'Word scramble', `${score + 1}/${items.length}`, score + 1, items.length, elapsed()) }
  }
  return (
    <Card className="mx-auto max-w-2xl p-5 sm:p-7">
      <div className="flex justify-between text-sm font-bold text-ink-soft"><span>Word {i + 1} of {items.length}</span><span>{score} right</span></div>
      <p className="mt-3 text-lg font-semibold text-ink-soft">Hint: {cur.h}</p>
      <div className="mt-2"><ReadAloud child={child} text={`Unscramble the letters to make a word. Hint: ${cur.h}`} compact label="Hear the rule" /></div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">{cur.letters.map((l, k) => <span key={k} className="grid h-14 w-12 place-items-center rounded-2xl border-2 border-line bg-butter-soft font-display text-3xl font-bold shadow-soft">{l}</span>)}</div>
      <form className="mt-5 flex flex-wrap justify-center gap-2" onSubmit={(e) => { e.preventDefault(); if (guess.trim() && state === 'idle') submit() }}>
        <Input value={guess} onChange={(e) => setGuess(e.target.value.toUpperCase())} disabled={state !== 'idle'} placeholder="Your word" className="max-w-[12rem] text-center text-xl font-bold" maxLength={15} />
        <Button type="submit" disabled={!guess.trim() || state !== 'idle'}>Check</Button>
      </form>
      {state === 'right' && <div className="mt-4 rounded-3xl bg-mint-soft p-4 text-center"><SpokenFeedback child={child} text="Correct. Well done!" mood="happy" /><p className="text-xl font-bold">Correct! 🎉</p><Button className="mt-3" onClick={() => { setI((x) => x + 1); setGuess(''); setState('idle') }}>Next word →</Button></div>}
      {state === 'wrong' && <div className="mt-4 rounded-3xl bg-butter-soft p-4 text-center"><SpokenFeedback child={child} text="Not quite. Try again or use the hint." mood="calm" /><p className="font-bold">Not quite. Try again or use the hint.</p><Button className="mt-3" variant="soft" onClick={() => { setGuess(''); setState('idle') }}>Try again</Button></div>}
    </Card>
  )
}

function HangmanGame({ child }: { child: Child }) {
  const make = () => pick(HANGMAN, 1)[0]
  const [word, setWord] = useState(make)
  const [guessed, setGuessed] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const elapsed = useElapsed()
  const wrong = guessed.filter((g) => !word.includes(g)).length
  const won = word.split('').every((l) => guessed.includes(l))
  const lost = wrong >= 6
  const logged = useRef(false)
  useEffect(() => {
    if ((!won && !lost) || logged.current) return
    logged.current = true
    if (won) { setScore((s) => s + 1); track(child.id, 'game', 'Hangman', word, 1, 1, elapsed()) }
  }, [won, lost, child.id, elapsed, word])
  const reset = () => { setWord(make()); setGuessed([]); logged.current = false }
  const guess = (l: string) => { if (guessed.includes(l) || won || lost) return; setGuessed((g) => [...g, l]) }
  return (
    <Card className="mx-auto max-w-2xl p-5 text-center sm:p-7">
      <div className="flex justify-between text-sm font-bold text-ink-soft"><span>Guess the word</span><span>{6 - wrong} lives left · {score} solved</span></div>
      <div className="mt-2 flex justify-center"><ReadAloud child={child} text="Guess one letter at a time. You have six wrong guesses before the word is revealed." compact label="Hear the rule" /></div>
      <div className="mt-5 flex justify-center gap-2">
        {word.split('').map((l, i) => <span key={i} className="grid h-14 w-11 place-items-center rounded-2xl border-b-4 border-lav-deep bg-white font-display text-3xl font-bold">{guessed.includes(l) || won || lost ? l : ' '}</span>)}
      </div>
      <p className="mt-4 text-4xl" aria-hidden>{lost ? '😴' : wrong > 3 ? '😟' : '🙂'}</p>
      {won && <div className="mt-3 rounded-3xl bg-mint-soft p-4"><SpokenFeedback child={child} text={`You got it. The word was ${word}.`} mood="happy" /><p className="text-xl font-bold">You got it! 🎉</p><Button className="mt-2" onClick={reset}>New word</Button></div>}
      {lost && <div className="mt-3 rounded-3xl bg-butter-soft p-4"><SpokenFeedback child={child} text={`Good try. The word was ${word}.`} mood="calm" /><p className="font-bold">The word was {word}.</p><Button className="mt-2" onClick={reset}>Try another</Button></div>}
      {!won && !lost && (
        <div className="mt-4 grid grid-cols-7 gap-1.5 sm:grid-cols-9">
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => <button key={l} onClick={() => guess(l)} disabled={guessed.includes(l)} className={`tap rounded-xl py-2 font-bold shadow-soft ${guessed.includes(l) ? 'bg-lav-soft text-ink-faint' : 'bg-white text-ink hover:bg-mint-soft'}`}>{l}</button>)}
        </div>
      )}
    </Card>
  )
}

function MemoryGame({ child }: { child: Child }) {
  const make = () => { const symbols = pick(MEMORY_EMOJI, 6); return shuffle([...symbols, ...symbols]).map((s, id) => ({ id, s })) }
  const [cards, setCards] = useState(make)
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  const elapsed = useElapsed()
  const done = matched.length === 6
  const logged = useRef(false)
  useEffect(() => {
    if (!done || logged.current) return
    logged.current = true
    track(child.id, 'game', 'Memory pairs', `${moves} moves`, Math.max(0, 18 - moves), 18, elapsed())
  }, [done, moves, child.id, elapsed])
  const reset = () => { setCards(make()); setOpen([]); setMatched([]); setMoves(0); logged.current = false }
  const flip = (id: number) => {
    if (open.includes(id) || open.length === 2 || matched.includes(cards[id].s)) return
    const next = [...open, id]
    setOpen(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next
      if (cards[a].s === cards[b].s) window.setTimeout(() => { setMatched((m) => [...m, cards[a].s]); setOpen([]) }, 500)
      else window.setTimeout(() => setOpen([]), 800)
    }
  }
  return (
    <Card className="mx-auto max-w-2xl p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-display text-2xl font-bold">Find the pairs</h2><p className="text-sm text-ink-soft">Match all six pairs.</p><div className="mt-2"><ReadAloud child={child} text="Tap two cards. Find all six matching pairs." compact label="Hear the rules" /></div></div><span className="rounded-full bg-lav-soft px-4 py-2 font-bold text-lav-deep">{moves} moves</span></div>
      <div className="mt-4 grid grid-cols-4 gap-2.5">
        {cards.map((c) => {
          const shown = open.includes(c.id) || matched.includes(c.s)
          return <button key={c.id} onClick={() => flip(c.id)} disabled={matched.includes(c.s)} aria-label={shown ? c.s : 'Hidden card'} className={`tap grid aspect-square place-items-center rounded-3xl border-2 text-4xl shadow-soft ${shown ? 'border-mint-deep bg-mint-soft' : 'border-line bg-lav-soft'}`}>{shown ? c.s : '?'}</button>
        })}
      </div>
      {done && <div className="mt-4 rounded-3xl bg-mint-soft p-4 text-center"><SpokenFeedback child={child} text="All matched. Great memory!" mood="happy" /><p className="text-xl font-bold">All matched! 🎉</p><Button className="mt-2" onClick={reset}>Play again</Button></div>}
    </Card>
  )
}

interface Creation { id: number; kind: string; title: string; content: string; created_at: string }

function Create({ child }: { child: Child }) {
  const toast = useToast()
  const [hero, setHero] = useState(() => pick(HEROES, 1)[0])
  const [place, setPlace] = useState(() => pick(PLACES, 1)[0])
  const [problem, setProblem] = useState(() => pick(PROBLEMS, 1)[0])
  const [opening, setOpening] = useState(STARTERS[0])
  const [text, setText] = useState('')
  const [saved, setSaved] = useState<Creation[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api<Creation[]>(`/children/${child.id}/creations?kind=story`).then(setSaved).catch(() => undefined)
  }, [child.id])
  const idea = `A story about ${hero} in ${place} who ${problem}.`
  const full = text.trim() || `${opening} ${idea}`
  const randomise = () => { setHero(pick(HEROES, 1)[0]); setPlace(pick(PLACES, 1)[0]); setProblem(pick(PROBLEMS, 1)[0]); setOpening(pick(STARTERS, 1)[0]) }
  const save = async () => {
    if (!text.trim()) { toast('Write a few lines first.', 'err'); return }
    setBusy(true)
    try {
      const c = await api<Creation>(`/children/${child.id}/creations`, { body: { kind: 'story', title: text.trim().slice(0, 60), content: text.trim() } })
      setSaved((s) => [c, ...s]); toast('Story saved.')
      track(child.id, 'writing', 'Story maker', 'Saved a story', 1, 1)
    } catch { toast('Could not save the story right now.', 'err') } finally { setBusy(false) }
  }
  return (
    <Page child={child} gate="writing" title="Story maker">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Story ingredients</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="rounded-2xl bg-lav-soft px-3 py-2"><b>Hero:</b> {hero}</li>
            <li className="rounded-2xl bg-mint-soft px-3 py-2"><b>Place:</b> {place}</li>
            <li className="rounded-2xl bg-peach-soft px-3 py-2"><b>Problem:</b> {problem}</li>
            <li className="rounded-2xl bg-butter-soft px-3 py-2"><b>Opening:</b> {opening}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="soft" onClick={randomise}>🎲 Surprise me</Button><ReadAloud child={child} text={`${idea} ${opening}`} compact mode="story" label="Hear the idea" /></div>
        </Card>
        <Card className="p-5">
          <label htmlFor="story-draft" className="font-display text-2xl font-bold">Your story</label>
          <p className="text-sm text-ink-soft">Write as much as you like. Only you and your grown-up can see it.</p>
          <textarea id="story-draft" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder={full} className="mt-2 min-h-[12rem] w-full rounded-3xl border border-line bg-white p-4 text-[17px] leading-relaxed shadow-inset focus:border-lav-deep focus:outline-none focus:ring-2 focus:ring-lav" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => void save()} loading={busy} disabled={!text.trim()}>Save story</Button>
            <ReadAloud child={child} text={full} mode="story" label="Read my story" />
          </div>
        </Card>
      </div>
      {saved.length > 0 && (
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Saved stories</h2>
          <ul className="mt-2 space-y-2">{saved.slice(0, 6).map((s) => <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 shadow-inset"><b className="truncate">{s.title}</b><span className="text-xs text-ink-soft">{s.created_at.slice(0, 10)}</span><ReadAloud child={child} text={s.content} compact mode="story" label="Hear" /></li>)}</ul>
        </Card>
      )}
    </Page>
  )
}

function Chat({ child }: { child: Child }) {
  const [params] = useSearchParams()
  return (
    <Page child={child} gate="chat" title="Talk with Mallow">
      <MallowChat
        child={child}
        variant="explorer"
        context={params.get('context') ?? ''}
        starters={[
          { label: 'Explain a fact', text: 'Tell me an amazing science fact and explain why it happens.', mode: 'explain' },
          { label: 'Quiz me', text: 'Ask me three fun questions about animals.', mode: 'study' },
          { label: 'Help with homework', text: 'Can you help me understand fractions with an example?', mode: 'homework' },
          { label: 'Tell a story', text: 'Tell me a short adventure story with a clever fox.', mode: 'story' },
        ]}
        modes={[{ id: 'chat', label: 'Chat' }, { id: 'story', label: 'Story' }, { id: 'homework', label: 'Homework' }, { id: 'explain', label: 'Explain' }]}
      />
    </Page>
  )
}
