import { describe, expect, it } from 'vitest'
import { redactPageView } from './analytics'

const view = (url: string) => redactPageView({ type: 'pageview', url })?.url

describe('page views', () => {
  it('blank one-time tokens and drop query strings', () => {
    expect(view('https://bird-alert.vercel.app/reset/eyJhbGciOi.abc.def')).toBe('https://bird-alert.vercel.app/reset/[token]')
    expect(view('https://bird-alert.vercel.app/unsubscribe/tok123?x=1')).toBe('https://bird-alert.vercel.app/unsubscribe/[token]')
    expect(view('https://bird-alert.vercel.app/sightings?s=cangoo:S1#top')).toBe('https://bird-alert.vercel.app/sightings')
    expect(view('https://bird-alert.vercel.app/share/r/abc123defg')).toBe('https://bird-alert.vercel.app/share/r/abc123defg')
  })
})
