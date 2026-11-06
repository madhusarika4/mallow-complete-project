import { Link } from 'react-router-dom'
export default function SwitchChild({ className = '' }: { className?: string }) {
  return <Link to="/" className={`tap inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-2 text-sm font-bold text-ink-soft shadow-inset hover:bg-white ${className}`} data-testid="switch-child">↩ Switch</Link>
}
