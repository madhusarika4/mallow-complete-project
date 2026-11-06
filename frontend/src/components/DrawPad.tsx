import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { Creation } from '../lib/types'
import { Button, Spinner, errMsg, useToast } from '../ui'

const COLOURS = ['#4A3B4F', '#E58A9E', '#F2A97E', '#F2D56B', '#7CC3A0', '#6FA8C9', '#9D86C9', '#FFFFFF']
const SIZES = [{ n: 6, l: 'Thin' }, { n: 14, l: 'Medium' }, { n: 28, l: 'Thick' }]
const STAMPS = ['⭐', '🌈', '🦋', '🌸', '🐱', '🐶', '🦄', '❤️', '☀️', '🐠']

/** Finger / mouse / stylus drawing canvas that saves a PNG to the child's gallery. */
export function DrawPad({ childId, big = false, onSaved, background = '#FFFDF9' }: { childId: number; big?: boolean; onSaved?: () => void; background?: string }) {
  const toast = useToast()
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const history = useRef<ImageData[]>([])
  const [colour, setColour] = useState(COLOURS[0])
  const [size, setSize] = useState(SIZES[1].n)
  const [tool, setTool] = useState<'pen' | 'eraser' | 'stamp'>('pen')
  const [stamp, setStamp] = useState(STAMPS[0])
  const [title, setTitle] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const W = 900, H = 600

  const clear = useCallback(() => { const c = ref.current!; const x = c.getContext('2d')!; x.fillStyle = background; x.fillRect(0, 0, c.width, c.height) }, [background])
  useEffect(() => { clear() }, [clear])

  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H } }
  const snapshot = () => { const c = ref.current!; history.current.push(c.getContext('2d')!.getImageData(0, 0, c.width, c.height)); if (history.current.length > 20) history.current.shift() }
  const down = (e: React.PointerEvent) => {
    e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId); snapshot(); setDirty(true)
    const p = pos(e); const x = ref.current!.getContext('2d')!
    if (tool === 'stamp') { x.font = `${size * 3 + 30}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(stamp, p.x, p.y); return }
    drawing.current = true; last.current = p
    x.fillStyle = tool === 'eraser' ? background : colour; x.beginPath(); x.arc(p.x, p.y, (tool === 'eraser' ? size * 1.4 : size) / 2, 0, Math.PI * 2); x.fill()
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return
    const p = pos(e); const x = ref.current!.getContext('2d')!
    x.strokeStyle = tool === 'eraser' ? background : colour; x.lineWidth = tool === 'eraser' ? size * 1.4 : size; x.lineCap = 'round'; x.lineJoin = 'round'
    x.beginPath(); x.moveTo(last.current.x, last.current.y); x.lineTo(p.x, p.y); x.stroke(); last.current = p
  }
  const up = () => { drawing.current = false; last.current = null }
  const undo = () => { const h = history.current.pop(); if (h) ref.current!.getContext('2d')!.putImageData(h, 0, 0); if (!history.current.length) setDirty(false) }
  const wipe = () => { snapshot(); clear(); setDirty(false) }
  const save = async () => {
    if (!dirty) return toast('Draw something first!', 'err')
    setBusy(true)
    try {
      await api(`/children/${childId}/creations`, { body: { kind: 'drawing', title: title.trim() || 'My drawing', content: ref.current!.toDataURL('image/png') } })
      toast('Saved to My Gallery ⭐'); setTitle(''); history.current = []; clear(); setDirty(false); onSaved?.()
    } catch (e) { toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  const btn = big ? 'h-14 w-14 text-2xl' : 'h-10 w-10 text-lg'
  return (
    <div className="space-y-3" data-testid="drawpad">
      <canvas ref={ref} width={W} height={H} data-testid="draw-canvas" aria-label="Drawing area" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        className="w-full touch-none cursor-crosshair rounded-4xl border-4 border-white bg-paper shadow-lift" style={{ aspectRatio: `${W}/${H}` }} />
      <div className="flex flex-wrap items-center gap-2 rounded-4xl border border-line bg-white/70 p-3 shadow-soft">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Colour">{COLOURS.map((c) => <button key={c} role="radio" aria-checked={colour === c && tool !== 'eraser'} aria-label={`Colour ${c}`} onClick={() => { setColour(c); if (tool === 'eraser') setTool('pen') }} className={`tap rounded-full border-4 ${big ? 'h-11 w-11' : 'h-8 w-8'} ${colour === c && tool !== 'eraser' ? 'border-ink scale-110' : 'border-white shadow-inset'}`} style={{ background: c }} />)}</div>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Brush size">{SIZES.map((s) => <button key={s.n} role="radio" aria-checked={size === s.n} aria-label={s.l} onClick={() => setSize(s.n)} className={`tap grid place-items-center rounded-full bg-white shadow-inset ${btn} ${size === s.n ? 'ring-2 ring-lav-deep' : ''}`}><span className="rounded-full bg-ink" style={{ width: s.n / 2 + 4, height: s.n / 2 + 4 }} /></button>)}</div>
        <div className="flex gap-1.5">
          <button onClick={() => setTool('pen')} aria-pressed={tool === 'pen'} aria-label="Pen" className={`tap rounded-full bg-white shadow-inset ${btn} ${tool === 'pen' ? 'ring-2 ring-lav-deep' : ''}`}>✏️</button>
          <button onClick={() => setTool('eraser')} aria-pressed={tool === 'eraser'} aria-label="Eraser" className={`tap rounded-full bg-white shadow-inset ${btn} ${tool === 'eraser' ? 'ring-2 ring-lav-deep' : ''}`}>🧽</button>
          <button onClick={() => setTool('stamp')} aria-pressed={tool === 'stamp'} aria-label="Stamp" className={`tap rounded-full bg-white shadow-inset ${btn} ${tool === 'stamp' ? 'ring-2 ring-lav-deep' : ''}`}>🔖</button>
        </div>
        {tool === 'stamp' && <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Stamp picker">{STAMPS.map((s) => <button key={s} role="radio" aria-checked={stamp === s} onClick={() => setStamp(s)} className={`tap rounded-full bg-white text-xl ${big ? 'h-11 w-11' : 'h-8 w-8'} ${stamp === s ? 'ring-2 ring-lav-deep' : ''}`}>{s}</button>)}</div>}
        <div className="ml-auto flex gap-1.5"><button onClick={undo} aria-label="Undo" className={`tap rounded-full bg-white shadow-inset ${btn}`}>↩️</button><button onClick={wipe} aria-label="Clear drawing" className={`tap rounded-full bg-white shadow-inset ${btn}`}>🗑️</button></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Name your picture" aria-label="Picture name" className={`min-w-0 flex-1 rounded-full border border-line bg-white px-5 shadow-inset ${big ? 'py-4 text-xl' : 'py-2.5'}`} />
        <Button size={big ? 'lg' : 'md'} onClick={save} loading={busy} data-testid="draw-save">Save to gallery</Button>
      </div>
    </div>
  )
}

/** Saved creations (drawings or text) with open + delete. */
export function Gallery({ childId, kind, reload, big = false }: { childId: number; kind: Creation['kind']; reload: number; big?: boolean }) {
  const toast = useToast()
  const [items, setItems] = useState<Creation[] | null>(null)
  const [open, setOpen] = useState<Creation | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => { api<Creation[]>(`/children/${childId}/creations?kind=${kind}`).then(setItems).catch((e) => toast(errMsg(e), 'err')) }, [childId, kind, reload, n]) // eslint-disable-line react-hooks/exhaustive-deps
  const del = async (c: Creation) => { try { await api(`/children/${childId}/creations/${c.id}`, { method: 'DELETE' }); setOpen(null); setN((x) => x + 1); toast('Removed.') } catch (e) { toast(errMsg(e), 'err') } }
  if (!items) return <Spinner />
  if (!items.length) return <p className="rounded-3xl bg-white/60 p-6 text-center text-ink-soft" data-testid="gallery-empty">{kind === 'drawing' ? 'Your saved pictures will show up here.' : 'Things you save will show up here.'}</p>
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="gallery">
        {items.map((c) => <li key={c.id}><button onClick={() => setOpen(c)} className="tap w-full overflow-hidden rounded-3xl border border-line bg-white text-left shadow-soft">
          {kind === 'drawing' ? <img src={c.content} alt={c.title} className="aspect-[3/2] w-full object-cover" /> : <p className="line-clamp-4 h-24 whitespace-pre-wrap p-3 text-sm text-ink-soft">{c.content}</p>}
          <div className={`truncate px-3 py-2 font-bold ${big ? 'text-lg' : 'text-sm'}`}>{c.title}</div></button></li>)}
      </ul>
      {open && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
        <div className="max-h-full w-full max-w-2xl overflow-auto rounded-4xl bg-paper p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-3 font-display text-2xl font-bold">{open.title}</h3>
          {kind === 'drawing' ? <img src={open.content} alt={open.title} className="w-full rounded-3xl" /> : <OpenText childId={childId} id={open.id} fallback={open.content} />}
          <div className="mt-4 flex justify-end gap-2"><Button variant="danger" onClick={() => del(open)} data-testid="gallery-delete">Delete</Button><Button onClick={() => setOpen(null)}>Close</Button></div>
        </div></div>}
    </>
  )
}
function OpenText({ childId, id, fallback }: { childId: number; id: number; fallback: string }) {
  const [t, setT] = useState(fallback)
  useEffect(() => { api<Creation>(`/children/${childId}/creations/${id}`).then((c) => setT(c.content)).catch(() => undefined) }, [childId, id])
  return <p className="whitespace-pre-wrap text-lg leading-relaxed">{t}</p>
}
