import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, Link, useParams } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import CompanionChat from '../../components/CompanionChat'
import { useApp } from '../../lib/app'
import { api } from '../../lib/api'
import { toLocalInput, parseLocal, ago, whenLabel, relDay, todayISO, hm } from '../../lib/time'
import type { Child, Language } from '../../lib/types'
import { Badge, Button, Card, ConfirmDialog, Empty, Field, Input, Modal, Segmented, Select, Spinner, Textarea, errMsg, useToast } from '../../ui'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PASTEL, GRID, AXIS, tooltipStyle } from '../../lib/charts'

export default function InfantCare() {
  const { children, loading } = useApp()
  if (loading) return <div className="grid place-items-center py-24"><Spinner size={30} /></div>
  const babies = children.filter((c) => c.is_infant)
  return (
    <Routes>
      <Route index element={babies.length === 1 ? <Navigate to={`${babies[0].id}`} replace /> : <Picker babies={babies} />} />
      <Route path=":id/*" element={<Tracker babies={babies} />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  )
}

function Picker({ babies }: { babies: Child[] }) {
  if (babies.length === 0) return (
    <Empty title="No baby profile yet" hint="Add a child aged 0–3 to start tracking feeds, sleep, diapers and growth. The companion here is for you, the grown-up, never the baby." art={<Bunny pose="sleep" accessory="nightcap" size={200} />}>
      <Link to="/parent/children?add=1" className="rounded-full bg-lav-deep px-5 py-2.5 font-bold text-white">Add a baby</Link></Empty>)
  return (
    <div className="space-y-5"><h1 className="text-3xl font-bold">Infant care</h1><p className="text-ink-soft">Choose a baby to open their care journal.</p>
      <div className="grid gap-4 sm:grid-cols-2">{babies.map((b) => <Link key={b.id} to={`${b.id}`} className="tap flex items-center gap-4 rounded-4xl border border-line bg-gradient-to-br from-lav-soft to-blush p-5 shadow-soft"><Bunny size={110} pose="sleep" accessory="nightcap" shadow={false} /><div><div className="font-display text-2xl font-bold">{b.nickname}</div><div className="text-sm text-ink-soft">{b.age_months != null && b.age_months < 36 ? `${b.age_months} month${b.age_months === 1 ? '' : 's'}` : `${b.age ?? 3} yr`}{b.is_demo ? ' · demo' : ''}</div><div className="text-xs text-ink-soft">{b.developmental_stage ?? 'Parent-led care'}</div></div></Link>)}</div></div>)
}

type Log = { id: number; type: 'feeding' | 'sleep' | 'diaper'; at: string; end: string | null; subtype: string; amount_ml: number | null; duration_minutes: number | null; note: string; is_sample: boolean }
type Summary = {
  today: { feeds: number; feed_ml: number; sleep_minutes: number; diapers: number }
  last: { feeding: Log | null; sleep: Log | null; diaper: Log | null }
  daily: { date: string; label: string; feeds: number; feed_ml: number; sleep_hours: number; wet: number; dirty: number; mixed: number }[]
  totals: { feeds: number; feed_ml: number; sleep_minutes: number; diapers: number }
  growth: { id: number; measured_on: string; weight_kg: number | null; length_cm: number | null; head_cm: number | null; note: string }[]
  reminders: { id: number; title: string; due_at: string; repeat: string; done: number }[]
  recent: Log[]; disclaimer: string
}

function Tracker({ babies }: { babies: Child[] }) {
  const { id } = useParams()
  const baby = babies.find((b) => String(b.id) === id)
  const { boot } = useApp()
  const [tab, setTab] = useState<'today' | 'feeding' | 'sleep' | 'diaper' | 'growth' | 'milestones' | 'companion'>('today')
  const [days, setDays] = useState(7)
  const [sum, setSum] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [quick, setQuick] = useState<null | 'feeding' | 'sleep' | 'diaper' | 'growth' | 'milestone'>(null)
  const refresh = () => setReload((x) => x + 1)
  useEffect(() => {
    if (!baby) return
    let off = false
    api<Summary>(`/infant/${baby.id}/summary?days=${days}`).then((s) => !off && setSum(s)).catch((e) => !off && setErr(errMsg(e)))
    return () => { off = true }
  }, [baby?.id, days, reload]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!baby) return <Empty title="Baby not found" hint="Pick a baby from the list."><Link className="font-bold text-lav-deep" to="/parent/infant">Back to infant care</Link></Empty>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-4xl border border-line bg-gradient-to-br from-lav-soft to-blush p-5 shadow-soft">
        <Bunny size={120} pose="sleep" accessory="nightcap" shadow={false} />
        <div className="min-w-0 flex-1"><div className="text-xs font-bold uppercase tracking-widest text-lav-deep">Infant care journal</div>
          <h1 className="text-3xl font-bold">{baby.nickname}</h1><p className="text-sm text-ink-soft">{baby.age_months != null && baby.age_months < 36 ? `${baby.age_months} month${baby.age_months === 1 ? '' : 's'} old` : `${baby.age ?? 3} years old`} · {baby.developmental_stage ?? 'Parent-led care'} · {babies.length > 1 ? <Link to="/parent/infant" className="font-bold underline">switch baby</Link> : 'this is your only baby profile'}</p></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick add">
          {(['feeding', 'sleep', 'diaper', 'growth', 'milestone'] as const).map((k) => <Button key={k} size="sm" variant="soft" tone={k === 'feeding' ? 'peach' : k === 'sleep' ? 'lav' : k === 'diaper' ? 'teal' : 'mint'} onClick={() => setQuick(k)} data-testid={`quick-${k}`}>＋ {k === 'milestone' ? 'Milestone' : k[0].toUpperCase() + k.slice(1)}</Button>)}
        </div>
      </div>
      <p className="rounded-2xl bg-butter-soft px-4 py-2 text-xs font-semibold text-[#7a6418]">A logging tool, not a medical device. It does not diagnose and does not say whether anything is normal. Talk to your doctor about concerns.</p>
      <nav className="flex gap-1 overflow-x-auto rounded-full bg-white/70 p-1 shadow-inset scroll-soft" role="tablist">
        {([['today', 'Today'], ['feeding', 'Feeding'], ['sleep', 'Sleep'], ['diaper', 'Diapers'], ['growth', 'Growth'], ['milestones', 'Milestones']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`tap whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${tab === k ? 'bg-lav-deep text-white' : 'text-ink-soft hover:bg-lav-soft'}`}>{l}</button>)}
      </nav>
      {err && <div role="alert" className="rounded-2xl bg-[#FFE9ED] p-4 text-[#A8445D]">{err}</div>}
      {tab === 'today' && (sum ? <TodayTab s={sum} days={days} setDays={setDays} babyId={baby.id} refresh={refresh} /> : !err && <Spinner />)}
      {tab === 'feeding' && <LogTab babyId={baby.id} kind="feeding" reload={reload} refresh={refresh} />}
      {tab === 'sleep' && <LogTab babyId={baby.id} kind="sleep" reload={reload} refresh={refresh} />}
      {tab === 'diaper' && <LogTab babyId={baby.id} kind="diaper" reload={reload} refresh={refresh} />}
      {tab === 'growth' && <GrowthTab babyId={baby.id} sum={sum} refresh={refresh} />}
      {tab === 'milestones' && <MilestoneTab babyId={baby.id} sum={sum} refresh={refresh} />}
      {tab === 'companion' && (
        <CompanionChat
          key={baby.id}
          audience="infant"
          childId={baby.id}
          title={`Companion for ${baby.nickname}`}
          subtitle="A private space for you, the grown-up. Logging stays in the journal; this is for the feelings around it."
          greeting={`Hi. I'm Mallow. This is your space, not ${baby.nickname}'s. How are you doing today, really?`}
          starters={[
            { label: 'I am exhausted', text: 'I am so exhausted from night feeds. How do I cope without feeling guilty?' },
            { label: 'I worry constantly', text: 'I keep worrying that I am doing something wrong. How can I calm my mind?' },
            { label: 'Feeding stress', text: 'Feeding has been stressful and I feel judged. Can we talk it through?' },
            { label: 'I need a break', text: 'I feel touched out and I want a break, but I feel bad saying it.' },
          ]}
          languages={(boot?.languages?.length ? boot.languages : ['English']) as Language[]}
          language={(boot?.languages?.[0] ?? 'English') as Language}
          safetyNote="Mallow offers general support, not medical advice, and never diagnoses you or your baby. If you or your baby may be in danger, contact your doctor, midwife, or local emergency services right now."
        />
      )}
      <QuickAdd babyId={baby.id} kind={quick} onClose={() => setQuick(null)} onSaved={() => { setQuick(null); refresh() }} />
    </div>
  )
}

function TodayTab({ s, days, setDays, babyId, refresh }: { s: Summary; days: number; setDays: (n: number) => void; babyId: number; refresh: () => void }) {
  const chartData = s.daily.map((d) => ({ day: d.label, sleep: d.sleep_hours, feeds: d.feeds, wet: d.wet, dirty: d.dirty, mixed: d.mixed }))
  const reminderCount = s.reminders.length
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4 bg-peach-soft"><div className="text-xs font-bold text-ink-soft">Last feeding</div><div className="font-display text-xl font-bold">{s.last.feeding ? ago(parseLocal(s.last.feeding.at)) : 'None yet'}</div><div className="text-xs text-ink-soft">{s.last.feeding ? `${s.last.feeding.subtype}${s.last.feeding.amount_ml ? ` · ${s.last.feeding.amount_ml} ml` : ''}` : ' '}</div></Card>
        <Card className="p-4 bg-lav-soft"><div className="text-xs font-bold text-ink-soft">Last sleep</div><div className="font-display text-xl font-bold">{s.last.sleep ? ago(parseLocal(s.last.sleep.end ?? s.last.sleep.at)) : 'None yet'}</div><div className="text-xs text-ink-soft">{s.last.sleep?.duration_minutes ? `${hm(s.last.sleep.duration_minutes)} sleep` : ' '}</div></Card>
        <Card className="p-4 bg-mint-soft"><div className="text-xs font-bold text-ink-soft">Sleep today</div><div className="font-display text-xl font-bold">{hm(s.today.sleep_minutes)}</div><div className="text-xs text-ink-soft">{s.today.feeds} feeds · {s.today.feed_ml} ml</div></Card>
        <Card className="p-4 bg-teal-soft"><div className="text-xs font-bold text-ink-soft">Diapers today</div><div className="font-display text-xl font-bold">{s.today.diapers}</div><div className="text-xs text-ink-soft">{s.last.diaper ? `last ${ago(parseLocal(s.last.diaper.at))}` : 'none logged'}</div></Card>
      </div>
      <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Last {days} days</h2><Segmented label="Range" size="sm" value={days} onChange={setDays} options={[{ value: 7, label: '7' }, { value: 14, label: '14' }, { value: 30, label: '30' }]} /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Sleep per day (hours)">{s.totals.sleep_minutes ? <ResponsiveContainer width="100%" height={200}><BarChart data={chartData}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 12 }} /><YAxis tick={{ fill: AXIS, fontSize: 12 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="sleep" name="Hours" fill={PASTEL[0]} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="py-10 text-center text-sm text-ink-soft">No sleep logged in this period yet.</p>}</ChartCard>
        <ChartCard title="Feeds per day">{s.totals.feeds ? <ResponsiveContainer width="100%" height={200}><BarChart data={chartData}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="feeds" name="Feeds" fill={PASTEL[1]} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="py-10 text-center text-sm text-ink-soft">No feeds logged yet.</p>}</ChartCard>
        <ChartCard title="Diaper changes by type">{s.totals.diapers ? <ResponsiveContainer width="100%" height={200}><BarChart data={chartData}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="wet" stackId="d" fill={PASTEL[3]} name="Wet" /><Bar dataKey="dirty" stackId="d" fill={PASTEL[5]} name="Dirty" /><Bar dataKey="mixed" stackId="d" fill={PASTEL[6]} name="Mixed" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="py-10 text-center text-sm text-ink-soft">No diaper changes logged yet.</p>}</ChartCard>
        <ChartCard title={`Upcoming reminders (${reminderCount})`}>{reminderCount ? <ul className="space-y-2">{s.reminders.map((r) => <ReminderRow key={r.id} r={r} babyId={babyId} refresh={refresh} />)}</ul> : <p className="py-10 text-center text-sm text-ink-soft">No reminders. Add one from the Milestones tab.</p>}</ChartCard>
      </div>
      <Card className="p-5"><h3 className="font-display text-xl font-bold">Recent entries</h3>
        {s.recent.length === 0 ? <p className="text-sm text-ink-soft">Nothing logged yet. Use the quick-add buttons above.</p> : <ul className="mt-3 divide-y divide-line">{s.recent.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><Badge tone={l.type === 'feeding' ? 'peach' : l.type === 'sleep' ? 'lav' : 'teal'}>{l.type}</Badge><span className="font-semibold">{l.subtype}</span><span className="text-ink-soft">{whenLabel(parseLocal(l.at))}</span>{l.amount_ml ? <span>· {l.amount_ml} ml</span> : null}{l.duration_minutes ? <span>· {hm(l.duration_minutes)}</span> : null}{l.note && <span className="text-ink-soft">· {l.note}</span>}{l.is_sample && <Badge tone="butter">sample</Badge>}</li>)}</ul>}
      </Card>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) { return <Card className="p-5"><h3 className="mb-2 font-display text-lg font-bold">{title}</h3>{children}</Card> }

function ReminderRow({ r, babyId, refresh }: { r: { id: number; title: string; due_at: string; repeat: string }; babyId: number; refresh: () => void }) {
  const toast = useToast()
  const toggle = async () => { try { await api(`/infant/${babyId}/reminders/${r.id}/toggle`, { method: 'POST' }); refresh() } catch (e) { toast(errMsg(e), 'err') } }
  return <li className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2 shadow-inset"><button onClick={toggle} aria-label={`Mark ${r.title} done`} className="tap grid h-6 w-6 place-items-center rounded-full border-2 border-lav-deep text-xs" /><span className="flex-1"><span className="block font-semibold">{r.title}</span><span className="text-xs text-ink-soft">{whenLabel(parseLocal(r.due_at))}{r.repeat !== 'none' ? ` · ${r.repeat}` : ''}</span></span></li>
}

function LogTab({ babyId, kind, reload, refresh }: { babyId: number; kind: 'feeding' | 'sleep' | 'diaper'; reload: number; refresh: () => void }) {
  const toast = useToast()
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [removing, setRemoving] = useState<Log | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setLogs(null); api<Log[]>(`/infant/${babyId}/logs?kind=${kind}&days=30`).then(setLogs).catch((e) => toast(errMsg(e), 'err')) }, [babyId, kind, reload]) // eslint-disable-line react-hooks/exhaustive-deps
  const del = async () => { if (!removing) return; setBusy(true); try { await api(`/infant/${babyId}/logs/${removing.id}`, { method: 'DELETE' }); toast('Entry deleted.'); setRemoving(null); refresh() } catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) } }
  if (!logs) return <Spinner />
  const groups = new Map<string, Log[]>()
  logs.forEach((l) => { const k = relDay(parseLocal(l.at)); groups.set(k, [...(groups.get(k) ?? []), l]) })
  const sumLine = (items: Log[]) => kind === 'feeding' ? `${items.length} feeds${items.some((i) => i.amount_ml) ? ` · ${items.reduce((a, i) => a + (i.amount_ml ?? 0), 0)} ml` : ''}`
    : kind === 'sleep' ? `${hm(items.reduce((a, i) => a + (i.duration_minutes ?? 0), 0))} asleep` : `${items.length} changes`
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-2xl font-bold capitalize">{kind === 'diaper' ? 'Diapers' : kind} history</h2><span className="text-sm text-ink-soft">Last 30 days</span></div>
      {logs.length === 0 ? <Empty title={`No ${kind} entries yet`} hint="Use the quick-add button at the top to log one." art={<Bunny size={100} pose="sleep" accessory="nightcap" />} /> :
        [...groups.entries()].map(([day, items]) => <Card key={day} className="p-4"><div className="mb-2 flex flex-wrap justify-between gap-2"><b>{day}</b><span className="text-sm text-ink-soft">{sumLine(items)}</span></div>
          <ul className="divide-y divide-line">{items.map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><span className="w-16 font-bold">{parseLocal(l.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span><span className="capitalize">{l.subtype}</span>{l.amount_ml ? <span>· {l.amount_ml} ml</span> : null}{l.duration_minutes ? <span>· {hm(l.duration_minutes)}</span> : null}{l.note && <span className="text-ink-soft">· {l.note}</span>}<button onClick={() => setRemoving(l)} className="tap ml-auto rounded-full px-3 py-1 text-xs font-bold text-[#C2566F] hover:bg-[#FFE9ED]">Delete</button></li>)}</ul></Card>)}
      <ConfirmDialog open={!!removing} title="Delete this entry?" busy={busy} onCancel={() => setRemoving(null)} onConfirm={del} message="It will be removed from the journal and the totals." />
    </div>
  )
}

function GrowthTab({ babyId, sum, refresh }: { babyId: number; sum: Summary | null; refresh: () => void }) {
  const toast = useToast()
  const [date, setDate] = useState(todayISO()); const [w, setW] = useState(''); const [l, setL] = useState(''); const [h, setH] = useState(''); const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const rows = sum?.growth ?? []
  const add = async () => {
    setErr(null)
    const nums = [w, l, h].map((x) => (x.trim() ? Number(x) : null))
    if (nums.every((n) => n === null)) return setErr('Enter at least one measurement.')
    if (nums.some((n) => n !== null && (Number.isNaN(n) || n <= 0))) return setErr('Measurements must be positive numbers.')
    if (date > todayISO()) return setErr('The date cannot be in the future.')
    setBusy(true)
    try { await api(`/infant/${babyId}/growth`, { body: { measured_on: date, weight_kg: nums[0], length_cm: nums[1], head_cm: nums[2], note } }); setW(''); setL(''); setH(''); setNote(''); toast('Growth record saved.'); refresh() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const del = async (id: number) => { try { await api(`/infant/${babyId}/growth/${id}`, { method: 'DELETE' }); toast('Record deleted.'); refresh() } catch (e) { toast(errMsg(e), 'err') } }
  const chart = (key: 'weight_kg' | 'length_cm' | 'head_cm', name: string, color: string) => (
    <ChartCard title={name}>{rows.some((r) => r[key] != null) ? <ResponsiveContainer width="100%" height={170}><LineChart data={rows.filter((r) => r[key] != null).map((r) => ({ d: r.measured_on.slice(5), v: r[key] }))}><CartesianGrid stroke={GRID} vertical={false} /><XAxis dataKey="d" tick={{ fill: AXIS, fontSize: 11 }} /><YAxis domain={['auto', 'auto']} tick={{ fill: AXIS, fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="v" name={name} stroke={color} strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <p className="py-8 text-center text-sm text-ink-soft">Add a {name.toLowerCase()} measurement to see the trend.</p>}</ChartCard>)
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-5"><h3 className="mb-3 font-display text-xl font-bold">Add a measurement</h3>
          <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); void add() }}>
            <Field label="Date">{(id) => <Input id={id} type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Weight (kg)">{(id) => <Input id={id} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />}</Field>
              <Field label="Length (cm)">{(id) => <Input id={id} inputMode="decimal" value={l} onChange={(e) => setL(e.target.value)} />}</Field>
              <Field label="Head (cm)">{(id) => <Input id={id} inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} />}</Field>
            </div>
            <Field label="Note (optional)">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            {err && <p role="alert" className="text-sm font-semibold text-[#C2566F]">{err}</p>}
            <Button type="submit" loading={busy} data-testid="growth-save">Save measurement</Button>
          </form>
          <p className="mt-3 text-xs text-ink-soft">Measurements are shown as you entered them. Mallow does not compare them with any chart or say whether they are typical.</p></Card>
        <div className="grid gap-5 sm:grid-cols-1">{chart('weight_kg', 'Weight', PASTEL[0])}{chart('length_cm', 'Length', PASTEL[2])}</div>
      </div>
      <Card className="overflow-x-auto p-5"><h3 className="mb-3 font-display text-xl font-bold">History</h3>
        {rows.length === 0 ? <p className="text-sm text-ink-soft">No growth records yet.</p> :
          <table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="text-ink-soft"><th className="py-2">Date</th><th>Weight</th><th>Length</th><th>Head</th><th>Note</th><th /></tr></thead>
            <tbody>{[...rows].reverse().map((r) => <tr key={r.id} className="border-t border-line"><td className="py-2 font-semibold">{r.measured_on}</td><td>{r.weight_kg ?? '—'}{r.weight_kg ? ' kg' : ''}</td><td>{r.length_cm ?? '—'}{r.length_cm ? ' cm' : ''}</td><td>{r.head_cm ?? '—'}{r.head_cm ? ' cm' : ''}</td><td className="text-ink-soft">{r.note}</td><td><button onClick={() => del(r.id)} className="tap rounded-full px-3 py-1 text-xs font-bold text-[#C2566F] hover:bg-[#FFE9ED]">Delete</button></td></tr>)}</tbody></table>}
      </Card>
    </div>
  )
}

function MilestoneTab({ babyId, sum, refresh }: { babyId: number; sum: Summary | null; refresh: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState(''); const [cat, setCat] = useState('movement'); const [on, setOn] = useState(todayISO()); const [err, setErr] = useState<string | null>(null)
  const [rt, setRt] = useState(''); const [rdue, setRdue] = useState(toLocalInput().slice(0, 16)); const [rep, setRep] = useState<'none' | 'daily' | 'weekly'>('none'); const [rerr, setRerr] = useState<string | null>(null)
  const [ms, setMs] = useState<{ id: number; achieved_on: string; title: string; category: string; note: string; is_sample: boolean }[] | null>(null)
  useEffect(() => { api<typeof ms>(`/infant/${babyId}/milestones`).then(setMs).catch((e) => toast(errMsg(e), 'err')) }, [babyId, sum]) // eslint-disable-line react-hooks/exhaustive-deps
  const add = async () => {
    setErr(null); if (!title.trim()) return setErr('Please describe the milestone.'); if (on > todayISO()) return setErr('Date cannot be in the future.')
    try { await api(`/infant/${babyId}/milestones`, { body: { achieved_on: on, title: title.trim(), category: cat } }); setTitle(''); toast('Milestone saved.'); refresh() } catch (e) { setErr(errMsg(e)) }
  }
  const addR = async () => {
    setRerr(null); if (!rt.trim()) return setRerr('Give the reminder a name.'); if (!rdue) return setRerr('Choose a date and time.')
    try { await api(`/infant/${babyId}/reminders`, { body: { title: rt.trim(), due_at: rdue, repeat: rep } }); setRt(''); toast('Reminder added.'); refresh() } catch (e) { setRerr(errMsg(e)) }
  }
  const delM = async (id: number) => { try { await api(`/infant/${babyId}/milestones/${id}`, { method: 'DELETE' }); refresh() } catch (e) { toast(errMsg(e), 'err') } }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5"><h3 className="mb-3 font-display text-xl font-bold">Milestones</h3>
        <div className="space-y-3"><Field label="What happened?" error={err}>{(id) => <Input id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. First smile" />}</Field>
          <div className="grid grid-cols-2 gap-2"><Field label="Category">{(id) => <Select id={id} value={cat} onChange={(e) => setCat(e.target.value)}>{['movement', 'language', 'social', 'feeding', 'sleep', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}</Select>}</Field>
            <Field label="Date">{(id) => <Input id={id} type="date" max={todayISO()} value={on} onChange={(e) => setOn(e.target.value)} />}</Field></div>
          <Button onClick={add} data-testid="milestone-add">Save milestone</Button></div>
        <ul className="mt-4 space-y-2">{(ms ?? []).map((m) => <li key={m.id} className="flex items-center gap-2 rounded-2xl bg-mint-soft px-3 py-2"><span className="flex-1"><b>{m.title}</b> <span className="text-xs text-ink-soft">{m.achieved_on} · {m.category}</span></span><button onClick={() => delM(m.id)} className="tap rounded-full px-2 py-1 text-xs font-bold text-[#C2566F]">Delete</button></li>)}
          {ms?.length === 0 && <li className="text-sm text-ink-soft">No milestones yet.</li>}</ul>
      </Card>
      <Card className="p-5"><h3 className="mb-3 font-display text-xl font-bold">Reminders</h3>
        <div className="space-y-3"><Field label="Reminder" error={rerr}>{(id) => <Input id={id} value={rt} maxLength={120} onChange={(e) => setRt(e.target.value)} placeholder="e.g. Clinic visit" />}</Field>
          <div className="grid grid-cols-2 gap-2"><Field label="When">{(id) => <Input id={id} type="datetime-local" value={rdue} onChange={(e) => setRdue(e.target.value)} />}</Field>
            <Field label="Repeat">{(id) => <Select id={id} value={rep} onChange={(e) => setRep(e.target.value as 'none')}><option value="none">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option></Select>}</Field></div>
          <Button onClick={addR} data-testid="reminder-add">Add reminder</Button></div>
        <ul className="mt-4 space-y-2">{(sum?.reminders ?? []).map((r) => <ReminderRow key={r.id} r={r} babyId={babyId} refresh={refresh} />)}{sum && sum.reminders.length === 0 && <li className="text-sm text-ink-soft">No open reminders.</li>}</ul>
      </Card>
    </div>
  )
}

function QuickAdd({ babyId, kind, onClose, onSaved }: { babyId: number; kind: null | 'feeding' | 'sleep' | 'diaper' | 'growth' | 'milestone'; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [at, setAt] = useState(toLocalInput().slice(0, 16))
  const [sub, setSub] = useState<string>('bottle'); const [ml, setMl] = useState(''); const [mins, setMins] = useState(''); const [note, setNote] = useState('')
  const [end, setEnd] = useState(toLocalInput().slice(0, 16)); const [sleepMode, setSleepMode] = useState<'end' | 'dur'>('end'); const [dur, setDur] = useState('60')
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  useEffect(() => { setErr(null); setSub(kind === 'feeding' ? 'bottle' : kind === 'diaper' ? 'wet' : 'nap'); setAt(toLocalInput().slice(0, 16)); setEnd(toLocalInput().slice(0, 16)) }, [kind])
  if (!kind) return null
  const submit = async () => {
    setErr(null)
    const future = (v: string) => new Date(v) > new Date(Date.now() + 5 * 60000)
    if (kind !== 'growth' && kind !== 'milestone' && future(at)) return setErr('That time is in the future.')
    setBusy(true)
    try {
      if (kind === 'feeding') {
        const m = ml ? Number(ml) : undefined
        if (m !== undefined && (m < 0 || m > 1500)) throw new Error('Amount must be between 0 and 1500 ml.')
        await api(`/infant/${babyId}/feeding`, { body: { at, subtype: sub, amount_ml: m ?? null, duration_minutes: mins ? Number(mins) : null, note } })
      } else if (kind === 'sleep') {
        if (sleepMode === 'end') { if (!end) throw new Error('Choose a wake-up time.'); if (new Date(end) <= new Date(at)) throw new Error('Wake-up time must be after the sleep start.'); await api(`/infant/${babyId}/sleep`, { body: { start: at, end, kind: sub, note } }) }
        else { const d = Number(dur); if (!d || d < 1) throw new Error('Duration must be at least 1 minute.'); await api(`/infant/${babyId}/sleep`, { body: { start: at, duration_minutes: d, kind: sub, note } }) }
      } else if (kind === 'diaper') await api(`/infant/${babyId}/diaper`, { body: { at, subtype: sub, note } })
      else if (kind === 'growth') { onClose(); toast('Use the Growth tab to add measurements.'); return }
      else { onClose(); toast('Use the Milestones tab to add a milestone.'); return }
      toast('Saved to the journal.'); onSaved()
    } catch (e) { setErr(e instanceof Error && !(e as { status?: number }).status ? e.message : errMsg(e)) } finally { setBusy(false) }
  }
  const title = kind === 'feeding' ? 'Log a feed' : kind === 'sleep' ? 'Log sleep' : kind === 'diaper' ? 'Log a diaper change' : kind === 'growth' ? 'Growth' : 'Milestone'
  return (
    <Modal open onClose={onClose} title={title}>
      <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void submit() }}>
        {kind === 'sleep' ? <Field label="Fell asleep at">{(id) => <Input id={id} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}</Field>
          : <Field label="Time">{(id) => <Input id={id} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}</Field>}
        {kind === 'feeding' && <>
          <Field label="Type">{(id) => <Select id={id} value={sub} onChange={(e) => setSub(e.target.value)}>{['bottle', 'breastfeeding', 'solids', 'other'].map((x) => <option key={x} value={x}>{x}</option>)}</Select>}</Field>
          {sub === 'bottle' && <Field label="Amount (ml)" hint="Up to 1500 ml">{(id) => <Input id={id} inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value)} />}</Field>}
          {sub === 'breastfeeding' && <Field label="Duration (minutes)">{(id) => <Input id={id} inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} />}</Field>}
        </>}
        {kind === 'sleep' && <>
          <Segmented label="How to enter" size="sm" value={sleepMode} onChange={setSleepMode} options={[{ value: 'end', label: 'Wake-up time' }, { value: 'dur', label: 'Duration' }]} />
          {sleepMode === 'end' ? <Field label="Woke up at">{(id) => <Input id={id} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
            : <Field label="Duration (minutes)">{(id) => <Input id={id} inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value)} />}</Field>}
          <Segmented label="Sleep type" size="sm" value={sub} onChange={setSub} options={[{ value: 'nap', label: 'Nap' }, { value: 'night', label: 'Night' }]} />
        </>}
        {kind === 'diaper' && <Segmented label="Change" value={sub} onChange={setSub} options={[{ value: 'wet', label: 'Wet' }, { value: 'dirty', label: 'Dirty' }, { value: 'mixed', label: 'Mixed' }]} />}
        {(kind === 'feeding' || kind === 'sleep' || kind === 'diaper') && <Field label="Note (optional)">{(id) => <Textarea id={id} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />}</Field>}
        {err && <p role="alert" className="text-sm font-semibold text-[#C2566F]">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy} data-testid="quick-save">Save</Button></div>
      </form>
    </Modal>
  )
}
