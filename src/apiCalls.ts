import type { PendingPush, EmailPreviewKind, EmailPreviewResult, Arrivals, Bird, BirdSound, Observation, Region, Place, Province, Area,SeasonMonth, User, UserPatch, WhereToFind, WhereToGo, BestHotspots, SpeciesHotspots, NearbyPublic, PlaceSearch, Drive, SavedRoute, SavedPoint, SeenBird, LifeListImport, SplitEvidence, SplitChoice, Share, Passkey, Chase, PersistenceClass, Id, SavedPlace, PlaceInput, PlaceTrip, PlaceSuggestion } from './types'
import { arrival } from './arrival'
import { isStandalone } from './install'
import { nameLocale, signupLocale } from './i18n'

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
    headers?: Record<string, string>
}

// Bird names come back in the person's language. The eBird and bird lists are cached by address,
// so they carry the language in it (?locale=); everything else says it in a header, which the
// server uses for its messages (the signed-in person's own lists follow their saved choice).
const CACHED_BY_URL = /^\/(ebird|birds)(\/|$)/

const api = <T,>(path: string, { method = 'GET', body, params, headers }: RequestOptions = {}): Promise<T> => {
    const locale = nameLocale()
    const byUrl = Boolean(locale) && CACHED_BY_URL.test(path)
    const allParams = byUrl ? { ...params, locale: locale! } : params
    const allHeaders = locale && !byUrl ? { ...headers, 'X-Locale': locale } : headers
    const query = allParams ? `?${new URLSearchParams(allParams)}` : ''
    return fetch(`${API_BASE}${path}${query}`, {
        method,
        credentials: 'same-origin',
        headers: body !== undefined || allHeaders ? { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...allHeaders } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined
    }).then(res => parseResponse<T>(res))
}

// ---- auth ----
// Says whether this is the app installed to the home screen or a browser tab, for the owner's numbers
// on how many people install it (the step iPhones need for push alerts).
/** The languages bird names come in: [{ locale, name }]. */
export const getNameLocales = () => api<{ locale: string; name: string }[]>('/ebird/name-locales')
export const getCurrentUser = () => api<User>('/auth/me', { headers: { 'X-App-Mode': isStandalone() ? 'app' : 'browser' } })
export const getUserExists = (email: string) => api<{ userExists: boolean }>('/auth/exists', { params: { email } })
export const login = (email: string, password: string) => api<User>('/auth/login', { method: 'POST', body: { email, password } })
export const signup = (email: string, password: string, place?: { state: string; location: string } | null) =>
  api<User>('/auth/signup', { method: 'POST', body: { email, password, ...(place ?? {}), source: arrival(), ...(signupLocale() ? { locale: signupLocale() } : {}) } })
// ---- passkeys ----
export const passkeyLoginOptions = () => api<{ options: unknown; token: string }>('/auth/passkey-login-options', { method: 'POST' })
export const passkeyLogin = (response: unknown, token: string) => api<User>('/auth/passkey-login', { method: 'POST', body: { response, token } })
export const passkeyRegisterOptions = () => api<{ options: unknown; token: string }>('/auth/passkey-register-options', { method: 'POST' })
export const passkeyRegister = (response: unknown, token: string) => api<Passkey[]>('/auth/passkey-register', { method: 'POST', body: { response, token } })
export const getPasskeys = () => api<Passkey[]>('/auth/passkeys')
export const deletePasskey = (id: string) => api<Passkey[]>('/auth/passkeys', { method: 'DELETE', params: { id } })
export const logout = () => api<null>('/auth/logout', { method: 'POST' })
/** Deletes the account and everything kept for it, for good; the session ends with it. */
export const deleteAccount = () => api<null>('/user', { method: 'DELETE', body: { confirm: 'delete' } })
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

// ---- feedback ----
export const sendFeedback = (feedback: { kind: 'idea' | 'bug' | 'other'; message: string; page?: string }) =>
  api<{ ok: true }>('/saved', { method: 'POST', params: { kind: 'feedback' }, body: feedback })

// ---- share links ----
export const createShare = (share: Record<string, unknown> & { kind: 'route' | 'sighting' }) => api<{ id: string; url: string }>('/saved', { method: 'POST', params: { kind: 'share' }, body: share })
export const getShare = (id: string) => api<Share>('/ebird/share', { params: { id } })

export const getPlaces = () => api<SavedPlace[]>('/saved', { params: { kind: 'places' } })
export const postPlace = (place: PlaceInput) => api<SavedPlace>('/saved', { method: 'POST', params: { kind: 'place' }, body: place })
export const patchPlace = (id: Id, place: Partial<PlaceInput>) => api<SavedPlace>('/saved', { method: 'PATCH', params: { kind: 'place', id: String(id) }, body: place })
export const deletePlace = (id: Id) => api<null>('/saved', { method: 'DELETE', params: { kind: 'place', id: String(id) } })
export const putPlaceTargets = (id: Id, codes: string[]) => api<SavedPlace>('/saved', { method: 'PUT', params: { kind: 'place-targets', id: String(id) }, body: { codes } })
export const getPlaceSuggestions = (id: Id, from: string, to: string) =>
  api<PlaceSuggestion[] | { suggestions?: PlaceSuggestion[]; codes?: PlaceSuggestion[] }>('/saved', { params: { kind: 'place-suggestions', id: String(id), from, to } })
export const postPlaceTrip = (trip: { place_id: Id; starts_on: string; ends_on: string }) => api<PlaceTrip>('/saved', { method: 'POST', params: { kind: 'trip' }, body: trip })
export const patchPlaceTrip = (id: Id, trip: { starts_on: string; ends_on: string }) => api<PlaceTrip>('/saved', { method: 'PATCH', params: { kind: 'trip', id: String(id) }, body: trip })
export const deletePlaceTrip = (id: Id) => api<null>('/saved', { method: 'DELETE', params: { kind: 'trip', id: String(id) } })
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
/** Every country eBird covers, and a country's provinces. */
export const getCountries = () => api<Place[]>('/ebird/countries')
export const getProvinces = (country: string) => api<Province[]>('/ebird/provinces', { params: { country } })
/** The area a point falls in (the point isn't kept), or null when eBird has nothing near. */
export const getAreaAt = (lat: number, lng: number) => api<Area | null>('/ebird/area-at', { params: { lat: lat.toFixed(4), lng: lng.toFixed(4) } })
/** Areas for a town, address or county typed by name, anywhere. */
export const getAreaSearch = (q: string) => api<{ areas: Area[] }>('/ebird/area-search', { params: { q } })
export const getArrivals = (region: string) => api<Arrivals>('/ebird/arriving', { params: { region } })
export const getSeasonality = (region: string, code: string) => api<{ months: SeasonMonth[] }>('/ebird/seasonality', { params: { region, code } })
/** Places the species has been reported lately in the region, ranked by the chance a visit pays off. */
/** Is the bird still at the place? `cls` sets how fast a sighting goes stale. */
export const getChase = (locId: string, code: string, cls?: PersistenceClass) =>
  api<Chase>('/ebird/chase', { params: { locId, code, ...(cls ? { cls } : {}) } })
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
/** The county's hotspots ranked by species reported in the last `days`. */
export const getBestHotspots = (region: string, days: number) => api<BestHotspots>('/ebird/best-hotspots', { params: { region, days: String(days) } })
export const getSpeciesHotspots = (region: string, days: number, species: string) => api<SpeciesHotspots>('/ebird/best-hotspots', { params: { region, days: String(days), species } })
/** Hotspots in the state by name; towns and addresses too when `addresses` (only on submit). */
export const getPlaceSearch = (state: string, q: string, addresses: boolean) =>
  api<PlaceSearch>('/ebird/place-search', { params: { state, q, ...(addresses ? { addresses: '1' } : {}) } })
/** The drive through points in the order given; null when no road route could be had. */
export const getDrive = (points: { lat: number; lng: number }[]) =>
  api<Drive | null>('/ebird/drive', { params: { points: points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';') } })
/** Public land near a point, for when a bird's best place is someone's yard. */
export const getNearbyPublic = (lat: number, lng: number) => api<NearbyPublic>('/ebird/nearby', { params: { lat: lat.toFixed(5), lng: lng.toFixed(5) } })
