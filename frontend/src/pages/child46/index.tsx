import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import { BookDoodle, Cloud, Doodles, Flower, Sparkle, Star } from '../../components/Decor'
import { DrawPad, Gallery } from '../../components/DrawPad'
import MallowChat from '../../components/MallowChat'
import ReadAloud, { SpeakButton, SpokenFeedback } from '../../components/ReadAloud'
import { getProgress, logActivity } from '../../lib/activity'
import { useSpeaker } from '../../lib/useSpeaker'
import type { ActivityKind, Child, Language, Progress } from '../../lib/types'
import { Button } from '../../ui'
import { BackBar, Choice, Locked, Result, allowed, pick, shuffle, useElapsed, useFeedback, useRound } from './kit'
import { COLOURS, RIDDLES, SOUNDS } from './riddles'
import { STORIES, UI, type Story } from './stories'

const ACTIVITY_CARD =
  'tap group relative min-h-[11rem] overflow-hidden rounded-5xl border border-line bg-white/80 p-5 text-left shadow-soft transition hover:-translate-y-1 hover:shadow-lift'

function t(map: Record<Language, string>, lang: Language) {
  return map[lang] || map.English
}

function activityOn(child: Child, key: string) {
  return allowed(child, key)
}

function track(childId: number, kind: ActivityKind, title: string, detail = '', score?: number, max?: number, seconds?: number, language: Language = 'English') {
  void logActivity(childId, { kind, title, detail, score, max, seconds, language }).catch(() => undefined)
}

export default function Experience({ child }: { child: Child }) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <Routes>
        <Route index element={<LittleHome child={child} />} />
        <Route path="stories" element={<Stories child={child} />} />
        <Route path="stories/:storyId" element={<StoryReader child={child} />} />
        <Route path="riddles" element={<Riddles child={child} />} />
        <Route path="learn" element={<Learning child={child} />} />
        <Route path="games" element={<Games child={child} />} />
        <Route path="draw" element={<Drawing child={child} />} />
        <Route path="feelings" element={<Feelings child={child} />} />
        <Route path="chat" element={<Chat child={child} />} />
        <Route path="*" element={<Navigate to={`/child/${child.id}`} replace />} />
      </Routes>
    </main>
  )
}

function LittleHome({ child }: { child: Child }) {
  const [progress, setProgress] = useState<Progress | null>(null)
  useEffect(() => { getProgress(child.id).then(setProgress).catch(() => undefined) }, [child.id])
  const cards = [
    { to: 'stories', gate: 'stories', title: 'Story time', line: 'Read gentle stories with Mallow.', tone: 'from-peach-soft to-blush', art: <BookDoodle size={58} /> },
    { to: 'riddles', gate: 'riddles', title: 'Riddles', line: 'Listen, choose, and check your answer.', tone: 'from-butter-soft to-peach-soft', art: <Star size={52} /> },
    { to: 'learn', gate: 'learning', title: 'Learn', line: 'Colors, sounds, counting, and tiny science.', tone: 'from-mint-soft to-teal-soft', art: <Sparkle size={54} /> },
    { to: 'games', gate: 'games', title: 'Games', line: 'Play little games with real scores.', tone: 'from-lav-soft to-lav', art: <Cloud size={72} /> },
    { to: 'draw', gate: 'create', title: 'Draw', line: 'Make a picture and save it.', tone: 'from-blush-soft to-peach-soft', art: <Flower size={58} /> },
    { to: 'feelings', gate: '', title: 'Feelings', line: 'Tell Mallow how your heart feels.', tone: 'from-teal-soft to-mint-soft', art: <Bunny size={70} mood="love" shadow={false} /> },
    { to: 'chat', gate: 'chat', title: 'Talk', line: 'Chat or use the microphone with Mallow.', tone: 'from-lav-soft to-blush', art: <Bunny size={72} pose="wave" shadow={false} /> },
  ]
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-5xl border border-line bg-paper/90 p-5 shadow-lift paper-grain sm:p-7">
        <Doodles />
        <div className="relative z-10 grid items-center gap-5 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-lav-deep">Ages 4-6</p>
            <h1 className="mt-1 font-display text-4xl font-bold sm:text-5xl">Hi, {child.nickname}</h1>
            <p className="mt-2 max-w-2xl text-lg text-ink-soft">Pick one soft little activity. Mallow will keep things kind, simple, and safe.</p>
            <div className="mt-3"><ReadAloud child={child} text={`Hi ${child.nickname}. Pick one soft little activity. I will keep things kind, simple, and safe.`} compact mood="happy" mode="chat" label="Hear this page" /></div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/" className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Choose child</Link>
              <Link to="/parent" className="tap rounded-full bg-lav-soft px-4 py-2 text-sm font-bold text-lav-deep shadow-inset">Grown-up space</Link>
            </div>
          </div>
          <Bunny size={210} pose="wave" mood="happy" accessory="flower" />
        </div>
      </section>
      {progress && (
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Progress">
          <ProgressTile label="Stars saved" value={progress.stars} />
          <ProgressTile label="Things tried" value={progress.total} />
          <ProgressTile label="Day streak" value={progress.streak_days} />
        </section>
      )}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Activities">
        {cards.map((c) => {
          const on = !c.gate || activityOn(child, c.gate)
          return (
            <div key={c.to} className="relative">
              <Link to={c.to} data-testid={`little-${c.to}`} className={`${ACTIVITY_CARD} block bg-gradient-to-br ${c.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-3xl font-bold">{c.title}</h2>
                    <p className="mt-1 pr-12 text-base font-semibold text-ink-soft">{on ? c.line : 'Resting for now. A grown-up turned this off.'}</p>
                  </div>
                  <div className="shrink-0">{c.art}</div>
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

function ProgressTile({ label, value }: { label: string; value: number }) {
  return <div className="rounded-4xl border border-line bg-white/75 p-4 text-center shadow-soft"><div className="font-display text-4xl font-bold">{value}</div><div className="text-sm font-bold text-ink-soft">{label}</div></div>
}

function ActivityPage({ child, gate, what, title, children }: { child: Child; gate?: string; what: string; title: string; children: ReactNode }) {
  const home = `/child/${child.id}`
  if (gate && !activityOn(child, gate)) {
    return <div><BackBar title={title} to={home} /><Locked what={what} /></div>
  }
  return <div className="space-y-5"><BackBar title={title} to={home} />{children}</div>
}

function Stories({ child }: { child: Child }) {
  return (
    <ActivityPage child={child} gate="stories" what="Stories" title="Story time">
      <div className="grid gap-4 md:grid-cols-3">
        {STORIES.map((s) => (
          <Link key={s.id} to={s.id} className="tap rounded-5xl border border-line bg-white/80 p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
            <div className="mb-3 grid h-24 place-items-center rounded-4xl text-5xl" style={{ background: s.tint }}>{s.emoji}</div>
            <h2 className="font-display text-3xl font-bold">{t(s.title, child.preferred_language)}</h2>
            <p className="mt-1 font-semibold text-ink-soft">{t(s.blurb, child.preferred_language)}</p>
          </Link>
        ))}
      </div>
    </ActivityPage>
  )
}

function StoryReader({ child }: { child: Child }) {
  const { storyId } = useParams()
  const story = STORIES.find((s) => s.id === storyId)
  if (!story) return <Navigate to={`/child/${child.id}/stories`} replace />
  return <StoryBook child={child} story={story} />
}

function StoryBook({ child, story }: { child: Child; story: Story }) {
  const [nodeId, setNodeId] = useState(story.start)
  const logged = useRef(false)
  const elapsed = useElapsed()
  const lang = child.preferred_language
  const node = story.nodes[nodeId]
  const speaker = useSpeaker(child, lang)
  const pageText = t(node.t, lang)
  useEffect(() => { speaker.stop() }, [nodeId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!node.end || logged.current) return
    logged.current = true
    track(child.id, 'story', t(story.title, lang), story.id, 1, 1, elapsed(), lang)
  }, [child.id, elapsed, lang, node.end, story])
  return (
    <ActivityPage child={child} gate="stories" what="Stories" title={t(story.title, lang)}>
      <article className="mx-auto max-w-3xl rounded-5xl border border-line bg-white/85 p-5 shadow-lift sm:p-8">
        <div className="mb-5 grid min-h-36 place-items-center rounded-5xl text-7xl" style={{ background: story.tint }}>{story.emoji}</div>
        <p className="text-2xl font-bold leading-relaxed sm:text-3xl">{pageText}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!speaker.speaking && !speaker.loading && <Button variant="soft" tone="lav" onClick={() => void speaker.say(pageText, 'calm', 'story')}>{t(UI.readTo, lang)} 🔊</Button>}
          {speaker.loading && <span className="rounded-full bg-lav-soft px-4 py-2 text-sm font-bold text-lav-deep">Finding Mallow's voice…</span>}
          {speaker.speaking && (
            <>
              <Button variant="soft" tone="lav" onClick={speaker.paused ? speaker.resume : speaker.pause}>{speaker.paused ? '▶ Resume' : '❚❚ Pause'}</Button>
              <Button variant="soft" tone="butter" onClick={() => void speaker.replay()}>↻ Replay</Button>
              <Button variant="soft" tone="peach" onClick={speaker.stop}>{t(UI.stop, lang)} ■</Button>
            </>
          )}
          <Link to={`/child/${child.id}/chat?context=${encodeURIComponent(`${t(story.title, lang)}: ${pageText}`)}`} className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Ask Mallow about this</Link>
        </div>
        {speaker.error && <p className="mt-2 rounded-2xl bg-butter-soft px-4 py-2 text-sm font-semibold text-[#7a6418]" role="status">{speaker.error}</p>}
        {node.choices && (
          <div className="mt-6 space-y-3">
            <h2 className="text-xl font-bold text-ink-soft">{t(UI.choose, lang)}</h2>
            <ReadAloud child={child} text={`${t(UI.choose, lang)}: ${node.choices.map((c) => t(c.l, lang)).join('. ')}`} compact mood="calm" mode="story" label="Hear the choices" />
            <div className="grid gap-3 sm:grid-cols-2">
              {node.choices.map((c) => <button key={c.to} onClick={() => setNodeId(c.to)} className="tap rounded-4xl border border-line bg-lav-soft p-4 text-left text-xl font-bold shadow-soft"><span className="mr-2 text-3xl" aria-hidden>{c.emoji}</span>{t(c.l, lang)}</button>)}
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {node.next && <Button size="lg" onClick={() => setNodeId(node.next!)}>{t(UI.next, lang)}</Button>}
          {node.end && <Button size="lg" variant="soft" onClick={() => { logged.current = false; setNodeId(story.start) }}>{t(UI.again, lang)}</Button>}
          <Link to={`/child/${child.id}/stories`} className="tap rounded-full bg-white px-6 py-3 text-lg font-bold text-ink-soft shadow-inset">{t(UI.another, lang)}</Link>
        </div>
      </article>
    </ActivityPage>
  )
}

function Riddles({ child }: { child: Child }) {
  const make = () => pick(RIDDLES, 5).map((r) => ({ ...r, options: shuffle(r.options) }))
  const round = useRound(make)
  const feedback = useFeedback()
  const elapsed = useElapsed()
  const cur = round.cur
  if (round.done) {
    const stars = round.score >= 5 ? 3 : round.score >= 3 ? 2 : 1
    return (
      <ActivityPage child={child} gate="riddles" what="Riddles" title="Riddles">
        <Result stars={stars} title="Riddle round done" line={`${round.score} of ${round.items.length} right`} onAgain={round.reset} backTo={`/child/${child.id}`} />
      </ActivityPage>
    )
  }
  const choose = (idx: number) => {
    const right = cur.options[idx] === cur.answer
    feedback.run(idx, right, () => {
      const final = round.next(right)
      if (round.i + 1 >= round.items.length) track(child.id, 'riddle', 'Riddle round', 'Animal and object riddles', final, round.items.length, elapsed(), child.preferred_language)
    })
  }
  return (
    <ActivityPage child={child} gate="riddles" what="Riddles" title="Riddles">
      <QuestionCard n={round.i + 1} of={round.items.length} prompt={cur.prompt} child={child}
        readText={`${cur.prompt}. Choices: ${cur.options.join(', ')}.`}
        feedback={feedback.fb ? (feedback.fb.right ? 'That is right. Well done!' : 'Not quite. Try again. You can do it.') : ''}>
        {cur.options.map((o, idx) => <Choice key={o} state={feedback.fb?.pick === idx ? (feedback.fb.right ? 'right' : 'wrong') : null} disabled={feedback.busy} onClick={() => choose(idx)}>{o}</Choice>)}
      </QuestionCard>
    </ActivityPage>
  )
}

function Learning({ child }: { child: Child }) {
  const [mode, setMode] = useState<'colors' | 'sounds' | 'counting'>('colors')
  return (
    <ActivityPage child={child} gate="learning" what="Learning" title="Learn">
      <div className="flex flex-wrap gap-2">
        {(['colors', 'sounds', 'counting'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`tap rounded-full px-5 py-3 text-lg font-bold shadow-soft ${mode === m ? 'bg-lav-deep text-white' : 'bg-white text-ink-soft'}`}>{m[0].toUpperCase() + m.slice(1)}</button>)}
      </div>
      {mode === 'colors' ? <ColorGame child={child} /> : mode === 'sounds' ? <SoundGame child={child} /> : <CountingGame child={child} />}
    </ActivityPage>
  )
}

function ColorGame({ child }: { child: Child }) {
  const make = () => pick(COLOURS, 5).map((c) => ({ prompt: `Find ${c.n}`, answer: c.n, options: shuffle(pick(COLOURS.filter((x) => x.n !== c.n), 2).concat(c)) }))
  const round = useRound(make)
  const feedback = useFeedback()
  const elapsed = useElapsed()
  if (round.done) return <Result stars={round.score >= 4 ? 3 : round.score >= 2 ? 2 : 1} title="Colors done" line={`${round.score} colors found`} onAgain={round.reset} backTo={`/child/${child.id}`} />
  const choose = (idx: number) => {
    const right = round.cur.options[idx].n === round.cur.answer
    feedback.run(idx, right, () => {
      const final = round.next(right)
      if (round.i + 1 >= round.items.length) track(child.id, 'learning', 'Color finding', 'Matched color names', final, round.items.length, elapsed(), child.preferred_language)
    })
  }
  return <QuestionCard n={round.i + 1} of={round.items.length} prompt={round.cur.prompt} child={child}
    readText={`${round.cur.prompt}. Choices: ${round.cur.options.map((c) => c.n).join(', ')}.`}
    feedback={feedback.fb ? (feedback.fb.right ? 'That is right. Well done!' : 'Not quite. Look carefully and try again.') : ''}>
    {round.cur.options.map((c, idx) => <Choice key={c.n} state={feedback.fb?.pick === idx ? (feedback.fb.right ? 'right' : 'wrong') : null} disabled={feedback.busy} onClick={() => choose(idx)} label={c.n}><span className="block h-16 w-28 rounded-3xl border-4 border-white shadow-inset" style={{ background: c.c }} /></Choice>)}
  </QuestionCard>
}

function SoundGame({ child }: { child: Child }) {
  const make = () => pick(SOUNDS, 5).map((s) => ({ ...s, options: shuffle(s.options) }))
  const round = useRound(make)
  const feedback = useFeedback()
  const elapsed = useElapsed()
  if (round.done) return <Result stars={round.score >= 4 ? 3 : round.score >= 2 ? 2 : 1} title="Sound round done" line={`${round.score} answers right`} onAgain={round.reset} backTo={`/child/${child.id}`} />
  const choose = (idx: number) => {
    const right = round.cur.options[idx] === round.cur.answer
    feedback.run(idx, right, () => {
      const final = round.next(right)
      if (round.i + 1 >= round.items.length) track(child.id, 'quiz', 'Sound quiz', 'Animal and everyday sounds', final, round.items.length, elapsed(), child.preferred_language)
    })
  }
  return <QuestionCard n={round.i + 1} of={round.items.length} prompt={round.cur.q} child={child}
    readText={`${round.cur.q}. Choices: ${round.cur.options.join(', ')}.`}
    feedback={feedback.fb ? (feedback.fb.right ? 'Yes. That is right!' : 'Not quite. Listen again and try.') : ''}>
    {round.cur.options.map((o, idx) => <Choice key={o} state={feedback.fb?.pick === idx ? (feedback.fb.right ? 'right' : 'wrong') : null} disabled={feedback.busy} onClick={() => choose(idx)}>{o}</Choice>)}
  </QuestionCard>
}

function CountingGame({ child }: { child: Child }) {
  const make = () => Array.from({ length: 5 }, () => {
    const answer = 1 + Math.floor(Math.random() * 6)
    const options = shuffle([answer, Math.max(1, answer - 1), Math.min(6, answer + 1)].filter((v, i, a) => a.indexOf(v) === i))
    return { answer, options }
  })
  const round = useRound(make)
  const feedback = useFeedback()
  const elapsed = useElapsed()
  if (round.done) return <Result stars={round.score >= 4 ? 3 : round.score >= 2 ? 2 : 1} title="Counting done" line={`${round.score} counts right`} onAgain={round.reset} backTo={`/child/${child.id}`} />
  const choose = (idx: number) => {
    const right = round.cur.options[idx] === round.cur.answer
    feedback.run(idx, right, () => {
      const final = round.next(right)
      if (round.i + 1 >= round.items.length) track(child.id, 'math', 'Counting game', 'Counted groups from one to six', final, round.items.length, elapsed(), child.preferred_language)
    })
  }
  return (
    <QuestionCard n={round.i + 1} of={round.items.length} prompt="How many stars do you see?" child={child}
      readText={`How many stars do you see? Choices: ${round.cur.options.join(', ')}.`}
      feedback={feedback.fb ? (feedback.fb.right ? 'That is right. Well done!' : 'Not quite. Count slowly and try again.') : ''}>
      <div className="col-span-full mb-2 flex justify-center gap-2 rounded-5xl bg-butter-soft p-6">{Array.from({ length: round.cur.answer }).map((_, i) => <Star key={i} size={42} />)}</div>
      {round.cur.options.map((o, idx) => <Choice key={o} state={feedback.fb?.pick === idx ? (feedback.fb.right ? 'right' : 'wrong') : null} disabled={feedback.busy} onClick={() => choose(idx)}>{o}</Choice>)}
    </QuestionCard>
  )
}

function QuestionCard({ n, of, prompt, children, child, readText, feedback }: { n: number; of: number; prompt: string; children: ReactNode; child?: Child; readText?: string; feedback?: string }) {
  return (
    <section className="mx-auto max-w-3xl rounded-5xl border border-line bg-white/80 p-5 shadow-lift sm:p-7">
      <div className="mb-3 text-sm font-bold uppercase tracking-widest text-lav-deep">Question {n} of {of}</div>
      <h2 className="mb-3 font-display text-3xl font-bold sm:text-4xl">{prompt}</h2>
      {child && <div className="mb-5 flex flex-wrap items-center gap-2"><ReadAloud child={child} text={readText ?? prompt} compact mood="calm" mode="explain" label="Hear the question and choices" /><Link to={`/child/${child.id}/chat?context=${encodeURIComponent(`Activity question: ${prompt}`)}`} className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Ask Mallow</Link></div>}
      {child && feedback && <SpokenFeedback child={child} text={feedback} mood={feedback.startsWith('That') || feedback.startsWith('Yes') ? 'happy' : 'calm'} />}
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </section>
  )
}

function Games({ child }: { child: Child }) {
  return (
    <ActivityPage child={child} gate="games" what="Games" title="Games">
      <MemoryGame child={child} />
    </ActivityPage>
  )
}

function MemoryGame({ child }: { child: Child }) {
  const makeCards = () => shuffle(['Moon', 'Moon', 'Leaf', 'Leaf', 'Star', 'Star']).map((name, id) => ({ id, name }))
  const [cards, setCards] = useState(makeCards)
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  const logged = useRef(false)
  const elapsed = useElapsed()
  const done = matched.length === 3
  useEffect(() => {
    if (!done || logged.current) return
    logged.current = true
    track(child.id, 'game', 'Memory pairs', `${moves} moves`, Math.max(0, 12 - moves), 12, elapsed(), child.preferred_language)
  }, [child.id, child.preferred_language, done, elapsed, moves])
  const reset = () => { setCards(makeCards()); setOpen([]); setMatched([]); setMoves(0); logged.current = false }
  const flip = (id: number) => {
    if (open.includes(id) || open.length === 2 || matched.includes(cards[id].name)) return
    const next = [...open, id]
    setOpen(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next
      if (cards[a].name === cards[b].name) {
        window.setTimeout(() => { setMatched((m) => [...m, cards[a].name]); setOpen([]) }, 550)
      } else {
        window.setTimeout(() => setOpen([]), 850)
      }
    }
  }
  return (
    <section className="mx-auto max-w-3xl rounded-5xl border border-line bg-white/80 p-5 shadow-lift sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-3xl font-bold">Find the pairs</h2><p className="font-semibold text-ink-soft">Tap two cards. Match all three pairs.</p><div className="mt-2 flex flex-wrap items-center gap-2"><ReadAloud child={child} text="Tap two cards. Find the matching pairs." compact label="Hear the rules" /><Link to={`/child/${child.id}/chat?context=${encodeURIComponent('We are playing the memory pairs game. I can ask for help with the rules.')}`} className="tap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink-soft shadow-inset">Ask Mallow</Link></div></div>
        <div className="rounded-full bg-lav-soft px-4 py-2 font-bold text-lav-deep">{moves} moves</div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {cards.map((c) => {
          const shown = open.includes(c.id) || matched.includes(c.name)
          return <button key={c.id} onClick={() => flip(c.id)} disabled={matched.includes(c.name)} className={`tap grid aspect-square place-items-center rounded-4xl border-2 text-2xl font-bold shadow-soft ${shown ? 'border-mint-deep bg-mint-soft' : 'border-line bg-lav-soft'}`}>{shown ? c.name : '?'}</button>
        })}
      </div>
      {done && <div className="mt-5 rounded-4xl bg-mint-soft p-4 text-center"><Bunny size={120} pose="wave" mood="happy" /><p className="text-2xl font-bold">You matched them all.</p><SpokenFeedback child={child} text="You matched them all. Great remembering!" /><Button className="mt-3" onClick={reset}>Play again</Button></div>}
    </section>
  )
}

function Drawing({ child }: { child: Child }) {
  const [reload, setReload] = useState(0)
  return (
    <ActivityPage child={child} gate="create" what="Drawing" title="Draw">
      <div className="flex flex-wrap items-center gap-2 rounded-4xl bg-butter-soft px-4 py-3"><ReadAloud child={child} text="Draw anything you like. There is no wrong picture. You can save it when you are happy with it." compact mood="happy" mode="chat" label="Hear what to do" /><Link to={`/child/${child.id}/chat?context=${encodeURIComponent('We are doing the drawing activity. I can ask for ideas about what to draw.')}`} className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Ask Mallow for an idea</Link></div>
      <DrawPad childId={child.id} big onSaved={() => setReload((x) => x + 1)} />
      <section className="rounded-5xl border border-line bg-white/75 p-5 shadow-soft">
        <h2 className="mb-3 font-display text-2xl font-bold">My saved pictures</h2>
        <Gallery childId={child.id} kind="drawing" reload={reload} big />
      </section>
    </ActivityPage>
  )
}

function Feelings({ child }: { child: Child }) {
  const [picked, setPicked] = useState<string | null>(null)
  const choices = [
    ['happy', 'Happy'],
    ['calm', 'Calm'],
    ['okay', 'Okay'],
    ['sad', 'Sad'],
    ['worried', 'Worried'],
    ['angry', 'Angry'],
  ]
  const save = (mood: string) => {
    setPicked(mood)
    track(child.id, 'feelings', 'Feeling check-in', mood, 1, 1, 0, child.preferred_language)
  }
  return (
    <ActivityPage child={child} what="Feelings" title="Feelings">
      <section className="mx-auto max-w-3xl rounded-5xl border border-line bg-white/80 p-5 text-center shadow-lift sm:p-7">
        <Bunny size={170} mood={picked === 'sad' || picked === 'worried' ? 'sad' : picked === 'happy' ? 'happy' : 'calm'} />
        <h2 className="font-display text-3xl font-bold">How are you feeling?</h2>
        <div className="mt-2 flex justify-center"><ReadAloud child={child} text="How are you feeling? You can pick happy, calm, okay, sad, worried, or angry." compact mood="calm" mode="chat" label="Hear the question" /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {choices.map(([id, label]) => <button key={id} onClick={() => save(id)} className={`tap rounded-4xl border border-line px-4 py-5 text-2xl font-bold shadow-soft ${picked === id ? 'bg-mint-soft ring-2 ring-mint-deep' : 'bg-white'}`}>{label}</button>)}
        </div>
        {picked && <><SpokenFeedback child={child} text="Thank you for telling me. Every feeling is allowed. If it feels too big, find a grown-up you trust." /><p className="mt-5 rounded-4xl bg-lav-soft px-5 py-4 text-xl font-bold text-lav-deep">Thanks for telling Mallow. Big feelings are okay. If a feeling feels too big, find a grown-up you trust.</p><Link to={`/child/${child.id}/chat?context=${encodeURIComponent(`I chose the feeling ${picked} in the feelings activity.`)}`} className="tap mt-3 inline-block rounded-full bg-lav-soft px-4 py-2 text-sm font-bold text-lav-deep">Talk to Mallow about this</Link></>}
      </section>
    </ActivityPage>
  )
}

function Chat({ child }: { child: Child }) {
  const [params] = useSearchParams()
  const context = params.get('context') ?? ''
  return (
    <ActivityPage child={child} gate="chat" what="Chat" title="Talk with Mallow">
      <MallowChat
        child={child}
        variant="little"
        context={context}
        starters={[
          { label: 'Tell me a tiny story', text: 'Please tell me a short gentle story.' },
          { label: 'Ask a riddle', text: 'Please ask me one easy riddle.' },
          { label: 'Help me feel calm', text: 'Can you help me take a calm breath?' },
        ]}
        modes={[{ id: 'chat', label: 'Chat' }, { id: 'story', label: 'Story' }, { id: 'bedtime', label: 'Bedtime' }]}
      />
    </ActivityPage>
  )
}
