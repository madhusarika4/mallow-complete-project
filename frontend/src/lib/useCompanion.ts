import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, apiBlob, ApiError } from './api'
import type { CompanionAudience, CompanionMessage, Language } from './types'

export type CompanionState = 'ready' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'error'

const SR_LANG: Record<Language, string> = { English: 'en-IN', Telugu: 'te-IN', Hinglish: 'hi-IN' }
const SYNTH_LANG: Record<Language, string> = { English: 'en', Telugu: 'te', Hinglish: 'hi' }
type SRConstructor = new () => SpeechRecognition
const getSR = (): SRConstructor | null => {
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2))

interface Opts {
  audience: CompanionAudience
  childId?: number | null
  language: Language
  voiceAvailable: boolean
  sttAvailable: boolean
}

interface TurnResponse {
  reply: string
  message_id: number | null
  urgent: boolean
  unsafe: boolean
  provider_error: boolean
  offline: boolean
  duplicate: boolean
}

/** Voice + text conversation with the adult (parent / infant-care) companion. */
export function useCompanion({ audience, childId, language, voiceAvailable, sttAvailable }: Opts) {
  const [messages, setMessages] = useState<CompanionMessage[]>([])
  const [state, setState] = useState<CompanionState>('ready')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [liveText, setLiveText] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [speakerOn, setSpeakerOn] = useState(voiceAvailable)

  const busy = useRef(false)
  const failed = useRef<{ kind: 'text'; text: string } | { kind: 'audio'; blob: Blob } | null>(null)
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

  const SR = useMemo(getSR, [])
  const micSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
  const inputPath: 'server' | 'browser' | 'none' = sttAvailable && micSupported ? 'server' : SR ? 'browser' : 'none'
  const voiceReason = inputPath === 'none' ? 'Voice input needs a configured speech-to-text service or Chrome/Edge. You can still type.' : null

  useEffect(() => { alive.current = true; return () => { alive.current = false; hardStop() } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const historyPath = useCallback(() => {
    const q = new URLSearchParams({ audience, limit: '40' })
    if (childId != null) q.set('child_id', String(childId))
    return `/companion/messages?${q}`
  }, [audience, childId])

  useEffect(() => {
    let cancelled = false
    setLoading(true); setMessages([]); setError(null); setState('ready')
    api<CompanionMessage[]>(historyPath())
      .then((rows) => { if (!cancelled) setMessages(rows.map((r) => ({ ...r, role: r.role }))) })
      .catch((e) => { if (!cancelled) setError((e as Error).message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [historyPath])

  const hardStop = () => {
    abort.current?.abort()
    try { recog.current?.abort() } catch { /* */ }
    try { if (recorder.current && recorder.current.state !== 'inactive') { recorder.current.onstop = null; recorder.current.stop() } } catch { /* */ }
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null
    if (timer.current) window.clearInterval(timer.current)
    audio.current?.pause(); audio.current = null
    window.speechSynthesis?.cancel()
  }

  const fail = (msg: string) => { if (!alive.current) return; busy.current = false; setError(msg); setState('error') }

  const playBlob = useCallback(async (blob: Blob): Promise<void> => {
    const url = URL.createObjectURL(blob)
    const el = new Audio(url); audio.current = el
    await new Promise<void>((resolve, reject) => {
      el.onended = () => resolve(); el.onerror = () => reject(new Error('audio-error'))
      el.play().catch(reject)
    }).finally(() => { URL.revokeObjectURL(url); if (audio.current === el) audio.current = null })
  }, [])

  const browserSpeak = useCallback((text: string): Promise<boolean> => new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) return resolve(false)
    const want = SYNTH_LANG[language]
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(want))
    if (!voice && language !== 'English') return resolve(false)
    const u = new SpeechSynthesisUtterance(text)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'en-IN'; u.rate = 0.95; u.pitch = 1
    u.onend = () => resolve(true); u.onerror = () => resolve(false)
    synth.cancel(); synth.speak(u)
  }), [language])

  const speak = useCallback(async (text: string, key: string | number, force = false) => {
    if (!speakerOn && !force) { setState('ready'); busy.current = false; return }
    setState('speaking'); setNotice(null)
    const ctl = new AbortController(); abort.current = ctl
    try {
      let blob = cache.current.get(key)
      if (!blob) {
        const r = await apiBlob('/companion/speak', { text, language, mood: audience === 'infant' ? 'comfort' : 'neutral' }, ctl.signal)
        blob = r.blob; cache.current.set(key, blob)
        if (r.notice) setNotice(r.notice)
      }
      await playBlob(blob)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      if (e instanceof DOMException && e.name === 'NotAllowedError') setNotice('Tap the speaker button to hear Mallow. Your browser waited for a tap first.')
      else {
        const ok = await browserSpeak(text)
        setNotice(ok ? 'Mallow used your device voice this time.' : "I couldn't speak just now, so you can read my words instead.")
      }
    } finally { if (alive.current) { busy.current = false; setState((s) => (s === 'speaking' ? 'ready' : s)) } }
  }, [speakerOn, language, audience, playBlob, browserSpeak])

  const stopSpeaking = useCallback(() => { abort.current?.abort(); audio.current?.pause(); audio.current = null; window.speechSynthesis?.cancel(); busy.current = false; setState('ready') }, [])
  const replay = useCallback((m: CompanionMessage) => { if (busy.current && state !== 'speaking') return; stopSpeaking(); busy.current = true; void speak(m.text, m.id, true) }, [speak, state, stopSpeaking])

  const runTurn = useCallback(async (text: string) => {
    const turnId = uid(); const localId = `local-${turnId}`
    setMessages((m) => [...m, { id: localId, role: 'user', text, pending: true }])
    setState('thinking'); setError(null); setNotice(null)
    const body: Record<string, unknown> = { text, language, client_turn_id: turnId }
    const path = audience === 'infant' ? `/infant/${childId}/companion` : '/companion/parent'
    if (audience === 'parent' && childId != null) body.child_id = childId
    try {
      const r = await api<TurnResponse>(path, { body })
      if (!alive.current) return
      failed.current = null
      setMessages((m) => [...m.map((x) => (x.id === localId ? { ...x, pending: false } : x)), { id: r.message_id ?? `m-${turnId}`, role: 'assistant', text: r.reply, urgent: r.urgent }])
      if (r.provider_error) setNotice('My full AI connection had a hiccup, so this is a simpler reply.')
      void speak(r.reply, r.message_id ?? `m-${turnId}`)
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === localId ? { ...x, pending: false, failed: true } : x)))
      failed.current = { kind: 'text', text }
      fail((e as Error).message)
    }
  }, [audience, childId, language, speak])

  const send = useCallback((raw: string) => {
    if (state === 'speaking') stopSpeaking()
    const text = raw.trim()
    if (!text || busy.current) return false
    if (text.length > 1200) { setError('That message is a little long. Please shorten it.'); setState('error'); return false }
    busy.current = true; void runTurn(text); return true
  }, [runTurn, state, stopSpeaking])

  const transcribe = useCallback(async (blob: Blob) => {
    setState('processing'); setLiveText('')
    const form = new FormData(); form.append('language', language)
    form.append('audio', blob, blob.type.includes('mp4') ? 'speech.m4a' : 'speech.webm')
    try {
      const r = await api<{ text: string }>('/companion/transcribe', { form })
      if (!alive.current) return
      failed.current = null; setLiveText(r.text)
      busy.current = true; void runTurn(r.text)
    } catch (e) {
      failed.current = { kind: 'audio', blob }
      const err = e as ApiError
      fail(err.code === 'no_audio' || err.code === 'no_speech' ? "I couldn't hear any words. Try again, or type instead." : err.code === 'stt_unavailable' ? 'Voice listening is not set up. You can type instead.' : `I couldn't understand that recording. ${err.message}`)
    }
  }, [language, runTurn])

  const finishTick = () => { if (timer.current) window.clearInterval(timer.current); timer.current = null }

  const startListening = useCallback(async () => {
    if (state === 'speaking') stopSpeaking()
    if (busy.current || state === 'listening' || inputPath === 'none') return
    busy.current = true; setError(null); setNotice(null); setLiveText(''); setSeconds(0)
    if (inputPath === 'browser' && SR) {
      const r = new SR(); recog.current = r; recogText.current = ''
      r.lang = SR_LANG[language]; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1
      r.onresult = (ev) => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; recogText.current = t; setLiveText(t) }
      r.onerror = (ev) => {
        finishTick(); const code = (ev as unknown as { error: string }).error
        if (code === 'no-speech') fail("I couldn't hear any words. Try again, or type instead.")
        else if (code === 'not-allowed' || code === 'service-not-allowed') fail('Mallow cannot use the microphone. Allow it in your browser, or type instead.')
        else if (code !== 'aborted') fail(`Listening stopped (${code}). You can try again or type.`)
      }
      r.onend = () => {
        finishTick(); if (!alive.current) return
        const t = recogText.current.trim()
        setState((s) => {
          if (s !== 'listening') return s
          if (t) { busy.current = true; void runTurn(t); return 'thinking' }
          fail("I couldn't hear any words. Try again, or type instead."); return 'error'
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
      rec.onstop = () => { finishTick(); s.getTracks().forEach((t) => t.stop()); stream.current = null; const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }); if (alive.current) void transcribe(blob) }
      rec.start(); setState('listening'); timer.current = window.setInterval(() => setSeconds((x) => { if (x >= 60) stopListening(); return x + 1 }), 1000)
    } catch (e) {
      const name = (e as DOMException).name
      fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'Mallow cannot use the microphone. Allow it in your browser settings, or type instead.' : name === 'NotFoundError' ? 'No microphone was found. You can type instead.' : 'The microphone did not start. You can try again or type.')
    }
  }, [state, inputPath, SR, language, runTurn, transcribe, stopSpeaking]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopListening = useCallback(() => {
    if (inputPath === 'browser') { try { recog.current?.stop() } catch { /* */ } return }
    if (recorder.current && recorder.current.state === 'recording') recorder.current.stop()
  }, [inputPath])

  const cancel = useCallback(() => { hardStop(); busy.current = false; failed.current = null; setError(null); setLiveText(''); setState('ready') }, [])

  const retry = useCallback(() => {
    const f = failed.current
    setError(null); setState('ready'); busy.current = false
    if (!f) return
    if (f.kind === 'audio') { busy.current = true; void transcribe(f.blob) }
    else { setMessages((m) => m.filter((x) => !x.failed)); busy.current = true; void runTurn(f.text) }
  }, [transcribe, runTurn])

  const dismissError = useCallback(() => { setError(null); setState('ready'); failed.current = null; busy.current = false }, [])

  return {
    messages, state, error, notice, liveText, seconds, loading, speakerOn, setSpeakerOn,
    send, startListening, stopListening, cancel, stopSpeaking, replay, retry, dismissError,
    inputPath, voiceReason, canRetry: !!failed.current,
  }
}
