import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../lib/app'
import { api, setToken } from '../../lib/api'
import { Button, Card, ConfirmDialog, Field, Input, errMsg, useToast } from '../../ui'
import { PageHeader, Panel } from './shared'

export default function Settings() {
  const { boot, refresh, lock } = useApp()
  const toast = useToast(); const nav = useNavigate()
  const [name, setName] = useState(boot?.companion_name ?? 'Mallow')
  const [old, setOld] = useState(''); const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('')
  const [pinErr, setPinErr] = useState<string | null>(null)
  const [demoConfirm, setDemoConfirm] = useState(false)
  const [wipe, setWipe] = useState(false); const [wipeText, setWipeText] = useState(''); const [busy, setBusy] = useState(false)
  const s = boot?.services

  const saveName = async () => {
    if (!name.trim() || name.trim().length > 24) return toast('Name must be 1–24 characters.', 'err')
    try { await api('/settings', { method: 'PATCH', body: { companion_name: name.trim() } }); toast('Companion name saved.'); await refresh() } catch (e) { toast(errMsg(e), 'err') }
  }
  const changePin = async () => {
    setPinErr(null)
    if (pin.length < 4) return setPinErr('Use at least 4 characters.')
    if (pin !== pin2) return setPinErr('The two new PINs do not match.')
    try { await api('/auth/change-pin', { body: { old_pin: old, new_pin: pin } }); setOld(''); setPin(''); setPin2(''); toast('PIN changed.') } catch (e) { setPinErr(errMsg(e)) }
  }
  const demo = async (remove: boolean) => {
    setBusy(true)
    try { await api(remove ? '/demo' : '/demo/seed', { method: remove ? 'DELETE' : 'POST' }); toast(remove ? 'Demo family removed. Your real children are untouched.' : 'Demo family reset with fresh sample data.'); await refresh(); setDemoConfirm(false) }
    catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  const deleteAll = async () => {
    setBusy(true)
    try { await api('/data/delete-all', { body: { confirm: 'DELETE' } }); setToken(null); toast('All data deleted.'); await refresh(); nav('/') }
    catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" sub="Names, PIN, AI and voice status, demo data and privacy." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Companion name" hint="What the child calls their friend.">
          <div className="flex gap-2"><Input aria-label="Companion name" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} /><Button onClick={saveName}>Save</Button></div>
        </Panel>
        <Panel title="Parent PIN" hint="Stored as a salted PBKDF2 hash. Not production-grade security.">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void changePin() }}>
            <Field label="Current PIN">{(id) => <Input id={id} type="password" value={old} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" />}</Field>
            <Field label="New PIN" error={pinErr}>{(id) => <Input id={id} type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="new-password" />}</Field>
            <Field label="Confirm new PIN">{(id) => <Input id={id} type="password" value={pin2} onChange={(e) => setPin2(e.target.value)} autoComplete="new-password" />}</Field>
            <Button type="submit">Change PIN</Button>
          </form>
        </Panel>
      </div>
      <Panel title="Voice and AI status" hint="What is connected right now. Nothing here needs a paid service.">
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="service-status">
          <Status ok={!!s?.llm} label="AI replies" on="Connected to your AI provider" off="Simple offline mode (stories, riddles, maths, comfort). Set LLM_* in .env for full answers." />
          <Status ok={!!s?.stt} label="Speech to text (server)" on="Server transcription on" off="Using the browser's speech recognition (Chrome or Edge, no key needed)." />
          <Status ok={!!s?.voice_output} label="Spoken replies" on={`Voices: ${s?.voice_output_label}`} off="No server voice ready. The browser's device voice is used when available." />
          <Status ok={!!s?.moderation} label="AI safety classifier" on="On (extra check)" off="Off. Rule-based safety checks are always on." />
        </ul>
        <p className="mt-3 text-xs text-ink-soft">Free options: Edge TTS (no key, needs internet) is on by default. For full AI replies, a free-tier OpenAI-compatible provider can be set in <code className="rounded bg-white px-1">.env</code>. Mallow never switches providers silently. See README.</p>
      </Panel>
      <Panel title="Demo data" hint="Fictional sample family. Kept separate from real children and clearly labelled.">
        <p className="text-sm text-ink-soft">{boot?.demo_count ? `${boot.demo_count} demo profiles are present.` : 'No demo profiles are present.'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="soft" tone="butter" onClick={() => setDemoConfirm(true)} data-testid="demo-reset">Add / reset demo family</Button>
          <Button variant="ghost" onClick={() => demo(true)} disabled={busy || !boot?.demo_count}>Remove demo data</Button>
        </div>
      </Panel>
      <Card className="p-5"><h3 className="font-display text-xl font-bold">Privacy and stored data</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
        <li>Chat messages and assistant replies are stored in this app's SQLite database as full transcripts. Audio recordings are not retained after processing.</li>
        <li>Authorized parents can read full transcripts, conversation dates and durations, message counts, activity and learning results, usage totals, and safety notes in each child's dashboard.</li>
        <li>Child profiles are scoped separately. Safety checks run on messages; ordinary conversation is not itself an alert. When a message is flagged, its safety note appears in the authorized parent's Safety section.</li>
        <li>If an AI provider is connected, messages, prior turns needed for context, activity context, language, and age band are sent to it to generate a reply. The app does not add the child's profile name to that request.</li>
        <li>There is no automatic transcript expiry in this app. Records remain until that child's profile is removed or Delete all data is explicitly completed. These actions remove the associated stored records.</li></ul></Card>
      <Card className="border-[#F2B8C6] bg-[#FFF3F5] p-5"><h3 className="font-display text-xl font-bold text-[#A8445D]">Danger zone</h3><p className="text-sm text-ink-soft">Deletes every child, conversation, record and the PIN.</p>
        <Button className="mt-3" variant="danger" onClick={() => setWipe(true)} data-testid="delete-all">Delete all data…</Button></Card>
      <div className="flex justify-end"><Button variant="soft" tone="ink" onClick={lock}>Lock parent space</Button></div>
      <ConfirmDialog open={demoConfirm} title="Reset the demo family?" confirmLabel="Reset demo" busy={busy} onCancel={() => setDemoConfirm(false)} onConfirm={() => demo(false)}
        message="This replaces the demo children with fresh sample data. Your real children are not affected." />
      <ConfirmDialog open={wipe} title="Delete all data?" confirmLabel="Delete everything" busy={busy} disabled={wipeText !== 'DELETE'} onCancel={() => { setWipe(false); setWipeText('') }} onConfirm={deleteAll}
        message={<div className="space-y-3"><p>This cannot be undone. Type <b>DELETE</b> to confirm.</p><Input aria-label="Type DELETE to confirm" value={wipeText} onChange={(e) => setWipeText(e.target.value)} /></div>} />
    </div>
  )
}

function Status({ ok, label, on, off }: { ok: boolean; label: string; on: string; off: string }) {
  return <li className="flex items-start gap-3 rounded-2xl bg-white/80 p-3 shadow-inset"><span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${ok ? 'bg-mint-deep' : 'bg-peach-deep'}`}>{ok ? '✓' : '•'}</span><span><span className="block font-bold">{label}</span><span className="text-sm text-ink-soft">{ok ? on : off}</span></span></li>
}
