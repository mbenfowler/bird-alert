import { lazy, type ComponentType } from 'react'

const RELOADED_KEY = 'bird-alert-chunk-reload'

/**
 * `lazy()` for route chunks that survives a deploy. A page that has been open since before a
 * release still asks for the old chunk names, which no longer exist; the server then answers the
 * request for JavaScript with an HTML page and the import fails. Reload once to pick up the new
 * build, and only once, so a real outage ends in the error view rather than a reload loop.
 */
export const lazyWithReload = <T extends ComponentType<unknown>>(importer: () => Promise<{ default: T }>) =>
  lazy(() => importer().then((module) => {
    try { sessionStorage.removeItem(RELOADED_KEY) } catch { /* storage unavailable */ }
    return module
  }).catch((error: unknown) => {
    const alreadyReloaded = () => {
      try {
        if (sessionStorage.getItem(RELOADED_KEY) === '1') return true
        sessionStorage.setItem(RELOADED_KEY, '1')
        return false
      } catch { return true } // storage unavailable: no way to stop a loop, so do not start one
    }
    if (alreadyReloaded()) throw error
    window.location.reload()
    // The page is going away; keep the suspense fallback up until it does.
    return new Promise<{ default: T }>(() => undefined)
  }))
