import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import { Doodles } from '../../components/Decor'
import { api } from '../../lib/api'
import { BAND_BG, ChildCard, DistributionChart, MinutesChart, NoData, PageHeader, Panel, StatTile, fmtMin, type ChildStats } from './shared'
import { Badge, Button, Segmented, Spinner, errMsg } from '../../ui'

interface Ov {
  days: number; family: { children: number; infants: number; minutes_today: number; minutes_week: number; conversations: number; activities: number; games: number; safety_flags_open: number; safety_notifications_failed: number }
  children: ChildStats[]; compare: Record<string, number | string>[]; compare_names: string[]; distribution: { kind: string; label: string; count: number }[]
  infants: { id: number; nickname: string; is_demo: boolean; age: number | null; age_months: number | null; developmental_stage: string | null }[]
}

export default function Overview() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<Ov | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { let off = false; setErr(null); api<Ov>(`/dashboard/overview?days=${days}`).then((d) => !off && setData(d)).catch((e) => !off && setErr(errMsg(e))); return () => { off = true } }, [days])

  if (err) return <div className="rounded-3xl bg-[#FFE9ED] p-6 text-[#A8445D]" role="alert">{err} <Button size="sm" onClick={() => setDays(days)}>Retry</Button></div>
  if (!data) return <div className="grid place-items-center py-24"><Spinner size={30} /></div>
  const f = data.family
  const empty = data.children.length === 0 && data.infants.length === 0
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      <PageHeader title={`${greet} 🌸`} sub="A calm look at how everyone's doing with Mallow. Everything here comes from your saved activity." art={<div className="hidden sm:block"><Bunny size={96} pose="wave" mood="happy" shadow={false} /></div>}
        right={<div className="flex flex-wrap gap-2"><Link to="/parent/companion"><Button variant="soft" tone="mint" data-testid="open-companion">💬 Your companion</Button></Link><Link to="/parent/children?add=1"><Button data-testid="add-child">＋ Add child</Button></Link></div>} />
      {empty ? (
        <div className="relative overflow-hidden rounded-5xl border border-line bg-paper/90 p-10 text-center shadow-soft"><Doodles /><div className="relative z-10 flex flex-col items-center gap-3"><Bunny size={190} pose="wave" mood="happy" /><h2 className="text-3xl font-bold">Your family starts here</h2><p className="max-w-md text-ink-soft">Add your first child to begin, or load a clearly-marked demo family from Settings to look around.</p><div className="flex gap-2"><Link to="/parent/children?add=1"><Button>Add a child</Button></Link><Link to="/parent/settings"><Button variant="soft">Settings</Button></Link></div></div></div>
      ) : (<>
        {f.safety_notifications_failed > 0 && <div role="alert" data-testid="overview-notification-failure" className="mb-5 rounded-4xl border-2 border-rose-deep/40 bg-[#FFF1F4] p-5 shadow-soft">
          <div className="font-display text-xl font-bold text-rose-deep">A safety note needs your attention</div>
          <p className="mt-1 text-sm text-ink">No external trusted-adult notification is configured or delivery could not be confirmed. Review the note and contact your child now. If they may be in immediate danger, contact local emergency services or a child helpline right away.</p>
          <Link to="/parent/safety" className="mt-2 inline-block text-sm font-bold text-rose-deep underline">Open safety review</Link>
        </div>}
        <Panel title="Your family" hint="Choose a child to see their activity, safety notes and settings.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="family-cards">
            {data.children.map((s) => <ChildCard key={s.child.id} stats={s} to={`/parent/child/${s.child.id}`} />)}
            {data.infants.map((i) => (
              <Link key={i.id} to={`/parent/infant/${i.id}`} data-testid={`family-card-${i.id}`} className={`tap flex items-center gap-3 rounded-4xl border border-line bg-gradient-to-br ${BAND_BG['0-3']} p-4 shadow-soft transition hover:-translate-y-1 hover:shadow-lift`}>
                <Bunny size={84} pose="sleep" accessory="nightcap" shadow={false} />
                <div className="max-w-24 text-center text-xs font-semibold text-ink-soft">{i.age_months != null && i.age_months < 36 ? `${i.age_months} months` : `${i.age ?? 3} years`}<br />{i.developmental_stage ?? 'Parent-led care'}</div>
                <div><div className="font-display text-xl font-bold">{i.nickname}</div><div className="text-sm font-semibold text-ink-soft">Infant care tracker</div><div className="mt-1 flex gap-1">{i.is_demo && <Badge tone="butter">Demo</Badge>}<Badge tone="lav">🍼 Open tracker</Badge></div></div>
              </Link>
            ))}
          </div>
        </Panel>

        {data.children.length > 0 && (
          <div className="mt-5 space-y-5">
            <Panel title="All children" hint="Totals across the family" right={<Segmented label="Range" size="sm" value={days} onChange={setDays} options={[{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }]} />}>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <StatTile icon="⏱" label="Today" value={fmtMin(f.minutes_today)} tone="bg-lav-soft" />
                <StatTile icon="📅" label={`${days} days`} value={fmtMin(f.minutes_week)} tone="bg-mint-soft" />
                <StatTile icon="💬" label="Chats" value={f.conversations} tone="bg-blush-soft" />
                <StatTile icon="🎨" label="Activities" value={f.activities} tone="bg-peach-soft" />
                <StatTile icon="🎲" label="Games" value={f.games} tone="bg-butter-soft" />
                <StatTile icon="🛡" label="To review" value={f.safety_flags_open} sub={f.safety_notifications_failed ? <Link className="font-bold text-rose-deep underline" to="/parent/safety">Alert not confirmed</Link> : f.safety_flags_open ? <Link className="font-bold text-lav-deep underline" to="/parent/safety">Open safety</Link> : 'All clear'} tone="bg-teal-soft" />
              </div>
            </Panel>
            <div className="grid gap-5 lg:grid-cols-5">
              <Panel className="lg:col-span-3" title="Time with Mallow" hint="Minutes per day, each child side by side">
                {data.compare_names.length ? <MinutesChart data={data.compare} names={data.compare_names} /> : <NoData text="No usage yet." />}
              </Panel>
              <Panel className="lg:col-span-2" title="What everyone's doing" hint="Activity mix across children"><DistributionChart data={data.distribution} /></Panel>
            </div>
            <Panel title="Each child this period" hint="Minutes per child over the selected range">
              <ul className="space-y-3">{data.children.map((s) => { const max = Math.max(1, ...data.children.map((x) => x.totals.minutes_week)); return (
                <li key={s.child.id} className="flex items-center gap-3"><span className="w-20 shrink-0 truncate text-sm font-bold">{s.child.nickname}</span><div className="h-4 flex-1 overflow-hidden rounded-full bg-white/80 shadow-inner"><div className="h-full rounded-full bg-lav-deep/80" style={{ width: `${(100 * s.totals.minutes_week) / max}%` }} /></div><span className="w-16 text-right text-sm font-bold">{fmtMin(s.totals.minutes_week)}</span></li>) })}</ul>
            </Panel>
          </div>
        )}
      </>)}
    </div>
  )
}
