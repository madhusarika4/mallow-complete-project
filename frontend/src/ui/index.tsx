import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'

type Tone = 'rose' | 'lav' | 'mint' | 'peach' | 'butter' | 'teal' | 'ink' | 'blush'
export const toneBg: Record<Tone, string> = {
  rose: 'bg-rose-soft/70 text-rose-deep', lav: 'bg-lav text-lav-deep', mint: 'bg-mint text-mint-deep', peach: 'bg-peach text-peach-deep',
  butter: 'bg-butter text-[#9b7f1f]', teal: 'bg-teal text-teal-deep', ink: 'bg-white text-ink-soft border border-line', blush: 'bg-blush text-rose-deep',
}

export function Button({ variant = 'primary', size = 'md', tone = 'lav', className = '', loading, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' | 'xl'; tone?: Tone; loading?: boolean }) {
  const sizes = { sm: 'px-3.5 py-1.5 text-sm', md: 'px-5 py-2.5 text-[15px]', lg: 'px-6 py-3.5 text-base', xl: 'px-8 py-5 text-xl' }
  const variants = {
    primary: 'bg-lav-deep text-white shadow-soft hover:brightness-105',
    soft: `${toneBg[tone]} hover:brightness-95 shadow-inset`,
    ghost: 'bg-transparent text-ink-soft hover:bg-white/70',
    danger: 'bg-[#E58A9E] text-white hover:brightness-105',
  }
  return (
    <button {...rest} disabled={rest.disabled || loading} className={`tap inline-flex items-center justify-center gap-2 rounded-full font-bold disabled:opacity-50 disabled:active:scale-100 ${sizes[size]} ${variants[variant]} ${className}`}>
      {loading && <Spinner size={16} />}{children}
    </button>
  )
}

export const Card = ({ children, className = '', tone, ...rest }: { children: ReactNode; className?: string; tone?: Tone } & React.HTMLAttributes<HTMLDivElement>) => (
  <div {...rest} className={`rounded-3xl border border-line shadow-soft ${tone ? '' : 'bg-paper/90'} ${className}`} style={tone ? { background: `var(--tone-${tone}, #fff)` } : undefined}>{children}</div>
)

export const Badge = ({ tone = 'lav', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) => <span className={`chip ${toneBg[tone]} ${className}`}>{children}</span>

export function Spinner({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-label="Loading" role="status"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
}

export function Empty({ title, hint, children, art }: { title: string; hint?: string; children?: ReactNode; art?: ReactNode }) {
  return <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line bg-white/50 px-6 py-8 text-center">{art}<div className="font-display text-lg font-semibold text-ink">{title}</div>{hint && <p className="max-w-sm text-sm text-ink-soft">{hint}</p>}{children}</div>
}

export function ProgressBar({ value, tone = 'lav', label }: { value: number; tone?: Tone; label?: string }) {
  const colors: Record<string, string> = { lav: 'bg-lav-deep', mint: 'bg-mint-deep', rose: 'bg-rose', peach: 'bg-peach-deep', butter: 'bg-butter-deep', teal: 'bg-teal-deep', ink: 'bg-ink', blush: 'bg-rose' }
  return <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2.5 w-full overflow-hidden rounded-full bg-white/80 shadow-inner"><div className={`h-full rounded-full transition-all duration-500 ${colors[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}

const fieldCls = 'w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-lav-deep focus:outline-none focus:ring-2 focus:ring-lav'
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId()
  return <div className="space-y-1.5"><label htmlFor={id} className="text-sm font-bold text-ink">{label}</label>{children(id)}{hint && !error && <p className="text-xs text-ink-soft">{hint}</p>}{error && <p role="alert" className="text-xs font-semibold text-[#C2566F]">{error}</p>}</div>
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldCls} ${p.className ?? ''}`} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${fieldCls} min-h-24 ${p.className ?? ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${fieldCls} pr-8 ${p.className ?? ''}`} />

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="tap flex w-full items-center justify-between gap-4 rounded-2xl border border-line bg-white/70 px-4 py-3 text-left disabled:opacity-50">
      <span><span className="block text-[15px] font-bold text-ink">{label}</span>{hint && <span className="block text-xs text-ink-soft">{hint}</span>}</span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-mint-deep' : 'bg-line'}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} /></span>
    </button>
  )
}

export function Segmented<T extends string | number>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full bg-white/80 p-1 shadow-inset">
      {options.map((o) => <button key={String(o.value)} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)} className={`tap rounded-full font-bold ${size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} ${o.value === value ? 'bg-lav-deep text-white shadow-soft' : 'text-ink-soft hover:bg-lav-soft'}`}>{o.label}</button>)}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-full bg-white/70 p-1 shadow-inset scroll-soft">
      {tabs.map((t) => <button key={t.id} role="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)} className={`tap whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${t.id === value ? 'bg-lav-deep text-white shadow-soft' : 'text-ink-soft hover:bg-lav-soft'}`}>{t.label}</button>)}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(), 30)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.() }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#4A3B4F]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`animate-pop max-h-[92vh] w-full overflow-y-auto rounded-t-4xl bg-cream p-6 shadow-lift sm:rounded-4xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-start justify-between gap-4"><h2 className="font-display text-2xl font-bold">{title}</h2><button aria-label="Close" onClick={onClose} className="tap rounded-full bg-white px-3 py-1 text-lg text-ink-soft shadow-inset">×</button></div>
        {children}
      </div>
    </div>, document.body)
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, busy, disabled }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="space-y-5"><div className="text-[15px] text-ink-soft">{message}</div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button variant="danger" loading={busy} disabled={disabled} onClick={onConfirm}>{confirmLabel}</Button></div></div>
    </Modal>
  )
}

// ---- toasts
interface ToastItem { id: number; text: string; kind: 'ok' | 'err' }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, kind }])
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'err' ? 6000 : 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>{children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => <div key={t.id} role={t.kind === 'err' ? 'alert' : 'status'} className={`animate-rise pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-bold shadow-lift ${t.kind === 'ok' ? 'bg-mint text-[#2f6b55]' : 'bg-[#FFE3E8] text-[#A8445D]'}`}>{t.kind === 'ok' ? '✓ ' : '! '}{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
