import { useEffect } from 'react'
import { useSpeaker } from '../lib/useSpeaker'
import { Button } from '../ui'
import type { Child, Language } from '../lib/types'

interface Props {
  child: Child
  text: string
  language?: Language
  mood?: string
  mode?: string
  label?: string
  compact?: boolean
}

/** Small "read this to me" control for activities. Never speaks on its own. */
export default function ReadAloud({ child, text, language = child.preferred_language, mood = 'calm', mode = 'story', label = 'Read to me', compact = false }: Props) {
  const speaker = useSpeaker(child, language)
  const size = compact ? 'sm' : 'md'
  if (!child.voice_enabled) return <span className="text-xs font-semibold text-ink-faint">Voice is off. A grown-up can turn it on.</span>
  return (
    <div className="flex flex-wrap items-center gap-2">
      {speaker.speaking ? (
        <>
          <Button size={size} variant="soft" tone="lav" onClick={speaker.paused ? speaker.resume : speaker.pause}>
            {speaker.paused ? '▶ Resume' : '❚❚ Pause'}
          </Button>
          <Button size={size} variant="soft" tone="butter" onClick={() => void speaker.replay()}>↻ Replay</Button>
          <Button size={size} variant="soft" tone="peach" onClick={speaker.stop}>■ Stop</Button>
        </>
      ) : (
        <Button size={size} variant="soft" tone="lav" loading={speaker.loading} onClick={() => void speaker.say(text, mood, mode)}>
          🔊 {label}
        </Button>
      )}
      {speaker.error && <span role="status" className="text-xs font-semibold text-[#7a6418]">{speaker.error}</span>}
    </div>
  )
}

/** Compact speaker control used on activity cards. Stops if tapped again. */
export function SpeakButton({ child, text, mood = 'calm', mode = 'chat', label = 'Hear this activity' }: { child: Child; text: string; mood?: string; mode?: string; label?: string }) {
  const speaker = useSpeaker(child)
  if (!child.voice_enabled) return null
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (speaker.speaking) speaker.stop(); else void speaker.say(text, mood, mode) }}
      aria-label={speaker.speaking ? 'Stop reading' : label}
      title={speaker.speaking ? 'Stop reading' : label}
      className="tap grid h-10 w-10 place-items-center rounded-full bg-white/90 text-lg shadow-inset hover:bg-white"
    >
      {speaker.loading ? '…' : speaker.speaking ? '■' : '🔊'}
    </button>
  )
}

/** Speaks short feedback after an answer. Uses the same shared speaker pipeline. */
export function SpokenFeedback({ child, text, mood = 'happy', mode = 'chat' }: { child: Child; text: string; mood?: string; mode?: string }) {
  const speaker = useSpeaker(child)
  useEffect(() => {
    if (!text || !child.voice_enabled) return
    void speaker.say(text, mood, mode)
    return speaker.stop
  }, [text, mood, mode, child.voice_enabled]) // eslint-disable-line react-hooks/exhaustive-deps
  return <span className="sr-only" role="status">{text}</span>
}
