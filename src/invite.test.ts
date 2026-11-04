import { describe, expect, it } from 'vitest'
import { mayNudge } from './invite'

const DAY = 86_400_000
const now = Date.parse('2026-11-04T12:00:00Z')
const base = { createdAt: new Date(now - 10 * DAY).toISOString(), now, pathname: '/', eventToday: false, done: false }

describe('mayNudge', () => {
  it('shows for an account past its first 3 days', () => {
    expect(mayNudge(base)).toBe(true)
  })
  it('never in the first 3 days, or without a signup date', () => {
    expect(mayNudge({ ...base, createdAt: new Date(now - 2.9 * DAY).toISOString() })).toBe(false)
    expect(mayNudge({ ...base, createdAt: undefined })).toBe(false)
  })
  it('never on event pages or on the day of an event', () => {
    expect(mayNudge({ ...base, pathname: '/events/7' })).toBe(false)
    expect(mayNudge({ ...base, eventToday: true })).toBe(false)
  })
  it('never again once answered', () => {
    expect(mayNudge({ ...base, done: true })).toBe(false)
  })
})
