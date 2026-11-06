import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Child, Language } from '../../lib/types'
import { Button, Field, Input, Modal, Segmented, Toggle, errMsg, useToast } from '../../ui'

const LANGS: Language[] = ['English', 'Telugu', 'Hinglish']

export default function ChildForm({ open, onClose, child, onSaved }: { open: boolean; onClose: () => void; child?: Child | null; onSaved: () => void }) {
  const toast = useToast()
  const [nickname, setNickname] = useState(child?.nickname ?? '')
  const [how, setHow] = useState<'age' | 'dob'>('age')
  const [ageUnit, setAgeUnit] = useState<'months' | 'years'>(child?.age_months != null && child.age_months < 36 ? 'months' : 'years')
  const [age, setAge] = useState(String(child?.age_months != null && child.age_months < 36 ? child.age_months : child?.age ?? 5))
  const [dob, setDob] = useState(child?.dob ?? '')
  const [langs, setLangs] = useState<Language[]>(child?.languages ?? ['English'])
  const [minutesDraft, setMinutesDraft] = useState(String(child?.daily_minutes ?? 30))
  const [voice, setVoice] = useState(child?.voice_enabled ?? true)
  const [err, setErr] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const childLanguages = child?.languages?.join(',') ?? ''

  useEffect(() => {
    if (!open) return
    setNickname(child?.nickname ?? '')
    setHow(child?.dob ? 'dob' : 'age')
    const months = child?.age_months
    const unit = months != null && months < 36 ? 'months' : 'years'
    setAgeUnit(unit)
    setAge(String(unit === 'months' ? months : child?.age ?? 5))
    setDob(child?.dob ?? '')
    setLangs(childLanguages ? childLanguages.split(',') as Language[] : ['English'])
    setMinutesDraft(String(child?.daily_minutes ?? 30))
    setVoice(child?.voice_enabled ?? true)
    setErr({}); setFormErr(null)
  }, [open, child?.id, child?.nickname, child?.dob, child?.dob_exact, child?.age, child?.age_months, childLanguages, child?.daily_minutes, child?.voice_enabled])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!nickname.trim()) e.nickname = 'Please enter a name.'
    if (nickname.trim().length > 32) e.nickname = 'Keep the name to 32 characters.'
    if (how === 'age') {
      const n = Number(age)
      if (ageUnit === 'months') { if (!Number.isInteger(n) || n < 0 || n > 35) e.age = 'Choose an age from 0 to 35 months.' }
      else if (!Number.isFinite(n) || n < 0 || n > 12 || (n >= 3 && !Number.isInteger(n))) e.age = 'Choose an age from 0 to 12 years. Ages under 3 may use decimal years.'
    }
    else if (!dob) e.dob = 'Please pick a date of birth.'
    else if (new Date(dob) > new Date()) e.dob = 'The date of birth cannot be in the future.'
    if (!langs.length) e.langs = 'Choose at least one language.'
    const minutes = Number(minutesDraft)
    if (!/^\d+$/.test(minutesDraft) || !Number.isInteger(minutes) || minutes < 0 || minutes > 240) e.minutes = 'Enter a whole number from 0 to 240.'
    setErr(e); return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setBusy(true); setFormErr(null)
    const years = Number(age)
    const ageMonths = ageUnit === 'months' ? Number(age) : years < 3 ? Math.round(years * 12) : null
    const body = { nickname: nickname.trim(), languages: langs, daily_minutes: Number(minutesDraft), voice_enabled: voice,
      ...(how === 'age' ? (ageMonths != null && ageMonths < 36 ? { age_months: ageMonths } : { age: ageMonths != null ? 3 : years }) : { dob }) }
    try {
      if (child) await api(`/children/${child.id}`, { method: 'PATCH', body })
      else await api('/children', { body })
      toast(child ? `Saved ${nickname.trim()}'s profile.` : `Added ${nickname.trim()}.`)
      onSaved(); onClose()
    } catch (e) { setFormErr(errMsg(e)) } finally { setBusy(false) }
  }

  const changeAgeUnit = (unit: 'months' | 'years') => {
    if (unit === ageUnit) return
    const n = Number(age)
    if (unit === 'months' && n >= 3 && child) return
    if (unit === 'months' && n >= 3) { setAge('0'); setAgeUnit(unit); return }
    setAge(unit === 'years' ? (n / 12).toFixed(2).replace(/\.?0+$/, '') : String(Math.round(n * 12)))
    setAgeUnit(unit)
  }
  const ageAsMonths = ageUnit === 'months' ? Number(age) : Number(age) < 3 ? Math.round(Number(age) * 12) : Number(age) * 12
  const yearsForBand = Math.floor(ageAsMonths / 12)
  const stage = ageAsMonths < 36 ? `${Math.floor(ageAsMonths / 6) * 6}-${Math.min(Math.floor(ageAsMonths / 6) * 6 + 5, 35)} months` : yearsForBand === 3 ? '3 years' : yearsForBand <= 6 ? '4-6 years' : yearsForBand <= 9 ? '7-9 years' : '10-12 years'
  const band = how === 'dob' && dob ? '' : ageAsMonths < 48 ? `Parent-led infant/toddler care · ${stage}` : yearsForBand <= 6 ? `Early childhood · ${stage}` : yearsForBand <= 9 ? `Middle childhood · ${stage}` : `Preteen · ${stage}`

  return (
    <Modal open={open} onClose={onClose} title={child ? `Edit ${child.nickname}` : 'Add a child'} wide>
      <form className="space-y-5" noValidate onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <Field label="Name" hint="Stored only on this computer. Never sent to the AI." error={err.nickname}>{(id) => <Input id={id} data-testid="child-name" maxLength={32} value={nickname} onChange={(e) => setNickname(e.target.value)} />}</Field>
        <div className="space-y-2">
          <div className="text-sm font-bold">Age</div>
          <Segmented label="How do you want to give the age" value={how} onChange={setHow} options={[{ value: 'age', label: 'Age' }, { value: 'dob', label: 'Date of birth' }]} />
          {how === 'age' ? <div className="space-y-2">
            <div role="radiogroup" aria-label="Age unit" className="inline-flex gap-1 rounded-full bg-white/80 p-1 shadow-inset">
              {(['months', 'years'] as const).map((unit) => { const disabled = !!child && unit === 'months' && ageUnit === 'years' && Number(age) >= 3; return <button key={unit} type="button" role="radio" aria-checked={ageUnit === unit} disabled={disabled} onClick={() => changeAgeUnit(unit)} className={`tap rounded-full px-4 py-1.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${ageUnit === unit ? 'bg-lav-deep text-white shadow-soft' : 'text-ink-soft hover:bg-lav-soft'}`}>{unit[0].toUpperCase() + unit.slice(1)}</button> })}
            </div>
            <Field label={`Age (${ageUnit})`} error={err.age}>{(id) => <Input id={id} type="number" inputMode="decimal" min={0} max={ageUnit === 'months' ? 35 : 12} step={ageUnit === 'months' || Number(age) >= 3 ? 1 : 0.01} value={age} onChange={(e) => {
              const value = e.target.value
              if (ageUnit === 'months' && Number(value) >= 36) { setAgeUnit('years'); setAge('3') }
              else setAge(value)
            }} />}</Field>
            {ageUnit === 'months' && <p className="text-xs text-ink-soft">Choose 0–35 months. At 36 months, use the years system. Months are grouped into 0–5, 6–11, 12–17, 18–23, 24–29 and 30–35 month stages.</p>}
            {ageUnit === 'years' && Number(age) < 3 && <p className="text-xs text-ink-soft">Decimal years convert to the nearest month (for example, 1.5 years = 18 months).</p>}
          </div>
            : <Field label="Date of birth" hint="The learning experience updates automatically as birthdays pass. Data is kept." error={err.dob}>{(id) => <Input id={id} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />}</Field>}
          {band && <p className="rounded-2xl bg-lav-soft px-3 py-2 text-sm font-semibold text-lav-deep" data-testid="band-preview">Experience: {band}</p>}
          {how === 'age' && <p className="text-xs text-ink-soft">Children up to age 12 are supported. Babies (0–3) get the infant care tracker only.</p>}
        </div>
        <div className="space-y-2">
          <div className="text-sm font-bold">Languages Mallow may use</div>
          <div className="flex flex-wrap gap-2">{LANGS.map((l) => <button type="button" key={l} aria-pressed={langs.includes(l)} onClick={() => setLangs((x) => x.includes(l) ? x.filter((y) => y !== l) : [...x, l])} className={`tap rounded-full px-4 py-2 text-sm font-bold ${langs.includes(l) ? 'bg-mint-deep text-white' : 'bg-white text-ink-soft shadow-inset'}`}>{l}</button>)}</div>
          {err.langs && <p role="alert" className="text-xs font-semibold text-[#C2566F]">{err.langs}</p>}
        </div>
        <Field label="Daily talking time (minutes)" hint="0 switches chat off for the day." error={err.minutes}>{(id) => <Input id={id} type="text" inputMode="numeric" pattern="[0-9]*" value={minutesDraft} onChange={(e) => { setMinutesDraft(e.target.value); if (err.minutes) setErr((x) => ({ ...x, minutes: '' })) }} aria-label="Daily talking time (minutes)" />}</Field>
        <Toggle checked={voice} onChange={setVoice} label="Allow voice conversations" hint="Mallow listens only when your child presses the microphone." />
        {formErr && <p role="alert" className="rounded-2xl bg-[#FFE9ED] px-4 py-2 text-sm font-semibold text-[#A8445D]">{formErr}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy} data-testid="child-save">{child ? 'Save changes' : 'Add child'}</Button></div>
      </form>
    </Modal>
  )
}
