import type { Bird, Observation, Region, User, UserPatch } from './types'

// All calls to our own API go through the same-origin `/api` prefix. In development Vite proxies
// it to the backend (see vite.config.ts); in production Vercel rewrites it (see vercel.json).
// That keeps the session cookie first-party.
const API_BASE = '/api'

const EBIRD_HEADERS = { 'X-eBirdApiToken': import.meta.env.REACT_APP_EBIRD_API_KEY }

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
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
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

const external = <T,>(url: string, headers?: Record<string, string>): Promise<T> =>
    fetch(url, { headers }).then(res => parseResponse<T>(res))

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
export const postSavedBird = (bird: Bird) => api<Bird>('/saved', { method: 'POST', body: bird })
export const deleteSavedBird = (speciesCode: string) => api<null>('/saved', { method: 'DELETE', params: { speciesCode } })

// ---- birds we already know about ----
export const getBirdsByCodes = (codes: string[]) =>
    codes.length ? api<Bird[]>('/birds', { params: { codes: codes.join(',') } }) : Promise.resolve([] as Bird[])
export const searchBirds = (q: string) => api<Bird[]>('/birds', { params: { q } })

// ---- eBird and friends ----
export const getBirdKeysByLocation = (region: string) =>
    external<string[]>(`https://api.ebird.org/v2/product/spplist/${encodeURIComponent(region)}`, EBIRD_HEADERS)

export const getBirdObservationsByLocation = (region: string) =>
    external<Observation[]>(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(region)}/recent`, EBIRD_HEADERS)

export const getExternalRegions = (state: string) =>
    external<Region[]>(`https://api.ebird.org/v2/ref/region/list/subnational2/US-${encodeURIComponent(state)}`, EBIRD_HEADERS)

export const getExternalNotableBirds = (region: string) =>
    external<Observation[]>(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(region)}/recent/notable?back=30`, EBIRD_HEADERS)

export const getExternalLastObserved = (speciesCode: string, region: string) =>
    external<Observation[]>(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(region)}/recent/${encodeURIComponent(speciesCode)}?back=30`, EBIRD_HEADERS)

type Taxon = Pick<Bird, 'speciesCode' | 'comName' | 'sciName' | 'category' | 'order' | 'familyCode' | 'familyComName' | 'familySciName' | 'taxonOrder'>

const getExternalTaxonomy = (speciesCode: string) =>
    external<Taxon[]>(`https://api.ebird.org/v2/ref/taxonomy/ebird?species=${encodeURIComponent(speciesCode)}&fmt=json`, EBIRD_HEADERS)

const getExternalBirdImg = (comName: string) =>
    external<{ entities?: { images?: string[] }[] }>(
        `https://nuthatch.lastelm.software/v2/birds?${new URLSearchParams({ page: '1', pageSize: '25', name: comName, operator: 'AND' })}`,
        { 'API-Key': import.meta.env.REACT_APP_NUTHATCH_API_KEY })

const getExternalBirdWiki = (comName: string) =>
    external<{ pages?: { id: number }[] }>(
        `https://api.wikimedia.org/core/v1/wikipedia/en/search/page?${new URLSearchParams({ q: comName, limit: '1' })}`,
        { 'Api-User-Agent': 'bird-alert (github.com/mbenfowler/bird-alert)' })

// Builds a bird record from eBird taxonomy plus an image and a Wikipedia link. Image and wiki
// lookups are best-effort: a failure there should not hide the bird.
const enrichFromExternal = async (speciesCode: string): Promise<Bird> => {
    const [taxon] = await getExternalTaxonomy(speciesCode)
    if (!taxon) throw new ApiError(`Unknown species code ${speciesCode}`, 404)
    const [imgResult, wikiResult] = await Promise.allSettled([getExternalBirdImg(taxon.comName), getExternalBirdWiki(taxon.comName)])
    const rawImg = imgResult.status === 'fulfilled' ? imgResult.value.entities?.[0]?.images?.[0] : undefined
    const wikiId = wikiResult.status === 'fulfilled' ? wikiResult.value.pages?.[0]?.id : undefined
    return {
        ...taxon,
        birdImg: rawImg ? `${rawImg}?q=75&fm=jpg&w=400&fit=max` : undefined,
        wikiURL: wikiId ? `https://en.wikipedia.org/?curid=${wikiId}` : undefined
    }
}

// Returns full bird records for the given species codes, in the same order. Codes we have in
// our own database are served from there; the rest are assembled from external sources.
export const getBirdsData = async (codes: string[]): Promise<Bird[]> => {
    const known = await getBirdsByCodes(codes)
    const byCode = new Map(known.map(bird => [bird.speciesCode, bird]))
    return Promise.all(codes.map(code => byCode.get(code) ?? enrichFromExternal(code)))
}
