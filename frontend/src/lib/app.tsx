import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, hasToken, setToken } from './api'
import type { Bootstrap, Child } from './types'

interface Ctx {
  boot: Bootstrap | null; children: Child[]; loading: boolean; error: string | null; unlocked: boolean
  refresh: () => Promise<void>; unlock: (token: string) => Promise<void>; lock: () => Promise<void>
}
const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children: kids }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(hasToken())

  const refresh = useCallback(async () => {
    try {
      const b = await api<Bootstrap>('/bootstrap')
      setBoot(b); setUnlocked(b.parent_unlocked)
      if (!b.parent_unlocked && hasToken()) setToken(null)
      setChildren(b.consent ? await api<Child[]>('/children') : [])
      setError(null)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const onLocked = () => { setUnlocked(false); void refresh() }
    window.addEventListener('mallow:locked', onLocked)
    return () => window.removeEventListener('mallow:locked', onLocked)
  }, [refresh])

  const unlock = useCallback(async (t: string) => { setToken(t); await refresh() }, [refresh])
  const lock = useCallback(async () => { try { await api('/auth/logout', { method: 'POST' }) } catch { /* ignore */ } setToken(null); setUnlocked(false); await refresh() }, [refresh])
  const value = useMemo(() => ({ boot, children, loading, error, unlocked, refresh, unlock, lock }), [boot, children, loading, error, unlocked, refresh, unlock, lock])
  return <AppCtx.Provider value={value}>{kids}</AppCtx.Provider>
}
