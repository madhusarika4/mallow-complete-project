import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import { useApp } from '../../lib/app'
import { api, apiBlob, ApiError } from '../../lib/api'
import { parseUtc, whenLabel } from '../../lib/time'
import type { Child } from '../../lib/types'
import { Badge, Button, Card, Empty, Input, Modal, Segmented, Spinner, Tabs, Toggle, errMsg, useToast } from '../../ui'
import { ACTIVITY_KEYS, ACTIVITY_LABELS, BAND_LABEL, DistributionChart, MinutesChart, NoData, PageHeader, Panel, ScoreChart, StatTile, LimitBar, ageText, fmtMin, notificationLabel, notificationProblem, type ChildStats, type Incident } from './shared'
import { CATEGORY_LABEL, SEVERITY } from './shared'

type Tab = 'overview' | 'activity' | 'safety' | 'controls'

export default function ChildDetail() {
  const { id } = useParams()
  const { children, refresh } = useApp()
  const child = children.find((c) => String(c.id) === id)
  const [tab, setTab] = useState<Tab>('overview')
  const [days, setDays] = useState(7)
  const [stats, setStats] = useState<ChildStats & { timeline: TL[]; conversations: Conv[]; recent_quizzes: Quiz[]; projects: Proj[]; creations: Cre[]; journal_entries: number; blocked_topic_hits: { created_at: string; category: string }[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!child) return
    let off = false; setErr(null)
    api<typeof stats>(`/dashboard/child/${child.id}?days=${days}`).then((d) => !off && setStats(d)).catch((e) => !off && setErr(errMsg(e)))
    return () => { off = true }
  }, [child?.id, days, reload]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!child) return <Empty title="We couldn't find that child" hint="They may have been removed."><Link className="font-bold text-lav-deep" to="/parent/children">Back to children</Link></Empty>
  if (child.is_infant) return <Empty title={`${child.nickname} is in infant care`} hint="Babies use the care tracker, not the child profile."><Link className="font-bold text-lav-deep" to="/parent/infant">Open care tracker</Link></Empty>

  return (
    <div className="space-y-5">
      <PageHeader title={child.nickname} sub={`${ageText(child)} · ${child.is_infant && child.developmental_stage ? child.developmental_stage : BAND_LABEL[child.age_band]}${child.is_demo ? ' · demo profile' : ''}`}
        art={<div className="hidden sm:block"><Bunny size={100} accessory={child.age_band === '10-12' ? 'glasses' : child.age_band === '7-9' ? 'scarf' : 'flower'} shadow={false} /></div>}
        right={<div className="flex flex-wrap items-center gap-2"><Link to={`/parent/companion?child=${child.id}`}><Button size="sm" variant="soft" tone="mint" data-testid="talk-about-child">💬 Talk about {child.nickname}</Button></Link><Segmented label="Range" size="sm" value={days} onChange={setDays} options={[{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }]} /></div>} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'activity', label: 'Activity' }, { id: 'safety', label: 'Safety' }, { id: 'controls', label: 'Controls' }]} />
      {tab === 'controls' ? <Controls child={child} onSaved={() => { void refresh(); setReload((x) => x + 1) }} /> : err ? <div role="alert" className="rounded-2xl bg-[#FFE9ED] p-4 text-[#A8445D]">{err}</div> : !stats ? <div className="grid place-items-center py-20"><Spinner size={30} /></div> :
        tab === 'overview' ? <OverviewTab s={stats} /> : tab === 'activity' ? <ActivityTab s={stats} child={child} /> : <SafetyTab child={child} onChange={() => setReload((x) => x + 1)} />}
    </div>
  )
}

type TL = { at: string; type: string; title: string; detail: string }
type Conv = { id: number; started_at: string; mode: string; language: string; minutes: number; messages: number; preview: string; flags: number }
type Quiz = { title: string; score: number; max_score: number; created_at: string }
type Proj = { id: number; kind: string; title: string; status: string; due_on: string | null }
type Cre = { id: number; kind: string; title: string; created_at: string }

function OverviewTab({ s }: { s: ChildStats }) {
  const t = s.totals
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile icon="💬" label="Conversations" value={t.conversations} sub={`${t.messages} things they said`} tone="bg-peach-soft" />
        <StatTile icon="🎯" label="Learning" value={t.learning_activities} sub={`${t.quizzes} quizzes · ${t.games} games`} tone="bg-butter-soft" />
        <StatTile icon="📅" label={`All Mallow time · ${s.days}d`} value={fmtMin(t.minutes_week)} sub="general conversations and activities" tone="bg-mint-soft" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Today's allowance" className="lg:col-span-1" hint="Resets at midnight, local time."><LimitBar limit={s.limit} />
          <p className="mt-3 text-sm text-ink-soft">{s.limit.status === 'reached' ? 'Today\'s talking time is used up. Mallow will say goodnight until tomorrow.' : s.limit.status === 'near' ? 'Almost at today\'s limit.' : 'Plenty of time left today.'}</p></Panel>
        <Panel title="Daily time with Mallow" className="lg:col-span-2" hint="Minutes per day"><MinutesChart data={s.daily.map((d) => ({ label: d.label, minutes: d.minutes }))} /></Panel>
        <Panel title="What they explore" className="lg:col-span-2"><DistributionChart data={s.distribution} /></Panel>
        <Panel title="Quiz scores over time" className="lg:col-span-1" hint="Average % per day"><ScoreChart data={s.daily} /></Panel>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="How they've been feeling" hint="Words the child used, sorted by a simple keyword check. Not a diagnosis.">
          {s.emotions.length ? <ul className="flex flex-wrap gap-2">{s.emotions.map((e) => <li key={e.emotion}><Badge tone="lav">{e.emotion} · {e.count}</Badge></li>)}</ul> : <NoData text="No feelings noticed in this period yet." />}
        </Panel>
        <Panel title="Languages used">{s.languages.length ? <ul className="flex flex-wrap gap-2">{s.languages.map((l) => <li key={l.language}><Badge tone="mint">{l.language} · {l.count} sessions</Badge></li>)}</ul> : <NoData text="No sessions in this period yet." />}</Panel>
      </div>
    </div>
  )
}

function ActivityTab({ s, child }: { s: NonNullable<Awaited<ReturnType<typeof api>>> & ChildStats & { timeline: TL[]; conversations: Conv[]; recent_quizzes: Quiz[]; projects: Proj[]; creations: Cre[]; journal_entries: number }; child: Child }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Panel title="Timeline" className="lg:col-span-2" hint="Newest first">
        {s.timeline.length === 0 ? <NoData text="Nothing yet. Activity appears here as your child explores." /> :
          <ol className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 scroll-soft">{s.timeline.map((t, i) => <li key={i} className="flex gap-3"><span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-lav-deep" /><div><div className="font-bold">{t.title}</div><div className="text-sm text-ink-soft">{t.detail}</div><div className="text-xs text-ink-faint">{whenLabel(parseUtc(t.at))}</div></div></li>)}</ol>}
      </Panel>
      <div className="space-y-5 lg:col-span-3">
        <Panel title="Conversations" hint="Open one to read the transcript. Only parents can see these.">
          {s.conversations.length === 0 ? <NoData text="No conversations yet." /> :
            <ul className="space-y-2">{s.conversations.map((c) => <li key={c.id}><button onClick={() => setOpen(c.id)} className="tap flex w-full flex-wrap items-center gap-2 rounded-2xl bg-white/80 p-3 text-left shadow-inset hover:bg-white"><Badge tone="peach">{c.mode}</Badge><span className="font-semibold">{c.preview || 'Conversation'}</span><span className="ml-auto text-xs text-ink-soft">{whenLabel(parseUtc(c.started_at))} · {c.minutes} min{c.flags ? ` · ${c.flags} flag` : ''}</span></button></li>)}</ul>}
        </Panel>
        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Recent quizzes">{s.recent_quizzes.length ? <ul className="space-y-2">{s.recent_quizzes.map((q, i) => <li key={i} className="flex justify-between rounded-2xl bg-butter-soft px-3 py-2"><span>{q.title}</span><b>{q.score}/{q.max_score}</b></li>)}</ul> : <NoData text="No quizzes completed yet." />}</Panel>
          <Panel title="Projects & creations" hint={`${s.journal_entries} private journal entries (text is never shown here)`}>
            {s.projects.length + s.creations.length === 0 ? <NoData text="No projects or creations yet." /> :
              <ul className="space-y-2 text-sm">{s.projects.map((p) => <li key={`p${p.id}`} className="flex justify-between rounded-2xl bg-mint-soft px-3 py-2"><span>{p.title}</span><Badge tone={p.status === 'done' ? 'mint' : 'lav'}>{p.status}</Badge></li>)}{s.creations.map((c) => <li key={`c${c.id}`} className="rounded-2xl bg-peach-soft px-3 py-2">🎨 {c.title} <span className="text-xs text-ink-soft">({c.kind})</span></li>)}</ul>}
          </Panel>
        </div>
      </div>
      <TranscriptModal childId={child.id} sessionId={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function TranscriptModal({ childId, sessionId, onClose }: { childId: number; sessionId: number | null; onClose: () => void }) {
  const [data, setData] = useState<{ messages: { role: string; text: string; created_at: string }[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (sessionId == null) return
    setData(null); setErr(null)
    api<{ messages: { role: string; text: string; created_at: string }[] }>(`/dashboard/child/${childId}/conversation/${sessionId}`).then(setData).catch((e) => setErr(errMsg(e)))
  }, [childId, sessionId])
  return (
    <Modal open={sessionId != null} onClose={onClose} title="Conversation" wide>
      {err ? <p role="alert" className="text-[#A8445D]">{err}</p> : !data ? <Spinner /> : data.messages.length === 0 ? <NoData text="No messages in this conversation." /> :
        <ul className="space-y-2">{data.messages.map((m, i) => <li key={i} className={`max-w-[85%] rounded-3xl px-4 py-2 ${m.role === 'child' ? 'ml-auto bg-peach' : 'bg-white border border-line'}`}><div className="text-[11px] font-bold uppercase text-ink-soft">{m.role === 'child' ? 'Child' : 'Mallow'}</div>{m.text}</li>)}</ul>}
    </Modal>
  )
}

function SafetyTab({ child, onChange }: { child: Child; onChange: () => void }) {
  const toast = useToast()
  const [items, setItems] = useState<Incident[] | null>(null)
  const load = () => api<Incident[]>(`/safety/incidents?child_id=${child.id}`).then(setItems).catch((e) => toast(errMsg(e), 'err'))
  useEffect(() => { void load() }, [child.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (i: Incident) => {
    try { await api(`/safety/incidents/${i.id}/${i.reviewed_at ? 'reopen' : 'review'}`, { method: 'POST', body: i.reviewed_at ? undefined : { note: '' } }); toast(i.reviewed_at ? 'Flag reopened.' : 'Marked reviewed.'); await load(); onChange() } catch (e) { toast(errMsg(e), 'err') }
  }
  if (!items) return <Spinner />
  const failed = items.filter(notificationProblem).length
  return (
    <div className="space-y-3">
      {failed > 0 && <div role="alert" className="rounded-3xl border-2 border-rose-deep/40 bg-[#FFF1F4] p-4 text-sm text-ink"><b className="text-rose-deep">Trusted-adult alert not confirmed.</b> The safety note is saved, but the parent-dashboard alert was not recorded. Please check in with your child now. If they may be in immediate danger, contact local emergency services or a child helpline right away.</div>}
      {items.length === 0 ? <Empty title="No safety notes for this child" hint="Mallow checks every message. When it steps in, you'll see a calm note here." art={<Bunny size={100} mood="happy" />} /> :
        items.map((i) => <Card key={i.id} className="p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={SEVERITY[i.severity]?.tone ?? 'lav'}>{SEVERITY[i.severity]?.label ?? 'Note'}</Badge><b>{CATEGORY_LABEL[i.category] ?? i.category}</b><span className="ml-auto text-xs text-ink-soft">{whenLabel(parseUtc(i.created_at))}</span></div>
          <p className="mt-2 text-sm text-ink-soft">{i.detail}</p>{notificationLabel(i) && <p className={`mt-1 text-xs font-bold ${notificationProblem(i) ? 'text-rose-deep' : 'text-teal-deep'}`}>{notificationLabel(i)}</p>}<div className="mt-2"><Button size="sm" variant="soft" tone={i.reviewed_at ? 'ink' : 'mint'} onClick={() => act(i)}>{i.reviewed_at ? 'Reopen' : 'Mark reviewed'}</Button></div></Card>)}
      <p className="text-xs text-ink-soft">Flags are prompts to check in, not diagnoses. For urgent concerns contact a trusted adult or local emergency services.</p>
    </div>
  )
}

function Controls({ child, onSaved }: { child: Child; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ nickname: child.nickname, daily_minutes: child.daily_minutes, voice_enabled: child.voice_enabled, preferred_language: child.preferred_language, languages: child.languages, activities: child.activities, blocked: (child.blocked_topics ?? []).join(', ') })
  const [busy, setBusy] = useState(false)
  const [voices, setVoices] = useState<{ engine: string; voice_id: string; name: string; accent: string; gender: string; ready: boolean; online: boolean }[] | null>(null)
  const [voiceErr, setVoiceErr] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [voiceLang, setVoiceLang] = useState(child.preferred_language)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    setVoices(null); setVoiceErr(null)
    api<typeof voices>(`/voice/voices?language=${voiceLang}`).then(setVoices).catch((e) => setVoiceErr(errMsg(e)))
  }, [voiceLang])

  const save = async () => {
    if (!f.nickname.trim()) return toast('Please enter a name.', 'err')
    if (f.languages.length === 0) return toast('Choose at least one language.', 'err')
    setBusy(true)
    try {
      await api(`/children/${child.id}`, { method: 'PATCH', body: { nickname: f.nickname.trim(), daily_minutes: f.daily_minutes, voice_enabled: f.voice_enabled, languages: f.languages, preferred_language: f.preferred_language, activities: f.activities, blocked_topics: f.blocked.split(',').map((x) => x.trim()).filter(Boolean) } })
      toast('Settings saved for ' + f.nickname.trim() + '.'); onSaved()
    } catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  const saveVoice = async (v: NonNullable<typeof voices>[number]) => {
    try { await api(`/children/${child.id}`, { method: 'PATCH', body: { voice_engine: v.engine, voice_id: v.voice_id, voice_language: voiceLang, voice_locale: '' } }); toast(`${v.name} saved for ${child.nickname}.`); onSaved() } catch (e) { toast(errMsg(e), 'err') }
  }
  const preview = async (v: NonNullable<typeof voices>[number]) => {
    setPreviewing(true)
    try {
      const { blob } = await apiBlob('/voice/preview', { engine: v.engine, voice_id: v.voice_id, language: voiceLang, mood: 'neutral' }).catch(async () => { throw new ApiError('Preview failed', 503) })
      const el = new Audio(URL.createObjectURL(blob)); await el.play()
    } catch (e) { toast(e instanceof ApiError && e.status === 503 ? 'That voice needs internet (Edge TTS) or a local model. It is not available right now.' : errMsg(e), 'err') } finally { setPreviewing(false) }
  }
  const toggleAct = (k: string) => set('activities', f.activities.includes(k) ? f.activities.filter((x) => x !== k) : [...f.activities, k])

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Profile & limits">
        <div className="space-y-4">
          <label className="block text-sm font-bold">Name<Input className="mt-1.5" maxLength={32} value={f.nickname} onChange={(e) => set('nickname', e.target.value)} /></label>
          <label className="block text-sm font-bold">Daily talking time: <b>{f.daily_minutes} min</b><input type="range" min={0} max={240} step={5} value={f.daily_minutes} onChange={(e) => set('daily_minutes', Number(e.target.value))} className="mt-2 w-full accent-[#9D86C9]" aria-label="Daily talking time" /></label>
          <Toggle checked={f.voice_enabled} onChange={(v) => set('voice_enabled', v)} label="Allow voice" hint="The microphone and spoken replies." />
          <div><div className="mb-1.5 text-sm font-bold">Languages</div><div className="flex flex-wrap gap-2">{(['English', 'Telugu', 'Hinglish'] as const).map((l) => <button type="button" key={l} aria-pressed={f.languages.includes(l)} onClick={() => set('languages', f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l])} className={`tap rounded-full px-4 py-2 text-sm font-bold ${f.languages.includes(l) ? 'bg-mint-deep text-white' : 'bg-white text-ink-soft shadow-inset'}`}>{l}</button>)}</div></div>
          <div><div className="mb-1.5 text-sm font-bold">Preferred language</div><Segmented label="Preferred language" size="sm" value={f.preferred_language} onChange={(v) => set('preferred_language', v)} options={f.languages.map((l) => ({ value: l, label: l }))} /></div>
          <label className="block text-sm font-bold">Blocked topics <span className="font-normal text-ink-soft">(comma-separated)</span><Input className="mt-1.5" value={f.blocked} onChange={(e) => set('blocked', e.target.value)} placeholder="e.g. ghosts, scary movies" /></label>
          <Button loading={busy} onClick={save} data-testid="controls-save">Save settings</Button>
        </div>
      </Panel>
      <div className="space-y-5">
        <Panel title="Allowed activities" hint="Turn off whole areas. The child will see a friendly 'a grown-up turned this off' message.">
          <div className="grid gap-2 sm:grid-cols-2">{ACTIVITY_KEYS.map((k) => <Toggle key={k} checked={f.activities.includes(k)} onChange={() => toggleAct(k)} label={ACTIVITY_LABELS[k].label} hint={ACTIVITY_LABELS[k].hint} />)}</div>
        </Panel>
        <Panel title="Mallow's voice" hint={`For ${f.preferred_language} speech. Edge voices are free but need internet. Expression is limited by the free provider.`}>
          <Segmented label="Voice language" size="sm" value={voiceLang} onChange={setVoiceLang} options={f.languages.map((l) => ({ value: l, label: l }))} />
          {voiceErr ? <p role="alert" className="mt-3 text-sm text-[#A8445D]">{voiceErr}</p> : !voices ? <Spinner /> : voices.length === 0 ? <NoData text="No voices match this language." /> :
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 scroll-soft">{voices.slice(0, 20).map((v) => <li key={v.voice_id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 p-2.5 shadow-inset">
              <span className="min-w-0 flex-1"><b>{v.name}</b> <span className="text-xs text-ink-soft">{v.gender} · {v.accent || 'accent n/a'} · {v.online ? 'online' : 'local'}</span></span>
              <Button size="sm" variant="ghost" disabled={previewing} onClick={() => preview(v)}>▶ Preview</Button>
              <Button size="sm" variant="soft" tone="mint" onClick={() => saveVoice(v)}>Use</Button></li>)}</ul>}
          <p className="mt-3 text-xs text-ink-soft">Mallow only falls back to another voice in the same language and tells you when it does.</p>
        </Panel>
      </div>
    </div>
  )
}
