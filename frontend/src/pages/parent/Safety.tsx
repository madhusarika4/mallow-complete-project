import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import { useApp } from '../../lib/app'
import { api } from '../../lib/api'
import { whenLabel, parseUtc } from '../../lib/time'
import { Badge, Button, Empty, Modal, Segmented, Select, Spinner, Textarea, errMsg, useToast } from '../../ui'
import { CATEGORY_LABEL, PageHeader, SEVERITY, notificationLabel, notificationProblem, type Incident } from './shared'

export default function Safety() {
  const { boot, children } = useApp()
  const toast = useToast()
  const [status, setStatus] = useState<'all' | 'open' | 'reviewed'>('open')
  const [child, setChild] = useState<string>('')
  const [items, setItems] = useState<Incident[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<Incident | null>(null)
  const [note, setNote] = useState('')
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setErr(null)
    const q = new URLSearchParams({ status }); if (child) q.set('child_id', child)
    api<Incident[]>(`/safety/incidents?${q}`).then(setItems).catch((e) => setErr(errMsg(e)))
  }
  useEffect(load, [status, child]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (i: Incident, reopen: boolean) => {
    setBusy(true)
    setSaveErr(null)
    try {
      if (reopen) await api(`/safety/incidents/${i.id}/reopen`, { method: 'POST' })
      else await api(`/safety/incidents/${i.id}/review`, { body: { note } })
      toast(reopen ? 'Flag reopened.' : 'Marked as reviewed. Thank you for checking in.'); setReviewing(null); setNote(''); load()
    } catch (e) { setSaveErr(errMsg(e)) } finally { setBusy(false) }
  }
  const open = items?.filter((i) => !i.reviewed_at).length ?? 0
  const high = items?.some((i) => i.severity === 'high' && !i.reviewed_at)
  const failed = items?.filter(notificationProblem).length ?? 0

  return (
    <div className="space-y-5">
      <PageHeader title="Safety review" sub="Moments the safety system flagged for a grown-up to look at. A flag is a prompt to check in, not a verdict about your child." art={<div className="hidden sm:block"><Bunny size={100} mood="calm" accessory="scarf" shadow={false} /></div>} />
      {high && <div role="alert" className="rounded-4xl border border-[#F2B8C6] bg-blush p-5 shadow-soft">
        <div className="font-display text-xl font-bold text-rose-deep">Something needs a gentle check-in</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
          <li>Stay calm and listen before you ask questions. Let your child lead.</li>
          <li>Don't promise to keep a secret. Tell them you will help them stay safe.</li>
          <li>If someone may be hurting your child, contact a trusted adult, a child helpline, or local emergency services right away.</li>
          <li className="font-semibold">Helpline: {boot?.helpline}</li></ul></div>}
      {failed > 0 && <div role="alert" data-testid="notification-failure" className="rounded-4xl border-2 border-rose-deep/40 bg-[#FFF1F4] p-5 shadow-soft">
        <div className="font-display text-xl font-bold text-rose-deep">Trusted-adult notification unavailable or unconfirmed</div>
        <p className="mt-2 text-sm text-ink">The safety note is saved here, but appearing in this dashboard does not mean a notification was sent. Review the note and contact your child now.</p>
        <p className="mt-2 text-sm font-semibold text-ink">If your child may be in immediate danger, contact local emergency services or a child helpline right away. Do not wait for an app alert.</p>
        <Link to="/parent/safety" className="mt-3 inline-block text-sm font-bold text-rose-deep underline">Review the open safety notes below</Link>
      </div>}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Status" value={status} onChange={setStatus} options={[{ value: 'open', label: `Open${items && status !== 'reviewed' ? ` (${open})` : ''}` }, { value: 'reviewed', label: 'Reviewed' }, { value: 'all', label: 'All' }]} />
        <Select aria-label="Filter by child" value={child} onChange={(e) => setChild(e.target.value)} className="w-auto">
          <option value="">Everyone</option>{children.map((c) => <option key={c.id} value={c.id}>{c.nickname}</option>)}</Select>
      </div>
      {err && <div role="alert" className="rounded-2xl bg-[#FFE9ED] p-4 text-[#A8445D]">{err}</div>}
      {!items && !err && <div className="grid place-items-center py-16"><Spinner /></div>}
      {items && items.length === 0 && <Empty title={status === 'open' ? 'All clear' : 'Nothing here'} hint="No safety notes match these filters. Mallow still checks every message.">
        <Bunny size={120} mood="happy" /></Empty>}
      <ul className="space-y-3" data-testid="incident-list">
        {items?.map((i) => {
          const sev = SEVERITY[i.severity] ?? SEVERITY.info
          return <li key={i.id} data-testid={`incident-${i.id}`} className="rounded-3xl border border-line bg-white/85 p-4 shadow-soft">
            <div className="flex flex-wrap items-center gap-2"><Badge tone={sev.tone}>{sev.label}</Badge><span className="font-bold">{i.nickname}{i.is_demo ? ' · demo' : ''}</span>
              <span className="text-xs text-ink-soft">{CATEGORY_LABEL[i.category] ?? i.category.replace(/_/g, ' ')}</span>
              <span className="ml-auto text-xs text-ink-soft">{whenLabel(parseUtc(i.created_at))}</span></div>
            <p className="mt-2 text-[15px] text-ink-soft">{i.detail}</p>
            {notificationLabel(i) && <p className={`mt-2 text-xs font-bold ${notificationProblem(i) ? 'text-rose-deep' : 'text-teal-deep'}`}>{notificationLabel(i)}</p>}
            {i.parent_note && <p className="mt-2 rounded-2xl bg-lav-soft px-3 py-2 text-sm">Your note: {i.parent_note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {i.reviewed_at ? <Button size="sm" variant="ghost" onClick={() => save(i, true)} disabled={busy}>Reopen</Button>
                : <Button size="sm" variant="soft" tone="mint" onClick={() => { setNote(i.parent_note ?? ''); setSaveErr(null); setReviewing(i) }} data-testid={`review-${i.id}`}>Mark reviewed</Button>}
              <Link to={`/parent/child/${i.child_id}`} className="tap rounded-full px-3 py-1.5 text-sm font-bold text-lav-deep hover:bg-lav-soft">Open {i.nickname}'s profile →</Link>
            </div>
          </li>
        })}
      </ul>
      <Modal open={!!reviewing} onClose={() => { setReviewing(null); setSaveErr(null) }} title="Mark as reviewed">
        <div className="space-y-4"><p className="text-sm text-ink-soft">Optional: add a private note for yourself.</p>
          <Textarea aria-label="Private note" maxLength={400} rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
          {saveErr && <p role="alert" className="rounded-2xl bg-[#FFE9ED] px-4 py-2 text-sm font-semibold text-[#A8445D]">Could not save this note: {saveErr}</p>}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => { setReviewing(null); setSaveErr(null) }}>Cancel</Button><Button loading={busy} onClick={() => reviewing && save(reviewing, false)} data-testid="review-save">Save</Button></div></div>
      </Modal>
    </div>
  )
}
