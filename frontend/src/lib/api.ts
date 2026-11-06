// Thin typed fetch client. Never holds API keys: the browser only talks to our own backend.
const TOKEN_KEY = 'mallow.parentToken'
let token: string | null = null
try { token = sessionStorage.getItem(TOKEN_KEY) } catch { /* private mode */ }

export class ApiError extends Error {
  status: number; code?: string
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code }
}
export function setToken(t: string | null) {
  token = t
  try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}
export const hasToken = () => !!token

async function parseError(res: Response): Promise<ApiError> {
  let message = `Something went wrong (${res.status})`; let code: string | undefined
  try {
    const body = await res.json()
    const d = body.detail
    if (typeof d === 'string') message = d
    else if (d && typeof d === 'object') { message = d.message ?? message; code = d.code }
  } catch { /* not json */ }
  return new ApiError(message, res.status, code)
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers['X-Parent-Token'] = token
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body) }
  let res: Response
  try { res = await fetch(`/api${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, signal: opts.signal }) }
  catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError('Cannot reach Mallow. Is the app still running?', 0, 'network')
  }
  if (res.status === 401 && token && path !== '/auth/login') { setToken(null); window.dispatchEvent(new Event('mallow:locked')) }
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<T>
}

export async function apiBlob(path: string, body: unknown, signal?: AbortSignal): Promise<{ blob: Blob; notice: string | null; voice: string | null }> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Parent-Token': token } : {}) }, body: JSON.stringify(body), signal })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError('Cannot reach Mallow.', 0, 'network')
  }
  if (!res.ok) throw await parseError(res)
  const blob = await res.blob()
  if (!blob.size) throw new ApiError('The voice returned no audio.', 503, 'tts_empty')
  return { blob, notice: res.headers.get('X-Voice-Notice'), voice: res.headers.get('X-Voice-Name') }
}
