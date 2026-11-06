import { useEffect, useMemo, useRef, useState } from 'react'
import Bunny, { type BunnyState, type Mood } from './Bunny'
import { GREETINGS, useVoiceChat, type VoiceState } from '../lib/useVoiceChat'
import { useApp } from '../lib/app'
import { Button, Segmented } from '../ui'
import type { Child, Language, Mode } from '../lib/types'

export type ChatVariant = 'little' | 'explorer' | 'study'
interface Props {
  child: Child; variant: ChatVariant; mode?: Mode; starters?: { label: string; text: string; mode?: Mode }[]
  placeholder?: string; modes?: { id: Mode; label: string }[]; context?: string
}

const STATUS: Record<VoiceState, string> = {
  ready: 'Ready', listening: "I'm listening…", processing: 'Reading what you said…', thinking: 'Thinking…', speaking: 'Mallow is talking', error: 'Oops',
}
const HINT: Record<VoiceState, string> = {
  ready: 'Tap the mic and talk', listening: 'Tap again when you are done', processing: 'One moment', thinking: 'Mallow is thinking', speaking: 'Tap to stop and talk', error: 'Try again',
}

export default function MallowChat({ child, variant, mode: modeProp = 'chat', starters = [], placeholder = 'Type to Mallow…', modes, context = '' }: Props) {
  const { boot } = useApp()
  const [language, setLanguage] = useState<Language>(child.preferred_language)
  const [mode, setMode] = useState<Mode>(modeProp)
  useEffect(() => setMode(modeProp), [modeProp])
  const v = useVoiceChat({ child, language, mode, boot, context })
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [v.messages.length, v.state, v.liveText])

  const bunnyState: BunnyState = v.state === 'listening' ? 'listening' : v.state === 'thinking' || v.state === 'processing' ? 'thinking' : v.state === 'speaking' ? 'speaking' : v.state === 'error' ? 'error' : 'idle'
  const mood: Mood = v.emotion === 'sad' || v.emotion === 'scared' ? 'sad' : v.emotion === 'proud' || v.emotion === 'happy' ? 'happy' : 'calm'
  const big = variant === 'little'
  const mascot = big ? 190 : variant === 'explorer' ? 150 : 110
  const disabledInput = v.limitReached || v.loading
  const micBusy = v.state === 'processing' || v.state === 'thinking'

  const micLabel = v.state === 'listening' ? 'Finish this turn'
    : v.state === 'speaking' ? 'Interrupt Mallow and talk'
      : v.conversationOn ? 'Listen again' : 'Start voice conversation'
  const onMic = () => {
    if (v.state === 'listening') v.stopListening()
    else if (v.state === 'speaking') v.interrupt()
    else if (v.conversationOn) void v.startListening()
    else v.startConversation()
  }
  const pushToTalk = () => { if (v.state === 'listening') v.stopListening(); else void v.startListening() }

  const greeting = useMemo(() => GREETINGS[language], [language])
  const msgs = v.messages
  const submit = () => { if (v.send(draft, 'text')) setDraft('') }

  const bubbleMallow = variant === 'study' ? 'bg-white border border-line' : 'bg-white border border-line shadow-soft'
  const bubbleChild = variant === 'study' ? 'bg-lav text-ink' : variant === 'explorer' ? 'bg-mint text-ink' : 'bg-peach text-ink'
  const text = big ? 'text-xl leading-relaxed' : variant === 'explorer' ? 'text-[17px]' : 'text-[15px]'
  const privacyMessage = child.age_band === '4-6'
    ? 'You can talk to Mallow about things that matter to you. Your grown-up can read our chats. If you say someone may be unsafe, Mallow may tell a trusted grown-up who can help. Mallow cannot keep safety worries secret.'
    : child.age_band === '7-9'
      ? 'Your chats are personal, and your parent or guardian may be able to read them. If you share something that suggests you or someone else may be unsafe, Mallow may share it with a trusted grown-up who can help. Mallow cannot keep safety concerns secret.'
      : 'Your conversations are personal, but they are saved and your parent or guardian can read the full chat. If you share something that suggests you or someone else may be unsafe, Mallow may share that information with a trusted adult who can help. Mallow cannot promise to keep safety concerns secret.'

  return (
    <section aria-label="Talk with Mallow" className={`flex flex-col gap-4 ${variant === 'study' ? 'lg:flex-row' : ''}`}>
      {/* mascot + voice controls */}
      <div className={`relative flex flex-col items-center gap-3 rounded-4xl border border-line bg-white/70 p-4 shadow-soft ${variant === 'study' ? 'lg:w-64 lg:shrink-0 lg:self-start' : ''}`}>
        <Bunny size={mascot} state={bunnyState} mood={mood} pose={v.state === 'ready' && msgs.length === 0 ? 'wave' : 'sit'} accessory={variant === 'study' ? 'glasses' : 'none'} />
        <div className="text-center" aria-live="polite">
          <div className={`font-display font-semibold ${big ? 'text-2xl' : 'text-lg'}`} data-testid="voice-status" data-state={v.state}>{STATUS[v.state]}</div>
          <div className="text-sm text-ink-soft">{v.state === 'listening' ? `${HINT.listening} · ${v.seconds}s` : v.conversationOn ? 'Voice chat is on. Mallow will reply and keep listening.' : HINT[v.state]}</div>
        </div>
        {v.inputPath !== 'none' ? (
          <div className="relative">
            {v.state === 'listening' && <><span className="absolute inset-0 animate-ring rounded-full bg-rose/50" /><span className="absolute inset-0 animate-ring rounded-full bg-rose/40" style={{ animationDelay: '.5s' }} /></>}
            <button
              data-testid="mic-button" aria-label={micLabel} aria-pressed={v.conversationOn} disabled={disabledInput || micBusy}
              onClick={onMic}
              className={`tap relative z-10 grid place-items-center rounded-full text-white shadow-lift disabled:opacity-50 ${big ? 'h-28 w-28' : 'h-20 w-20'} ${v.state === 'listening' ? 'bg-rose-deep' : v.state === 'speaking' ? 'bg-peach-deep' : v.conversationOn ? 'bg-mint-deep' : 'bg-lav-deep'}`}
            >
              {v.state === 'listening' ? <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="3" /></svg>
                : micBusy ? <span className="h-7 w-7 animate-spin rounded-full border-4 border-white/40 border-t-white" />
                : <svg width={big ? 46 : 34} height={big ? 46 : 34} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>}
            </button>
          </div>
        ) : <p className="max-w-[16rem] rounded-2xl bg-lav-soft px-4 py-3 text-center text-sm text-ink-soft" data-testid="voice-unavailable">{v.voiceReason}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {v.conversationOn && <Button size="sm" variant="soft" tone="peach" onClick={v.stopConversation} data-testid="stop-conversation">■ End voice chat</Button>}
          {!v.conversationOn && v.inputPath !== 'none' && <Button size="sm" variant="soft" tone="rose" onClick={pushToTalk} disabled={disabledInput || micBusy} data-testid="push-to-talk">{v.state === 'listening' ? 'Finish recording' : 'Push to talk'}</Button>}
          {v.state === 'speaking' && <Button size="sm" variant="soft" tone="peach" onClick={v.stopSpeaking} data-testid="stop-speaking">■ Stop voice</Button>}
          {child.voice_enabled && <button onClick={() => { v.setSpeakerOn(!v.speakerOn); if (v.speakerOn) v.stopSpeaking() }} aria-pressed={v.speakerOn} data-testid="speaker-toggle" className="tap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink-soft shadow-inset">{v.speakerOn ? '🔊 Mallow talks' : '🔇 Muted'}</button>}
        </div>
        {child.languages.length > 1 && <Segmented size="sm" label="Language" value={language} onChange={(l) => { v.cancel(); setLanguage(l) }} options={child.languages.map((l) => ({ value: l, label: l }))} />}
        {modes && modes.length > 1 && <Segmented size="sm" label="Chat mode" value={mode} onChange={(m) => { v.cancel(); setMode(m) }} options={modes.map((m) => ({ value: m.id, label: m.label }))} />}
      </div>

      {/* conversation */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="rounded-2xl border border-line bg-lav-soft/70 px-4 py-3 text-sm leading-relaxed text-ink-soft" data-testid="child-privacy-explanation" role="note">{privacyMessage}</p>
        <div className={`scroll-soft flex flex-col gap-3 overflow-y-auto rounded-4xl border border-line bg-white/60 p-4 shadow-soft ${big ? 'min-h-[18rem] max-h-[26rem]' : 'min-h-[16rem] max-h-[30rem]'}`} data-testid="messages" role="log" aria-live="polite">
          {v.loading && <p className="text-center text-sm text-ink-soft">Getting ready…</p>}
          {!v.loading && msgs.length === 0 && (
            <div className={`animate-rise max-w-[85%] rounded-3xl rounded-bl-md px-4 py-3 ${bubbleMallow} ${text}`}>{greeting}</div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`animate-rise flex ${m.role === 'child' ? 'justify-end' : 'justify-start'}`}>
              <div className={`group relative max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-3 ${text} ${m.role === 'child' ? `${bubbleChild} rounded-br-md ${m.pending ? 'opacity-70' : ''} ${m.failed ? 'ring-2 ring-[#E58A9E]' : ''}` : `${bubbleMallow} rounded-bl-md`}`} data-role={m.role}>
                {m.text}
                {m.role === 'mallow' && child.voice_enabled && (
                  <button onClick={() => v.replay(m)} aria-label="Hear this again" title="Hear this again" className="tap ml-2 inline-grid h-7 w-7 place-items-center rounded-full bg-lav-soft align-middle text-sm text-lav-deep">▶</button>
                )}
              </div>
            </div>
          ))}
          {v.state === 'listening' && v.liveText && <div className="flex justify-end"><div className={`max-w-[85%] rounded-3xl rounded-br-md px-4 py-3 italic opacity-70 ${bubbleChild} ${text}`}>{v.liveText}…</div></div>}
          {(v.state === 'thinking') && <div className="flex gap-1 pl-3" aria-label="Mallow is thinking">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 animate-bounce rounded-full bg-lav-deep/60" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>}
          <div ref={endRef} />
        </div>

        {v.helpline && <div role="note" className="rounded-3xl bg-blush px-4 py-3 text-sm font-semibold text-rose-deep">💛 {v.helpline}</div>}
        {v.offline && <div className="rounded-2xl bg-butter-soft px-4 py-2 text-xs font-semibold text-[#8a6f1c]" data-testid="offline-note">Mallow is in simple offline mode. A grown-up can connect a full AI model in Settings.</div>}
        {v.notice && <div className="rounded-2xl bg-lav-soft px-4 py-2 text-sm text-ink-soft" role="status">{v.notice}</div>}
        {v.limitReached && <div role="alert" className="rounded-3xl bg-peach-soft px-4 py-3 text-center font-bold text-peach-deep">All of today's talking time is used. Let's take a little break. 🌙</div>}
        {v.error && (
          <div role="alert" data-testid="voice-error" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-[#FFE9ED] px-4 py-3 text-sm font-semibold text-[#A8445D]">
            <span>{v.error}</span>
            <span className="flex gap-2">{v.canRetry && <Button size="sm" tone="rose" variant="soft" onClick={v.retry} data-testid="retry">Try again</Button>}<Button size="sm" variant="ghost" onClick={v.dismissError}>Dismiss</Button></span>
          </div>
        )}

        {starters.length > 0 && msgs.length === 0 && !v.limitReached && (
          <div className="flex flex-wrap gap-2" aria-label="Ideas">
            {starters.map((s) => <button key={s.label} disabled={disabledInput || v.state !== 'ready'} onClick={() => {
              if (s.mode && s.mode !== mode) { v.cancel(); setMode(s.mode); setDraft(s.text) }
              else if (v.send(s.text)) setDraft('')
            }} className={`tap rounded-full border border-line bg-white px-4 py-2 font-bold shadow-soft hover:bg-lav-soft disabled:opacity-50 ${big ? 'text-lg' : 'text-sm'}`}>{s.label}</button>)}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="flex gap-2">
          <label className="sr-only" htmlFor="chat-input">Message Mallow</label>
          <input id="chat-input" data-testid="chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={600} disabled={disabledInput} placeholder={placeholder} autoComplete="off"
            className={`min-w-0 flex-1 rounded-full border border-line bg-white px-5 shadow-soft placeholder:text-ink-faint focus:border-lav-deep focus:outline-none focus:ring-2 focus:ring-lav ${big ? 'py-4 text-lg' : 'py-3 text-[15px]'}`} />
          <Button type="submit" size={big ? 'lg' : 'md'} disabled={!draft.trim() || disabledInput || v.state !== 'ready'} data-testid="send">Send</Button>
        </form>
      </div>
    </section>
  )
}
