// All calls to our own API go through the same-origin `/api` prefix. In development the CRA
// dev server proxies it to the backend (see "proxy" in package.json); in production Vercel
// rewrites it (see vercel.json). That keeps the session cookie first-party.
const API_BASE = '/api'

const EBIRD_HEADERS = { 'X-eBirdApiToken': process.env.REACT_APP_EBIRD_API_KEY }

export class ApiError extends Error {
    constructor(message, status) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }
}

const parseResponse = async (res) => {
    if (res.status === 204) return null
    const text = await res.text()
    let data = null
    if (text) {
        try { data = JSON.parse(text) } catch (error) { data = null }
    }
    if (!res.ok) {
        throw new ApiError(data?.error || `HTTP Error: ${res.status} ${res.statusText}`, res.status)
    }
    return data
}

const api = (path, { method = 'GET', body, params } = {}) => {
    const query = params ? `?${new URLSearchParams(params)}` : ''
    return fetch(`${API_BASE}${path}${query}`, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
    }).then(parseResponse)
}

const external = (url, headers) => fetch(url, { headers }).then(parseResponse)

// ---- auth ----
const getCurrentUser = () => api('/auth/me')
const getUserExists = (email) => api('/auth/exists', { params: { email } })
const login = (email, password) => api('/auth/login', { method: 'POST', body: { email, password } })
const signup = (email, password) => api('/auth/signup', { method: 'POST', body: { email, password } })
const logout = () => api('/auth/logout', { method: 'POST' })
const requestPasswordReset = (email) => api('/auth/forgot', { method: 'POST', body: { email } })
const resetPassword = (token, password) => api('/auth/reset', { method: 'POST', body: { token, password } })
const confirmEmail = (token) => api('/auth/confirm', { method: 'POST', body: { token } })
const resendConfirmationEmail = () => api('/auth/resend-confirmation', { method: 'POST' })
const unsubscribe = (token) => api('/auth/unsubscribe', { method: 'POST', body: { token } })

// ---- user ----
const patchUser = (changes) => api('/user', { method: 'PATCH', body: changes })

// ---- watch list ----
const getSavedBirds = () => api('/saved')
const postSavedBird = (bird) => api('/saved', { method: 'POST', body: bird })
const deleteSavedBird = (speciesCode) => api('/saved', { method: 'DELETE', params: { speciesCode } })

// ---- birds we already know about ----
const getBirdsByCodes = (codes) => (codes.length ? api('/birds', { params: { codes: codes.join(',') } }) : Promise.resolve([]))
const searchBirds = (q) => api('/birds', { params: { q } })

// ---- eBird and friends ----
const getBirdKeysByLocation = (region) =>
    external(`https://api.ebird.org/v2/product/spplist/${encodeURIComponent(region)}`, EBIRD_HEADERS)

const getBirdObservationsByLocation = (region) =>
    external(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(region)}/recent`, EBIRD_HEADERS)

const getExternalRegions = (state) =>
    external(`https://api.ebird.org/v2/ref/region/list/subnational2/US-${encodeURIComponent(state)}`, EBIRD_HEADERS)

const getExternalNotableBirds = (region) =>
    external(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(region)}/recent/notable?back=30`, EBIRD_HEADERS)

const getExternalLastObserved = (speciesCode, region) =>
    external(`https://api.ebird.org/v2/data/obs/${encodeURIComponent(region)}/recent/${encodeURIComponent(speciesCode)}?back=30`, EBIRD_HEADERS)

const getExternalTaxonomy = (speciesCode) =>
    external(`https://api.ebird.org/v2/ref/taxonomy/ebird?species=${encodeURIComponent(speciesCode)}&fmt=json`, EBIRD_HEADERS)

const getExternalBirdImg = (comName) =>
    external(`https://nuthatch.lastelm.software/v2/birds?${new URLSearchParams({ page: 1, pageSize: 25, name: comName, operator: 'AND' })}`,
        { 'API-Key': process.env.REACT_APP_NUTHATCH_API_KEY })

const getExternalBirdWiki = (comName) =>
    external(`https://api.wikimedia.org/core/v1/wikipedia/en/search/page?${new URLSearchParams({ q: comName, limit: 1 })}`,
        { 'Api-User-Agent': 'bird-alert (github.com/mbenfowler/bird-alert)' })

// Builds a bird record from eBird taxonomy plus an image and a Wikipedia link. Image and wiki
// lookups are best-effort: a failure there should not hide the bird.
const enrichFromExternal = async (speciesCode) => {
    const [taxon] = await getExternalTaxonomy(speciesCode)
    if (!taxon) throw new ApiError(`Unknown species code ${speciesCode}`, 404)
    const [imgResult, wikiResult] = await Promise.allSettled([getExternalBirdImg(taxon.comName), getExternalBirdWiki(taxon.comName)])
    const rawImg = imgResult.status === 'fulfilled' ? imgResult.value?.entities?.[0]?.images?.[0] : undefined
    const wikiId = wikiResult.status === 'fulfilled' ? wikiResult.value?.pages?.[0]?.id : undefined
    return {
        ...taxon,
        birdImg: rawImg ? `${rawImg}?q=75&fm=jpg&w=400&fit=max` : undefined,
        wikiURL: wikiId ? `https://en.wikipedia.org/?curid=${wikiId}` : undefined
    }
}

// Returns full bird records for the given species codes, in the same order. Codes we have in
// our own database are served from there; the rest are assembled from external sources.
const getBirdsData = async (codes) => {
    const known = await getBirdsByCodes(codes)
    const byCode = new Map(known.map(bird => [bird.speciesCode, bird]))
    return Promise.all(codes.map(code => byCode.get(code) || enrichFromExternal(code)))
}

export {
    getCurrentUser,
    getUserExists,
    login,
    signup,
    logout,
    requestPasswordReset,
    resetPassword,
    confirmEmail,
    resendConfirmationEmail,
    unsubscribe,
    patchUser,
    getSavedBirds,
    postSavedBird,
    deleteSavedBird,
    getBirdsByCodes,
    searchBirds,
    getBirdKeysByLocation,
    getBirdsData,
    getBirdObservationsByLocation,
    getExternalRegions,
    getExternalNotableBirds,
    getExternalLastObserved
}
