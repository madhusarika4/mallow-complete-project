import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import { useApp } from '../../lib/app'
import { api } from '../../lib/api'
import type { Child } from '../../lib/types'
import { Button, ConfirmDialog, Empty, errMsg, useToast } from '../../ui'
import { BAND_BG, BAND_LABEL, ageText, PageHeader } from './shared'
import ChildForm from './ChildForm'

export default function Children() {
  const { children, refresh } = useApp()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Child | null | undefined>(undefined)
  const [removing, setRemoving] = useState<Child | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  useEffect(() => { if (params.get('add') === '1') { setEditing(null); setParams({}, { replace: true }) } }, [params, setParams])

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try { await api(`/children/${removing.id}?confirm=true`, { method: 'DELETE' }); toast(`${removing.nickname} and all their records were removed.`); setRemoving(null); await refresh() }
    catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title="Children" sub="Each child has their own experience, voice, limits and history. Babies use the infant care tracker." right={<Button onClick={() => setEditing(null)} data-testid="add-child">＋ Add child</Button>} />
      {children.length === 0 ? <Empty title="No children yet" hint="Add your first child to start."><Bunny size={120} /></Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="children-grid">
          {children.map((c) => (
            <div key={c.id} className={`flex flex-col gap-3 rounded-4xl border border-line bg-gradient-to-br p-5 shadow-soft ${BAND_BG[c.age_band]}`} data-testid={`child-row-${c.id}`}>
              <div className="flex items-center gap-4">
                <Bunny size={96} shadow={false} accessory={c.age_band === '10-12' ? 'glasses' : c.age_band === '7-9' ? 'scarf' : 'flower'} />
                <div className="min-w-0"><div className="font-display text-2xl font-bold">{c.nickname}{c.is_demo && <span className="ml-2 rounded-full bg-butter px-2 text-xs">Demo</span>}</div>
                  <div className="text-sm font-semibold text-ink-soft">{ageText(c)} · {BAND_LABEL[c.age_band]}</div>
                  {c.is_infant && c.developmental_stage && <div className="text-xs text-ink-soft">Developmental stage: {c.developmental_stage}</div>}
                  <div className="text-xs text-ink-soft">{c.languages?.join(' · ') || ''}{!c.is_infant && ` · ${c.daily_minutes} min/day`}</div></div>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {c.is_infant ? <Link to="/parent/infant" className="tap rounded-full bg-white px-4 py-2 text-sm font-bold shadow-inset">Open care tracker</Link>
                  : <Link to={`/parent/child/${c.id}`} className="tap rounded-full bg-white px-4 py-2 text-sm font-bold shadow-inset">View details</Link>}
                <Button size="sm" variant="soft" tone="lav" onClick={() => setEditing(c)} data-testid={`edit-${c.id}`}>Edit</Button>
                <Button size="sm" variant="soft" tone="rose" onClick={() => setRemoving(c)} data-testid={`remove-${c.id}`}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ChildForm open={editing !== undefined} child={editing} onClose={() => setEditing(undefined)} onSaved={refresh} />
      <ConfirmDialog open={!!removing} title={`Remove ${removing?.nickname ?? ''}?`} confirmLabel="Remove permanently" busy={busy} onCancel={() => setRemoving(null)} onConfirm={remove}
        message={<>This permanently deletes {removing?.nickname}'s profile, conversations, activities, safety notes, and any baby logs. It cannot be undone.</>} />
    </div>
  )
}
