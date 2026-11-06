import { useState } from 'react'
import { Link } from 'react-router-dom'
import ReadAloud from '../../components/ReadAloud'
import type { Child } from '../../lib/types'
import { Button, Card, Input } from '../../ui'
import { BackBar, Locked, allowed } from '../child46/kit'

const CHECKS = [
  'Who made this information, and are they an expert?',
  'When was it written or updated?',
  'Can I find the same fact in more than one reliable place?',
  'Is the source trying to sell me something or change my mind?',
  'Does it give evidence, or only opinions?',
]

/** Guided research desk. It never opens the web itself; it helps a child plan safe research and take questions to the safety-checked chat. */
export default function Research({ child }: { child: Child }) {
  const [question, setQuestion] = useState('')
  const ready = question.trim().length > 3
  if (!allowed(child, 'study')) {
    return <div><BackBar title="Research desk" to={`/child/${child.id}`} /><Locked what="Research desk" /></div>
  }
  const context = ready
    ? `I am researching this question: ${question.trim()}. Help me plan how to research it safely. Do not invent sources or facts. Tell me what to look for, how to check a source, and what I should ask a teacher or trusted adult.`
    : ''
  return (
    <div className="space-y-5">
      <BackBar title="Research desk" to={`/child/${child.id}`} />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5 sm:p-7">
          <h1 className="font-display text-3xl font-bold">Research desk</h1>
          <p className="mt-1 text-sm text-ink-soft">Start with a clear question, then check who made the information and why.</p>
          <div className="mt-2"><ReadAloud child={child} text="Research starts with a clear question. Then ask who made the information, when it was made, and how they know. Never trust one source alone." compact mood="calm" mode="explain" label="Hear how to research" /></div>
          <label htmlFor="research-q" className="mt-5 block text-sm font-bold text-ink-soft">What do you want to find out?</label>
          <Input id="research-q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={240} placeholder="e.g. How do scientists measure ocean depth?" className="mt-1" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ready
              ? <Link to={`/child/${child.id}/chat?context=${encodeURIComponent(context)}`} className="tap rounded-full bg-lav-deep px-4 py-2 text-sm font-bold text-white">💬 Plan it with Mallow</Link>
              : <Button disabled>Write a question first</Button>}
            <Link to={`/child/${child.id}/study`} className="tap rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-soft shadow-inset">Browse study topics</Link>
          </div>
          <div className="mt-5 rounded-3xl bg-butter-soft p-4 text-sm leading-relaxed text-[#6f5c18]">
            Mallow cannot browse the internet in this app. It can help you plan, explain ideas, and think about how to check a source. Always open links with a grown-up and never share personal details.
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Source check</h2>
          <p className="text-sm text-ink-soft">Ask these before you trust a fact.</p>
          <div className="mt-2"><ReadAloud child={child} text={`Source check. ${CHECKS.join(' ')}`} compact mood="calm" mode="explain" label="Hear the checklist" /></div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
            {CHECKS.map((c, i) => <li key={c} className="flex gap-2 rounded-2xl bg-white/80 px-3 py-2 shadow-inset"><span className="font-bold text-lav-deep">{i + 1}.</span><span>{c}</span></li>)}
          </ul>
        </Card>
      </div>
    </div>
  )
}
