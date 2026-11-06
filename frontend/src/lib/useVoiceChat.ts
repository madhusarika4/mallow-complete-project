import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, apiBlob, ApiError } from './api'
import type { Bootstrap, Child, ChatMessage, Language, Mode, TurnResult } from './types'

export type VoiceState = 'ready' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'error'

const SR_LANG: Record<Language, string> = { English: 'en-IN', Telugu: 'te-IN', Hinglish: 'hi-IN' }
const SYNTH_LANG: Record<Language, string> = { English: 'en', Telugu: 'te', Hinglish: 'hi' }
type SRConstructor = new () => SpeechRecognition
const getSR = (): SRConstructor | null => {
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2))

export const GREETINGS: Record<Language, string> = {
  English: "Hi, I'm Mallow, an AI helper. We can chat, hear a story, or learn something new. Grown-ups can see summaries of our chats, and I can't keep secrets from them.",
  Telugu: 'హాయ్! నేను మల్లో, ఒక AI సహాయకుడిని. మనం మాట్లాడుకోవచ్చు, కథ వినవచ్చు. మన సంభాషణ సారాంశాన్ని పెద్దవారు చూడగలరు.',
  Hinglish: 'Hi! Main Mallow hoon, ek AI helper. Hum baat kar sakte hain, kahani sun sakte hain ya kuch naya seekh sakte hain. Grown-ups humari chat ka summary dekh sakte hain.',
}

interface Opts { child: Child; language: Language; mode: Mode; boot: Bootstrap | null; context?: string }

export function useVoiceChat({ child, language, mode, boot, context = '' }: Opts) {
  const educationalMode = mode === 'study' || mode === 'homework' || mode === 'explain'
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [state, setState] = useState<VoiceState>('ready')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [liveText, setLiveText] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [limitReached, setLimitReached] = useState(!educationalMode && child.limit_reached)
  const [helpline, setHelpline] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(child.voice_enabled)
  const [loading, setLoading] = useState(true)
  const [emotion, setEmotion] = useState('neutral')
  const [conversationOn, setConversationOn] = useState(false)

  const busy = useRef(false)
  const conversation = useRef(false)
  const stateRef = useRef<VoiceState>('ready')
  const limitRef = useRef(!educationalMode && child.limit_reached)
  const listenRef = useRef<() => void>(() => undefined)
  const autoTimer = useRef<number | null>(null)
  const vad = useRef<{ ctx: AudioContext; frame: number } | null>(null)
  const failed = useRef<{ kind: 'text'; text: string; source: 'text' | 'voice' } | { kind: 'audio'; blob: Blob } | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const recog = useRef<SpeechRecognition | null>(null)
  const recogText = useRef('')
  const timer = useRef<number | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const cache = useRef(new Map<string | number, Blob>())
  const abort = useRef<AbortController | null>(null)
  const alive = useRef(true)

  const sttServer = !!boot?.services.stt
  const SR = useMemo(getSR, [])
  const micSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
  const inputPath: 'server' | 'browser' | 'none' = !child.voice_enabled ? 'none' : sttServer && micSupported ? 'server' : SR ? 'browser' : 'none'
  const voiceReason = !child.voice_enabled ? 'Voice is turned off by a grown-up. You can still type.'
    : inputPath === 'none' ? (sttServer ? 'This browser cannot record audio. Please type instead.' : 'Voice input needs Chrome or Edge (or a speech-to-text key in .env). You can still type.') : null

  useEffect(() => { alive.current = true; return () => { alive.current = false; hardStop() } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { limitRef.current = limitReached }, [limitReached])

  const clearAuto = useCallback(() => {
    if (autoTimer.current) window.clearTimeout(autoTimer.current)
    autoTimer.current = null
  }, [])

  const stopVad = useCallback(() => {
    const current = vad.current
    vad.current = null
    if (current) {
      window.cancelAnimationFrame(current.frame)
      void current.ctx.close().catch(() => undefined)
    }
  }, [])

  const scheduleNextListen = useCallback(() => {
    if (!conversation.current || !alive.current || limitRef.current) return
    clearAuto()
    autoTimer.current = window.setTimeout(() => {
      if (conversation.current && alive.current && stateRef.current === 'ready') listenRef.current()
    }, 450)
  }, [clearAuto])

  // load / open today's session for this child + mode
  useEffect(() => {
    let cancelled = false
    setLoading(true); setMessages([]); setSessionId(null); setError(null); setState('ready'); setHelpline(null)
    if (educationalMode) { limitRef.current = false; setLimitReached(false) }
    api<{ session_id: number; limit_reached: boolean; messages: ChatMessage[] }>('/chat/session', { body: { child_id: child.id, language, mode } })
      .then((r) => { if (cancelled) return; setSessionId(r.session_id); setLimitReached(r.limit_reached); setMessages(r.messages) })
      .catch((e) => { if (!cancelled) { setError((e as Error).message); setState('error') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [child.id, language, mode, educationalMode])

  const hardStop = () => {
    abort.current?.abort()
    clearAuto()
    stopVad()
    try { recog.current?.abort() } catch { /* */ }
    try { if (recorder.current && recorder.current.state !== 'inactive') { recorder.current.onstop = null; recorder.current.stop() } } catch { /* */ }
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null
    if (timer.current) window.clearInterval(timer.current)
    audio.current?.pause(); audio.current = null
    window.speechSynthesis?.cancel()
  }

  const fail = (msg: string) => {
    if (!alive.current) return
    conversation.current = false
    setConversationOn(false)
    clearAuto()
    busy.current = false
    setError(msg)
    setState('error')
  }

  // ------------------------------------------------------------ speaking
  const playBlob = useCallback(async (blob: Blob): Promise<void> => {
    const url = URL.createObjectURL(blob)
    const el = new Audio(url); audio.current = el
    await new Promise<void>((resolve, reject) => {
      el.onended = () => resolve(); el.onerror = () => reject(new Error('audio-error'))
      el.play().catch((e) => reject(e))
    }).finally(() => { URL.revokeObjectURL(url); if (audio.current === el) audio.current = null })
  }, [])

  const browserSpeak = useCallback((text: string): Promise<boolean> => new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) return resolve(false)
    const want = SYNTH_LANG[language]
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(want))
    if (!voice && language !== 'English') return resolve(false) // never silently switch language
    const u = new SpeechSynthesisUtterance(text)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'en-IN'; u.rate = 0.92; u.pitch = 1
    u.onend = () => resolve(true); u.onerror = () => resolve(false)
    synth.cancel(); synth.speak(u)
  }), [language])

  const speak = useCallback(async (text: string, key: string | number, moodHint: string, force = false) => {
    if (!speakerOn && !force) { setState('ready'); busy.current = false; scheduleNextListen(); return }
    setState('speaking'); setNotice(null)
    const ctl = new AbortController(); abort.current = ctl
    try {
      let blob = cache.current.get(key)
      if (!blob) {
        const r = await apiBlob('/voice/speak', { child_id: child.id, text, language, emotion: moodHint, mode }, ctl.signal)
        blob = r.blob; cache.current.set(key, blob)
        if (r.notice) setNotice(r.notice)
      }
      await playBlob(blob)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      if (e instanceof DOMException && e.name === 'NotAllowedError') setNotice('Tap the speaker button to hear Mallow. Your browser waited for a tap first.')
      else {
        const ok = await browserSpeak(text)
        setNotice(ok ? 'Mallow used your device voice this time.' : e instanceof ApiError && e.code === 'voice_off' ? e.message : "I couldn't speak just now, so you can read my words instead.")
      }
    } finally {
      if (alive.current) {
        busy.current = false
        setState((s) => (s === 'speaking' ? 'ready' : s))
        scheduleNextListen()
      }
    }
  }, [speakerOn, child.id, language, mode, playBlob, browserSpeak, scheduleNextListen])

  const stopSpeaking = useCallback(() => { abort.current?.abort(); audio.current?.pause(); audio.current = null; window.speechSynthesis?.cancel(); busy.current = false; setState('ready') }, [])
  const replay = useCallback((m: ChatMessage) => { if (busy.current && state !== 'speaking') return; stopSpeaking(); busy.current = true; void speak(m.text, m.id, m.emotion || 'neutral', true) }, [speak, state, stopSpeaking])

  // ------------------------------------------------------------ turn
  const runTurn = useCallback(async (text: string, source: 'text' | 'voice') => {
    if (sessionId == null) return fail('Mallow is still getting ready. Try again in a moment.')
    const turnId = uid(); const localId = `local-${turnId}`
    setMessages((m) => [...m, { id: localId, role: 'child', text, pending: true }])
    setState('thinking'); setError(null); setNotice(null); setHelpline(null)
    try {
      const r = await api<TurnResult>('/chat/turn', { body: { child_id: child.id, session_id: sessionId, text, language, mode, source, client_turn_id: turnId, context } })
      if (!alive.current) return
      failed.current = null
      setMessages((m) => [...m.map((x) => (x.id === localId ? { ...x, pending: false } : x)), { id: r.message_id ?? `m-${turnId}`, role: 'mallow', text: r.reply, emotion: r.mood }])
      setOffline(r.offline); setEmotion(r.emotion); if (r.limit_reached) setLimitReached(true); if (r.helpline) setHelpline(r.helpline)
      if (r.provider_error) setNotice('My thinking helper had a hiccup, so this answer is simple.')
      void speak(r.reply, r.message_id ?? `m-${turnId}`, r.mood)
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === localId ? { ...x, pending: false, failed: true } : x)))
      failed.current = { kind: 'text', text, source }
      fail((e as Error).message)
    }
  }, [sessionId, child.id, language, mode, speak, context])

  const send = useCallback((raw: string, source: 'text' | 'voice' = 'text') => {
    const text = raw.trim()
    if (!text || busy.current || limitReached) return false
    if (text.length > 600) { setError('That message is a bit long. Please make it shorter.'); setState('error'); return false }
    busy.current = true; void runTurn(text, source); return true
  }, [runTurn, limitReached])

  // ------------------------------------------------------------ listening
  const transcribe = useCallback(async (blob: Blob) => {
    setState('processing'); setLiveText('')
    const form = new FormData(); form.append('child_id', String(child.id)); form.append('language', language)
    form.append('audio', blob, blob.type.includes('mp4') ? 'speech.m4a' : 'speech.webm')
    try {
      const r = await api<{ text: string }>('/voice/transcribe', { form })
      if (!alive.current) return
      failed.current = null; setLiveText(r.text)
      busy.current = true; void runTurn(r.text, 'voice')
    } catch (e) {
      const err = e as ApiError
      const silent = err.code === 'no_audio' || err.code === 'no_speech'
      if (silent && conversation.current) {
        setLiveText(''); busy.current = false; setState('ready'); scheduleNextListen(); return
      }
      failed.current = { kind: 'audio', blob }
      fail(silent ? "I couldn't hear any words. Try again, or type instead." : err.code === 'stt_unavailable' ? 'Voice listening is not set up yet. You can type instead.' : `I couldn't understand that recording. ${err.message}`)
    }
  }, [child.id, language, runTurn, scheduleNextListen])

  const finishTick = () => { if (timer.current) window.clearInterval(timer.current); timer.current = null }

  const startVad = (media: MediaStream) => {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return
    try {
      const ctx = new AudioCtor()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      ctx.createMediaStreamSource(media).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      const started = performance.now()
      let heard = false
      let lastVoice = started
      const monitor = () => {
        if (!alive.current || recorder.current?.state !== 'recording') return
        analyser.getByteTimeDomainData(data)
        let energy = 0
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; energy += v * v }
        const rms = Math.sqrt(energy / data.length)
        const now = performance.now()
        if (rms > 0.035) { heard = true; lastVoice = now }
        if (heard && now - lastVoice > 1200 && now - started > 700) {
          try { recorder.current?.stop() } catch { /* */ }
          return
        }
        const frame = window.requestAnimationFrame(monitor)
        if (vad.current) vad.current.frame = frame
      }
      vad.current = { ctx, frame: window.requestAnimationFrame(monitor) }
    } catch { /* VAD is optional; the 45s limit still applies. */ }
  }

  const startListening = useCallback(async () => {
    if (stateRef.current === 'speaking') stopSpeaking() // barge-in
    if (busy.current || stateRef.current === 'listening' || limitRef.current || inputPath === 'none') return
    busy.current = true; setError(null); setNotice(null); setLiveText(''); setSeconds(0)
    if (inputPath === 'browser' && SR) {
      const r = new SR(); recog.current = r; recogText.current = ''
      r.lang = SR_LANG[language]; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1
      r.onresult = (ev) => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; recogText.current = t; setLiveText(t) }
      r.onerror = (ev) => {
        finishTick()
        const code = (ev as unknown as { error: string }).error
        if (code === 'no-speech' && conversation.current) return
        if (code === 'no-speech') fail("I couldn't hear any words. Try again, or type instead.")
        else if (code === 'not-allowed' || code === 'service-not-allowed') fail('Mallow cannot use the microphone. Allow it in your browser, or type instead.')
        else if (code !== 'aborted') fail(`Listening stopped (${code}). You can try again or type.`)
      }
      r.onend = () => {
        finishTick(); if (!alive.current) return
        const t = recogText.current.trim()
        setState((s) => {
          if (s !== 'listening') return s
          if (t) { busy.current = true; void runTurn(t, 'voice'); return 'thinking' }
          if (conversation.current) { busy.current = false; scheduleNextListen(); return 'ready' }
          fail("I couldn't hear any words. Try again, or type instead.")
          return 'error'
        })
      }
      try { r.start(); setState('listening'); timer.current = window.setInterval(() => setSeconds((x) => x + 1), 1000) } catch { fail('Could not start listening. Please try again.') }
      return
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      stream.current = s; chunks.current = []
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m))
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined); recorder.current = rec
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      rec.onstop = () => { finishTick(); stopVad(); s.getTracks().forEach((t) => t.stop()); stream.current = null; const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }); if (alive.current) void transcribe(blob) }
      rec.start(); setState('listening'); startVad(s); timer.current = window.setInterval(() => setSeconds((x) => { if (x >= 45) { stopListening(); } return x + 1 }), 1000)
    } catch (e) {
      const name = (e as DOMException).name
      fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'Mallow cannot use the microphone. Allow it in your browser settings, or type instead.' : name === 'NotFoundError' ? 'No microphone was found. You can type instead.' : 'The microphone did not start. You can try again or type.')
    }
  }, [inputPath, SR, language, runTurn, transcribe, stopSpeaking, scheduleNextListen, stopVad]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listenRef.current = () => { void startListening() } }, [startListening])

  const stopListening = useCallback(() => {
    if (inputPath === 'browser') { try { recog.current?.stop() } catch { /* */ } return }
    if (recorder.current && recorder.current.state === 'recording') recorder.current.stop()
  }, [inputPath])

  const startConversation = useCallback(() => {
    if (inputPath === 'none' || limitRef.current) return
    conversation.current = true
    setConversationOn(true)
    setError(null)
    clearAuto()
    listenRef.current()
  }, [inputPath, clearAuto])

  const stopConversation = useCallback(() => {
    conversation.current = false
    setConversationOn(false)
    clearAuto()
    hardStop()
    busy.current = false
    failed.current = null
    setLiveText('')
    setState('ready')
  }, [clearAuto]) // eslint-disable-line react-hooks/exhaustive-deps

  const interrupt = useCallback(() => {
    if (!conversation.current) return
    clearAuto()
    stopSpeaking()
    window.setTimeout(() => { if (conversation.current && alive.current) listenRef.current() }, 120)
  }, [clearAuto, stopSpeaking])

  const cancel = useCallback(() => {
    conversation.current = false
    setConversationOn(false)
    clearAuto()
    hardStop(); busy.current = false; failed.current = null; setError(null); setLiveText(''); setState('ready')
  }, [clearAuto]) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => {
    const f = failed.current
    setError(null); setState('ready'); busy.current = false
    if (!f) return
    if (f.kind === 'audio') { busy.current = true; void transcribe(f.blob) }
    else { setMessages((m) => m.filter((x) => !x.failed)); busy.current = true; void runTurn(f.text, f.source) }
  }, [transcribe, runTurn])

  const dismissError = useCallback(() => { setError(null); setState('ready'); failed.current = null; busy.current = false }, [])

  return { messages, state, error, notice, liveText, seconds, limitReached, helpline, offline, emotion, speakerOn, setSpeakerOn, loading, send, startListening, stopListening, startConversation, stopConversation, interrupt, conversationOn, cancel, stopSpeaking, replay, retry, dismissError, inputPath, voiceReason, canRetry: !!failed.current }
}
