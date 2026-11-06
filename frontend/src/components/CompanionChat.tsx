import { useEffect, useRef, useState } from 'react'
import Bunny, { type BunnyState } from './Bunny'
import { useApp } from '../lib/app'
import { useCompanion, type CompanionState } from '../lib/useCompanion'
import { Button, Segmented } from '../ui'
import type { CompanionAudience, Language } from '../lib/types'

interface Props {
  audience: CompanionAudience
  childId?: number | null
  title: string
  subtitle?: string
  greeting: string
  starters?: { label: string; text: string }[]
  languages?: Language[]
  language?: Language
  safetyNote?: string
  compact?: boolean
}

const STATUS: Record<CompanionState, string> = {
  ready: 'Ready when you are',
  listening: 'Listening…',
  processing: 'Hearing you…',
  thinking: 'Thinking with you…',
  speaking: 'Mallow is speaking',
  error: 'Something went wrong',
}
const HINT: Record<CompanionState, string> = {
  ready: 'Tap the mic to talk, or type below',
  listening: 'Tap again when you are done',
  processing: 'Just a moment',
  thinking: 'Mallow is thinking',
  speaking: 'Tap to stop and talk',
  error: 'You can try again or type',
}

export default function CompanionChat({
  audience, childId = null, title, subtitle, greeting, starters = [], languages = ['English'],
  language: languageProp, safetyNote, compact = false,
}: Props) {
  const { boot } = useApp()
  const [language, setLanguage] = useState<Language>(languageProp ?? languages[0] ?? 'English')
  useEffect(() => { if (languageProp) setLanguage(languageProp) }, [languageProp])
  const v = useCompanion({
    audience, childId, language,
    voiceAvailable: !!boot?.services.voice_output,
    sttAvailable: !!boot?.services.stt,
  })
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [v.messages.length, v.state, v.liveText])

  const infant = audience === 'infant'
  const bunnyState: BunnyState = v.state === 'listening' ? 'listening' : v.state === 'processing' || v.state === 'thinking' ? 'thinking' : v.state === 'speaking' ? 'speaking' : v.state === 'error' ? 'error' : 'idle'
  const disabledInput = v.loading || v.state === 'processing' || v.state === 'thinking'
  const canSend = !!draft.trim() && !disabledInput && v.state !== 'listening'
  const bubbleMallow = infant ? 'bg-white border border-[#F3D9CE]' : 'bg-white border border-line'
  const bubbleUser = infant ? 'bg-peach text-ink' : 'bg-lav text-ink'
  const accent = infant ? 'bg-peach-deep' : 'bg-lav-deep'
  const ring = infant ? 'bg-peach/60' : 'bg-rose/50'

  const submit = () => { if (v.send(draft)) setDraft('') }

  return (
    <section aria-label={title} className={`flex flex-col gap-4 ${compact ? '' : 'lg:flex-row lg:items-start'}`}>
      <div className={`flex flex-col items-center gap-3 rounded-4xl border p-4 shadow-soft ${infant ? 'border-[#F3D9CE] bg-[#FFF8F3]/80' : 'border-line bg-white/70'} ${compact ? '' : 'lg:w-64 lg:shrink-0'}`}>
        <Bunny size={compact ? 120 : 150} state={bunnyState} mood={infant ? 'love' : 'calm'} pose={v.state === 'ready' && v.messages.length === 0 ? 'wave' : 'sit'} accessory={infant ? 'flower' : 'none'} />
        <div className="text-center" aria-live="polite">
          <div className="font-display text-lg font-semibold" data-testid="companion-status" data-state={v.state}>{STATUS[v.state]}</div>
          <div className="text-sm text-ink-soft">{v.state === 'listening' ? `${HINT.listening} · ${v.seconds}s` : HINT[v.state]}</div>
        </div>

        {v.inputPath !== 'none' ? (
          <div className="relative">
            {v.state === 'listening' && <><span className={`absolute inset-0 animate-ring rounded-full ${ring}`} /><span className={`absolute inset-0 animate-ring rounded-full ${ring}`} style={{ animationDelay: '.5s' }} /></>}
            <button
              type="button"
              data-testid="companion-mic"
              aria-label={v.state === 'listening' ? 'Stop listening' : v.state === 'speaking' ? 'Stop Mallow and talk' : 'Talk to Mallow'}
              aria-pressed={v.state === 'listening'}
              disabled={disabledInput}
              onClick={() => { if (v.state === 'listening') v.stopListening(); else void v.startListening() }}
              className={`tap relative z-10 grid h-20 w-20 place-items-center rounded-full text-white shadow-lift disabled:opacity-50 ${v.state === 'listening' ? 'bg-rose-deep' : v.state === 'speaking' ? 'bg-peach-deep' : accent}`}
            >
              {v.state === 'listening'
                ? <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="3" /></svg>
                : v.state === 'processing' || v.state === 'thinking'
                  ? <span className="h-7 w-7 animate-spin rounded-full border-4 border-white/40 border-t-white" />
                  : <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
            </button>
          </div>
        ) : <p className="max-w-[16rem] rounded-2xl bg-lav-soft px-4 py-3 text-center text-sm text-ink-soft" data-testid="companion-voice-unavailable">{v.voiceReason}</p>}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {v.state === 'speaking' && <Button size="sm" variant="soft" tone="peach" onClick={v.stopSpeaking} data-testid="companion-stop">■ Stop</Button>}
          {boot?.services.voice_output && (
            <button type="button" onClick={() => { v.setSpeakerOn(!v.speakerOn); if (v.speakerOn) v.stopSpeaking() }} aria-pressed={v.speakerOn} data-testid="companion-speaker-toggle" className="tap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink-soft shadow-inset">
              {v.speakerOn ? '🔊 Mallow talks' : '🔇 Muted'}
            </button>
          )}
        </div>
        {languages.length > 1 && <Segmented size="sm" label="Language" value={language} onChange={(l) => { v.cancel(); setLanguage(l) }} options={languages.map((l) => ({ value: l, label: l }))} />}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
          </div>
          {v.state === 'speaking' && <span className="chip bg-lav-soft text-lav-deep">🔊 Playing</span>}
        </div>

        <div className={`scroll-soft flex flex-col gap-3 overflow-y-auto rounded-4xl border p-4 shadow-soft ${infant ? 'border-[#F3D9CE] bg-[#FFFDFA]/70' : 'border-line bg-white/60'} ${compact ? 'min-h-[15rem] max-h-[24rem]' : 'min-h-[18rem] max-h-[32rem]'}`} data-testid="companion-messages" role="log" aria-live="polite">
          {v.loading && <p className="text-center text-sm text-ink-soft">Opening your conversation…</p>}
          {!v.loading && v.messages.length === 0 && (
            <div className={`animate-rise max-w-[88%] whitespace-pre-wrap rounded-3xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed ${bubbleMallow}`}>{greeting}</div>
          )}
          {v.messages.map((m) => (
            <div key={m.id} className={`animate-rise flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                data-role={m.role}
                className={`group relative max-w-[88%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-[15px] leading-relaxed ${m.role === 'user' ? `${bubbleUser} rounded-br-md ${m.pending ? 'opacity-70' : ''} ${m.failed ? 'ring-2 ring-[#E58A9E]' : ''}` : `${bubbleMallow} rounded-bl-md ${m.urgent ? 'ring-2 ring-rose-deep' : ''}`}`}
              >
                {m.text}
                {m.role === 'assistant' && boot?.services.voice_output && (
                  <button type="button" onClick={() => v.replay(m)} aria-label="Hear this again" title="Hear this again" className="tap ml-2 inline-grid h-7 w-7 place-items-center rounded-full bg-lav-soft align-middle text-sm text-lav-deep">▶</button>
                )}
              </div>
            </div>
          ))}
          {v.state === 'listening' && v.liveText && <div className="flex justify-end"><div className={`max-w-[88%] rounded-3xl rounded-br-md px-4 py-3 italic opacity-70 ${bubbleUser}`}>{v.liveText}…</div></div>}
          {v.state === 'thinking' && <div className="flex gap-1 pl-3" aria-label="Mallow is thinking">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 animate-bounce rounded-full bg-lav-deep/60" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>}
          <div ref={endRef} />
        </div>

        {v.notice && <div className="rounded-2xl bg-lav-soft px-4 py-2 text-sm text-ink-soft" role="status">{v.notice}</div>}
        {v.error && (
          <div role="alert" data-testid="companion-error" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-[#FFE9ED] px-4 py-3 text-sm font-semibold text-[#A8445D]">
            <span>{v.error}</span>
            <span className="flex gap-2">{v.canRetry && <Button size="sm" tone="rose" variant="soft" onClick={v.retry} data-testid="companion-retry">Try again</Button>}<Button size="sm" variant="ghost" onClick={v.dismissError}>Dismiss</Button></span>
          </div>
        )}

        {starters.length > 0 && v.messages.length === 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Conversation starters">
            {starters.map((s) => <button key={s.label} type="button" disabled={v.loading || v.state !== 'ready'} onClick={() => v.send(s.text)} className="tap rounded-full border border-line bg-white px-4 py-2 text-sm font-bold shadow-soft hover:bg-lav-soft disabled:opacity-50">{s.label}</button>)}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex gap-2">
          <label className="sr-only" htmlFor={`companion-input-${audience}`}>Message Mallow</label>
          <input
            id={`companion-input-${audience}`}
            data-testid="companion-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1200}
            disabled={disabledInput}
            placeholder={infant ? 'Tell Mallow what is on your mind…' : 'Ask Mallow anything…'}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-full border border-line bg-white px-5 py-3 text-[15px] shadow-soft placeholder:text-ink-faint focus:border-lav-deep focus:outline-none focus:ring-2 focus:ring-lav"
          />
          <Button type="submit" disabled={!canSend} data-testid="companion-send">Send</Button>
        </form>

        <p className="text-xs leading-relaxed text-ink-faint" role="note">
          {safetyNote ?? (infant
            ? 'Mallow offers general support, not medical diagnosis. For urgent worries about you or your baby, contact your doctor or local emergency services right away.'
            : 'Mallow offers general guidance, not medical or legal advice. In an emergency, contact local services.')}
        </p>
      </div>
    </section>
  )
}
