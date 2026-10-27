import type { PendingPush, EmailPreviewKind, EmailPreviewResult, Arrivals, Bird, BirdSound, Observation, Region, SeasonMonth, User, UserPatch, WhereToFind, WhereToGo, NearbyPublic, PlaceSearch, Drive, SavedRoute, SavedPoint, SeenBird, LifeListImport, SplitEvidence, SplitChoice, Share } from './types'

// Every request goes to the same-origin `/api` prefix. In development Vite proxies it to the
// backend (vite.config.ts); in production Vercel rewrites it (vercel.json). The backend holds
// the eBird and image API keys, so the browser never sees them.
const API_BASE = '/api'

export class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }
}

export const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

const parseResponse = async <T,>(res: Response): Promise<T> => {
    if (res.status === 204) return null as T
    const text = await res.text()
    let data: unknown = null
    if (text) {
        try { data = JSON.parse(text) } catch { data = null }
    }
    if (!res.ok) {
        const serverMessage = typeof data === 'object' && data !== null && 'error' in data ? String((data as { error: unknown }).error) : null
        throw new ApiError(serverMessage || `HTTP Error: ${res.status} ${res.statusText}`, res.status)
    }
    return data as T
}

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    params?: Record<string, string>
}

const api = <T,>(path: string, { method = 'GET', body, params }: RequestOptions = {}): Promise<T> => {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return fetch(`${API_BASE}${path}${query}`, {
        method,
        credentials: 'same-origin',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined
    }).then(res => parseResponse<T>(res))
}

// ---- auth ----
export const getCurrentUser = () => api<User>('/auth/me')
export const getUserExists = (email: string) => api<{ userExists: boolean }>('/auth/exists', { params: { email } })
export const login = (email: string, password: string) => api<User>('/auth/login', { method: 'POST', body: { email, password } })
export const signup = (email: string, password: string) => api<User>('/auth/signup', { method: 'POST', body: { email, password } })
export const logout = () => api<null>('/auth/logout', { method: 'POST' })
export const requestPasswordReset = (email: string) => api<{ ok: true }>('/auth/forgot', { method: 'POST', body: { email } })
export const resetPassword = (token: string, password: string) => api<{ ok: true }>('/auth/reset', { method: 'POST', body: { token, password } })
export const confirmEmail = (token: string) => api<{ ok: true }>('/auth/confirm', { method: 'POST', body: { token } })
export const resendConfirmationEmail = () => api<{ ok: true }>('/auth/resend-confirmation', { method: 'POST' })
export const unsubscribe = (token: string) => api<{ ok: true; emailType: string }>('/auth/unsubscribe', { method: 'POST', body: { token } })

// ---- user ----
export const patchUser = (changes: UserPatch) => api<User>('/user', { method: 'PATCH', body: changes })

// ---- watch list ----
export const getSavedBirds = () => api<Bird[]>('/saved')
export const postSavedBird = (speciesCode: string) => api<Bird>('/saved', { method: 'POST', body: { speciesCode } })
// ---- life list ----
export const getSeenBirds = () => api<SeenBird[]>('/saved', { params: { kind: 'seen' } })
export const postSeenBird = (speciesCode: string) => api<{ speciesCode: string }>('/saved', { method: 'POST', params: { kind: 'seen' }, body: { speciesCode } })
export const deleteSeenBird = (speciesCode: string) => api<null>('/saved', { method: 'DELETE', params: { kind: 'seen', speciesCode } })
export const getSplitEvidence = (ask: { choices: SplitChoice[]; locId: string | null; region: string | null; day: string }) =>
  api<SplitEvidence>('/saved', { method: 'POST', params: { kind: 'seen', evidence: '1' }, body: ask })
export const importLifeList = (csv: string) => api<LifeListImport>('/saved', { method: 'POST', params: { kind: 'seen', import: '1' }, body: { csv } })

// ---- share links ----
export const createShare = (share: Record<string, unknown> & { kind: 'route' | 'sighting' }) => api<{ id: string; url: string }>('/saved', { method: 'POST', params: { kind: 'share' }, body: share })
export const getShare = (id: string) => api<Share>('/ebird/share', { params: { id } })

export const getSavedRoute = (region: string) => api<SavedRoute>('/saved', { params: { kind: 'route', region } })
/** Only the fields given change: `stops: null` goes back to the suggestion, `start: null` clears the start. */
export const putSavedRoute = (change: { region: string; stops?: SavedPoint[] | null; start?: SavedPoint | null }) =>
  api<SavedRoute>('/saved', { method: 'PUT', params: { kind: 'route' }, body: change })
export const deleteSavedBird = (speciesCode: string) => api<null>('/saved', { method: 'DELETE', params: { speciesCode } })

// ---- birds (the server resolves and stores codes it has not seen before) ----
export const getBirdsByCodes = (codes: string[]) =>
    codes.length ? api<Bird[]>('/birds', { params: { codes: codes.join(',') } }) : Promise.resolve([] as Bird[])
export const searchBirds = (q: string) => api<Bird[]>('/birds', { params: { q } })

// ---- eBird, proxied and cached by the backend ----
export const getSpeciesList = (region: string) => api<string[]>('/ebird/species-list', { params: { region } })
export const getRecentObservations = (region: string) => api<Observation[]>('/ebird/observations', { params: { region } })
/** The last week's notable reports: what the splash page shows a visitor before any account. */
export const getNotableThisWeek = (region: string) => api<Observation[]>('/ebird/notable', { params: { region, back: '7' } })
export const getNotableObservations = (region: string) => api<Observation[]>('/ebird/notable', { params: { region, back: '30' } })
export const getSpeciesObservations = (region: string, code: string) =>
    api<Observation[]>('/ebird/species-observations', { params: { region, code, back: '30' } })
export const getRegions = (state: string) => api<Region[]>('/ebird/regions', { params: { state } })
export const getArrivals = (region: string) => api<Arrivals>('/ebird/arriving', { params: { region } })
export const getSeasonality = (region: string, code: string) => api<{ months: SeasonMonth[] }>('/ebird/seasonality', { params: { region, code } })
/** Places the species has been reported lately in the region, ranked by the chance a visit pays off. */
export const getWhereToFind = (region: string, code: string) => api<WhereToFind>('/ebird/where', { params: { region, code } })

// ---- web push ----
export interface PushStatus {
    subscribed: boolean
    devices: number
    lastRun: { at: string; notified?: number; heldForQuietHours?: number } | null
}
export const getPushPublicKey = () => api<{ publicKey: string }>('/push/public-key')
export const subscribePush = (subscription: PushSubscriptionJSON & { userAgent?: string }) =>
    api<{ ok: true }>('/push/subscribe', { method: 'POST', body: subscription })
export const unsubscribePush = (endpoint: string) => api<null>('/push/unsubscribe', { method: 'POST', body: { endpoint } })
export const getPushStatus = (endpoint?: string) => api<PushStatus>('/push/status', endpoint ? { params: { endpoint } } : {})
export const sendTestPush = (endpoint?: string) => api<{ sent: number; gone: number }>('/push/test', { method: 'POST', body: endpoint ? { endpoint } : {} })

/** Best-effort note of what the app did with a notification, for reading back from the server. */
export const postPushTrace = (detail: Record<string, unknown>) =>
  fetch(`${API_BASE}/push/trace`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(detail) }).catch(() => undefined)

export const getPendingPush = () => api<{ push: PendingPush | null }>('/push/pending')
export const ackPendingPush = (ack: { offered?: boolean; opened?: boolean }) =>
  fetch(`${API_BASE}/push/ack`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ack) }).catch(() => undefined)

/** Sends one of the email digests to the signed-in user right now, so they can see what it looks like. */
export const sendEmailPreview = (kind: EmailPreviewKind) => api<EmailPreviewResult>('/mailPreview', { method: 'POST', body: { kind } })

/** One representative recording of the species from xeno-canto, or `found: false`. */
export const getBirdSound = (code: string) => api<BirdSound>('/sound', { params: { code } })
/** The watch list's places folded together, ranked by the birds a visit can expect, with a short route. */
export const getWhereToGo = (region: string, codes: string[], from?: { lat: number; lng: number } | null) =>
  api<WhereToGo>('/ebird/where-to-go', { params: { region, codes: codes.join(','), ...(from ? { from: `${from.lat.toFixed(2)},${from.lng.toFixed(2)}` } : {}) } })
/** Hotspots in the state by name; towns and addresses too when `addresses` (only on submit). */
export const getPlaceSearch = (state: string, q: string, addresses: boolean) =>
  api<PlaceSearch>('/ebird/place-search', { params: { state, q, ...(addresses ? { addresses: '1' } : {}) } })
/** The drive through points in the order given; null when no road route could be had. */
export const getDrive = (points: { lat: number; lng: number }[]) =>
  api<Drive | null>('/ebird/drive', { params: { points: points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';') } })
/** Public land near a point, for when a bird's best place is someone's yard. */
export const getNearbyPublic = (lat: number, lng: number) => api<NearbyPublic>('/ebird/nearby', { params: { lat: lat.toFixed(5), lng: lng.toFixed(5) } })
