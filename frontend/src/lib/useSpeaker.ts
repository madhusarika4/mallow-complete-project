import { useCallback, useEffect, useRef, useState } from 'react'
import { apiBlob } from './api'
import type { Child, Language } from './types'

type SayArgs = { text: string; mood: string; mode: string }

/** Read any (safety-checked) text aloud with the child's saved voice. Falls back to the device voice, never to a different language. */
export function useSpeaker(child: Child, language: Language = child.preferred_language) {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLast, setHasLast] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const req = useRef(0)
  const last = useRef<SayArgs | null>(null)
  const cache = useRef(new Map<string, Blob>())

  const halt = useCallback(() => {
    ctl.current?.abort()
    ctl.current = null
    const el = audio.current
    audio.current = null
    el?.pause()
    window.speechSynthesis?.cancel()
  }, [])

  const stop = useCallback(() => {
    req.current += 1
    halt()
    setSpeaking(false)
    setPaused(false)
    setLoading(false)
  }, [halt])

  useEffect(() => stop, [stop])

  const say = useCallback(async (text: string, mood = 'neutral', mode = 'chat') => {
    if (!child.voice_enabled) { setError('Voice is turned off by a grown-up.'); return false }
    req.current += 1
    const id = req.current
    halt()
    last.current = { text, mood, mode }
    setHasLast(true)
    setError(null); setLoading(true); setPaused(false)
    const c = new AbortController(); ctl.current = c
    const key = `${language}|${mood}|${text}`
    try {
      let blob = cache.current.get(key)
      if (!blob) {
        blob = (await apiBlob('/voice/speak', { child_id: child.id, text, language, mood, emotion: 'neutral', mode }, c.signal)).blob
        cache.current.set(key, blob)
      }
      if (id !== req.current) return false
      const url = URL.createObjectURL(blob)
      const el = new Audio(url); audio.current = el
      setLoading(false); setSpeaking(true)
      const played = await new Promise<boolean>((res, rej) => {
        let settled = false
        const done = (ok: boolean) => { if (settled) return; settled = true; URL.revokeObjectURL(url); res(ok) }
        el.onended = () => done(true)
        el.onerror = () => { if (settled) return; settled = true; URL.revokeObjectURL(url); rej(new Error('audio')) }
        c.signal.addEventListener('abort', () => done(false), { once: true })
        el.play().catch(rej)
      })
      return played
    } catch (e) {
      if (id !== req.current || (e as Error).name === 'AbortError') return false
      const synth = window.speechSynthesis
      const want = { English: 'en', Telugu: 'te', Hinglish: 'hi' }[language]
      const voice = synth?.getVoices().find((v) => v.lang.toLowerCase().startsWith(want))
      if (synth && (voice || language === 'English')) {
        setLoading(false); setSpeaking(true)
        return await new Promise<boolean>((res) => {
          let settled = false
          const done = (ok: boolean) => { if (settled) return; settled = true; res(ok) }
          const u = new SpeechSynthesisUtterance(text)
          if (voice) u.voice = voice
          u.lang = voice?.lang ?? 'en-IN'
          u.rate = 0.9
          u.onend = () => done(true)
          u.onerror = () => done(false)
          c.signal.addEventListener('abort', () => { synth.cancel(); done(false) }, { once: true })
          synth.speak(u)
        })
      }
      setError("I couldn't read this aloud right now, but you can read it yourself.")
      return false
    } finally {
      if (id === req.current) {
        setLoading(false)
        setSpeaking(false)
        setPaused(false)
      }
    }
  }, [child, language, halt])

  const pause = useCallback(() => {
    if (audio.current) audio.current.pause()
    else window.speechSynthesis?.pause()
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
    if (audio.current) void audio.current.play().catch(() => undefined)
    else window.speechSynthesis?.resume()
    setPaused(false)
  }, [])

  const replay = useCallback(() => {
    const args = last.current
    if (!args) return Promise.resolve(false)
    return say(args.text, args.mood, args.mode)
  }, [say])

  return {
    say, stop, pause, resume, replay,
    speaking, paused, loading, hasLast, error, clearError: () => setError(null),
  }
}
