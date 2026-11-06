// Small hand-drawn pastel decorations. Use sparingly and with intent.
import type { CSSProperties } from 'react'
interface D { size?: number; className?: string; style?: CSSProperties }
const s = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const Flower = ({ size = 40, className = '', style }: D) => (
  <svg viewBox="0 0 48 48" width={size} height={size} className={className} style={style} aria-hidden>
    {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="24" cy="12" rx="7" ry="10" fill="#FFD6DE" stroke="#D99AAA" strokeWidth="1.6" transform={`rotate(${a} 24 24)`} {...s} />)}
    <circle cx="24" cy="24" r="6" fill="#FFE9A0" stroke="#E0B94E" strokeWidth="1.5" />
  </svg>
)
export const Star = ({ size = 28, className = '', style }: D) => (
  <svg viewBox="0 0 40 40" width={size} height={size} className={className} style={style} aria-hidden>
    <path d="M20 4 l4.6 10.2 11 1.2 -8.2 7.5 2.3 10.9 L20 28 l-9.7 5.8 2.3 -10.9 -8.2 -7.5 11 -1.2z" fill="#FFF0B8" stroke="#E8C95A" strokeWidth="1.8" {...s} />
  </svg>
)
export const Sparkle = ({ size = 22, className = '', style }: D) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden>
    <path d="M12 2 c1 6 4 9 10 10 c-6 1 -9 4 -10 10 c-1 -6 -4 -9 -10 -10 c6 -1 9 -4 10 -10z" fill="#E4DAF5" stroke="#9D86C9" strokeWidth="1.4" {...s} />
  </svg>
)
export const Leaf = ({ size = 34, className = '', style }: D) => (
  <svg viewBox="0 0 40 40" width={size} height={size} className={className} style={style} aria-hidden>
    <path d="M6 34 C6 14 18 6 34 6 C34 24 24 34 6 34Z" fill="#CFEBDD" stroke="#6FB79A" strokeWidth="1.8" {...s} /><path d="M8 32 C16 24 22 18 30 10" fill="none" stroke="#6FB79A" strokeWidth="1.5" {...s} />
  </svg>
)
export const Heart = ({ size = 24, className = '', style }: D) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden>
    <path d="M12 21 C4 14 2 9 5 6 C8 3 11 5 12 8 C13 5 16 3 19 6 C22 9 20 14 12 21Z" fill="#FBC4CF" stroke="#D99AAA" strokeWidth="1.6" {...s} />
  </svg>
)
export const Cloud = ({ size = 64, className = '', style }: D) => (
  <svg viewBox="0 0 64 40" width={size} height={size * 0.62} className={className} style={style} aria-hidden>
    <path d="M14 34 C4 34 2 22 12 20 C12 8 30 6 34 16 C42 10 56 16 52 28 C60 28 60 36 52 36 L16 36Z" fill="#fff" stroke="#CDBDEB" strokeWidth="1.8" {...s} />
  </svg>
)
export const BookDoodle = ({ size = 40, className = '', style }: D) => (
  <svg viewBox="0 0 48 40" width={size} height={size * 0.83} className={className} style={style} aria-hidden>
    <path d="M4 8 Q14 4 24 9 Q34 4 44 8 L44 34 Q34 30 24 35 Q14 30 4 34Z" fill="#fff" stroke="#9D86C9" strokeWidth="1.8" {...s} /><path d="M24 9 V35" stroke="#9D86C9" strokeWidth="1.6" />
    <path d="M9 15 Q15 13 20 15 M9 21 Q15 19 20 21 M28 15 Q33 13 39 15" stroke="#E4DAF5" strokeWidth="2" fill="none" {...s} />
  </svg>
)
export const Squiggle = ({ width = 90, className = '', color = '#D99AAA' }: { width?: number; className?: string; color?: string }) => (
  <svg viewBox="0 0 90 10" width={width} height={width / 9} className={className} aria-hidden>
    <path d="M2 6 Q9 0 16 6 T30 6 T44 6 T58 6 T72 6 T88 6" fill="none" stroke={color} strokeWidth="2.4" {...s} />
  </svg>
)
/** A scatter of tiny doodles used as a soft backdrop on hero panels. */
export function Doodles({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <Flower size={34} className="absolute left-[6%] top-[14%] rotate-[-12deg] opacity-80" />
      <Star size={22} className="absolute right-[8%] top-[12%] animate-twinkle" />
      <Sparkle size={18} className="absolute left-[44%] top-[8%] animate-twinkle" style={{ animationDelay: '1s' }} />
      <Leaf size={30} className="absolute bottom-[10%] left-[3%] rotate-[10deg] opacity-80" />
      <Heart size={20} className="absolute bottom-[14%] right-[6%] opacity-80" />
      <Cloud size={56} className="absolute right-[24%] top-[6%] opacity-70" />
    </div>
  )
}
