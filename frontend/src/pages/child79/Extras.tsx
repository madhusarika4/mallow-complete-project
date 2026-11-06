import { useEffect, useState, type ReactNode } from 'react'
import ReadAloud from '../../components/ReadAloud'
import { api } from '../../lib/api'
import type { Child } from '../../lib/types'
import { Button, Card, Input, useToast } from '../../ui'
import { BackBar, Locked, allowed } from '../child46/kit'


function Page({ child, gate, title, children }: { child: Child; gate?: string; title: string; children: ReactNode }) {
  if (gate && !allowed(child, gate)) {
    return <div><BackBar title={title} to={`/child/${child.id}`} /><Locked what={title} /></div>
  }
  return <div className="space-y-5"><BackBar title={title} to={`/child/${child.id}`} />{children}</div>
}

interface Project {
  id: number
  kind: string
  title: string
  goal: string
  steps: { text: string; done: boolean }[]
  status: string
}

export function Projects({ child }: { child: Child }) {
  const toast = useToast()
  const [items, setItems] = useState<Project[] | null>(null)
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
      await api(`/children/${child.id}/projects`, {
        body: {
          kind: 'project',
          title: title.trim(),
          goal: goal.trim(),
          steps: steps.split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, done: false })),
        },
      })
      setTitle(''); setGoal(''); setSteps(''); toast('Project created.'); await load()
    } catch { toast('Could not create the project.', 'err') } finally { setBusy(false) }
  }
  const toggle = async (p: Project, i: number) => {
    const next = p.steps.map((s, k) => (k === i ? { ...s, done: !s.done } : s))
    try { await api(`/children/${child.id}/projects/${p.id}`, { method: 'PATCH', body: { steps: next } }); await load() } catch { toast('Could not update the step.', 'err') }
  }
  const finish = async (p: Project) => {
    try { await api(`/children/${child.id}/projects/${p.id}`, { method: 'PATCH', body: { status: p.status === 'done' ? 'active' : 'done' } }); await load() } catch { toast('Could not update the project.', 'err') }
  }

  return (
    <Page child={child} gate="projects" title="Projects">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold">Start a project</h2>
          <p className="mt-1 text-sm text-ink-soft">Big things get easier when you split them into small steps.</p>
          <div className="mt-2"><ReadAloud child={child} text="Start a project. Give it a name, say what done looks like, then add small steps." compact label="Hear how" /></div>
          <label htmlFor="project-title" className="mt-3 block text-sm font-bold text-ink-soft">What are you making?</label>
          <Input id="project-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. A volcano model" className="mt-1" />
          <label htmlFor="project-goal" className="mt-3 block text-sm font-bold text-ink-soft">What does done look like? (optional)</label>
          <Input id="project-goal" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={400} placeholder="It can erupt without making a mess" className="mt-1" />
          <label htmlFor="project-steps" className="mt-3 block text-sm font-bold text-ink-soft">Steps (one per line)</label>
          <textarea id="project-steps" value={steps} onChange={(e) => setSteps(e.target.value)} maxLength={2000} placeholder={'Find out how volcanoes work\nCollect materials\nBuild the model\nTry it out'} className="mt-1 min-h-[7rem] w-full rounded-3xl border border-line bg-white p-3 text-[16px] shadow-inset focus:border-lav-deep focus:outline-none focus:ring-2 focus:ring-lav" />
          <Button className="mt-3" onClick={() => void add()} loading={busy} disabled={!title.trim()}>Create project</Button>
        </Card>
        <div className="space-y-4">
          {items === null ? <Card className="p-5 text-sm text-ink-soft">Loading projects…</Card> : items.length === 0 ? <Card className="p-5 text-sm text-ink-soft">No projects yet. Pick one idea and start with a tiny first step.</Card> : items.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-display text-2xl font-bold">{p.title}</h3>{p.goal && <p className="text-sm text-ink-soft">{p.goal}</p>}</div><span className="rounded-full bg-lav-soft px-3 py-1 text-xs font-bold text-lav-deep">{p.status === 'done' ? 'Done' : 'Active'}</span></div>
              {p.steps.length > 0 && <div className="mt-2"><ReadAloud child={child} text={`${p.title}. ${p.goal}. Steps: ${p.steps.map((s) => s.text).join('. ')}`} compact label="Hear my plan" /></div>}
              <ul className="mt-3 space-y-1.5">{p.steps.map((step, i) => <li key={i}><button onClick={() => void toggle(p, i)} className="tap flex w-full items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-left text-sm shadow-inset"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${step.done ? 'border-mint-deep bg-mint-deep text-white' : 'border-line'}`}>{step.done ? '✓' : ''}</span><span className={step.done ? 'text-ink-faint line-through' : ''}>{step.text}</span></button></li>)}</ul>
              <Button className="mt-3" size="sm" variant="soft" tone={p.status === 'done' ? 'ink' : 'mint'} onClick={() => void finish(p)}>{p.status === 'done' ? 'Reopen' : 'All done'}</Button>
            </Card>
          ))}
        </div>
      </div>
    </Page>
  )
}

export { default as Feelings } from '../../components/FeelingsCheckIn'
