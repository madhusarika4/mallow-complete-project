import { lazy, Suspense } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useApp } from '../lib/app'
import { Spinner } from '../ui'
import Bunny from '../components/Bunny'

const Little = lazy(() => import('./child46'))
const Explorer = lazy(() => import('./child79'))
const Thinker = lazy(() => import('./child1012'))

/** The child's age band (derived from date of birth) decides which of the three experiences they get. */
export default function ChildRouter() {
  const { id } = useParams()
  const { children, loading } = useApp()
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner size={32} /></div>
  const child = children.find((c) => String(c.id) === id)
  if (!child) return <Navigate to="/" replace />
  if (child.is_infant) return (
    <div className="mx-auto grid min-h-screen max-w-md place-items-center p-6 text-center">
      <div className="space-y-4"><Bunny pose="sleep" accessory="nightcap" size={220} /><h1 className="text-2xl font-bold">{child.nickname} is in Infant care</h1><p className="text-ink-soft">Infant profiles are for parents to track feeding, sleep and more. There is no chat for babies.</p><Link to="/parent/infant" className="inline-block rounded-full bg-lav-deep px-5 py-2.5 font-bold text-white">Open Infant care</Link></div>
    </div>)
  const Exp = child.age_band === '4-6' ? Little : child.age_band === '7-9' ? Explorer : Thinker
  return <Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner size={32} /></div>}><Exp key={`${child.id}-${child.age_band}`} child={child} /></Suspense>
}
