import type { BeforeSendEvent } from '@vercel/analytics/react'

/**
 * Page views for Vercel Web Analytics, with nothing personal in them: the one-time tokens in
 * reset, confirm and unsubscribe links are blanked, and query strings are dropped.
 */
export const redactPageView = (event: BeforeSendEvent): BeforeSendEvent | null => {
  try {
    const url = new URL(event.url)
    url.pathname = url.pathname.replace(/^\/(reset|confirm|unsubscribe)\/[^/]+/, '/$1/[token]')
    url.search = ''
    url.hash = ''
    return { ...event, url: url.toString() }
  } catch {
    return null
  }
}
