// Minimal Web Speech API typings (the DOM lib does not ship SpeechRecognition).
interface SpeechRecognitionAlternative { transcript: string; confidence: number }
interface SpeechRecognitionResult { length: number; [i: number]: SpeechRecognitionAlternative; isFinal: boolean }
interface SpeechRecognitionResultList { length: number; [i: number]: SpeechRecognitionResult }
interface SpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList }
interface SpeechRecognition extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onerror: ((ev: Event) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}
