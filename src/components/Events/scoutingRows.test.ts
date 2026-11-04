import { describe, expect, it } from 'vitest'
import { filterTargets, rarestFirst, showScoutingCard, sortTargets, targetRows } from './scoutingRows'
import type { EventScouting, ScoutingTarget } from '../../types'

const name = (code: string) => code.toUpperCase()

describe('target rows', () => {
  const event = { targets: [{ code: 'a' }, { code: 'b', lifer_for_you: true }, { code: 'c' }, { code: 'd' }], tally: [{ code: 'c' }] }

  it('takes the statuses from the server when it sends them', () => {
    const targets: ScoutingTarget[] = [
      { code: 'a', comName: 'Alpha', status: 'missing' },
      { code: 'b', comName: 'Beta', status: 'around', last_obs_dt: '2026-11-03 07:00', last_loc_name: 'Ramsey Canyon', aba: 3, lifer: false },
      { code: 'c', comName: 'Gamma', status: 'quiet' }
    ]
    const rows = targetRows(event, { using: 'targets', reported: [], unreported: [], targets }, name)
    expect(rows.map(r => [r.code, r.name, r.status, r.lifer, r.got])).toEqual([
      ['a', 'Alpha', 'missing', false, false],
      ['b', 'Beta', 'around', false, false],
      ['c', 'Gamma', 'quiet', false, true],
      ['d', 'D', null, false, false]
    ])
    expect(rows[1]).toMatchObject({ lastObsDt: '2026-11-03 07:00', lastLocName: 'Ramsey Canyon', aba: 3 })
  })

  it('works them out from the reports until the server sends them', () => {
    const scouting: Pick<EventScouting, 'reported' | 'unreported' | 'using'> = {
      using: 'targets',
      reported: [{ code: 'a', obsDt: '2026-11-01 08:00', locName: 'Old' }, { code: 'a', obsDt: '2026-11-03 08:00', locName: 'New' }],
      unreported: [{ code: 'd' }]
    }
    const rows = targetRows(event, scouting, name)
    expect(rows.map(r => r.status)).toEqual(['around', null, null, 'missing'])
    expect(rows[0]).toMatchObject({ lastObsDt: '2026-11-03 08:00', lastLocName: 'New' })
    expect(rows[1]!.lifer).toBe(true)
  })

  it('has no statuses before scouting has loaded', () => {
    expect(targetRows(event, undefined, name).every(r => r.status === null)).toBe(true)
  })
})

describe('sorting targets', () => {
  const row = (code: string, status: ScoutingTarget['status'] | null, over: Partial<{ lastObsDt: string; aba: number; lifer: boolean }> = {}) =>
    ({ code, name: code, status, lastObsDt: over.lastObsDt ?? null, lastLocName: null, aba: over.aba ?? null, lifer: over.lifer ?? false, got: false, target: { code } })

  it('around (newest first), then quiet, then missing, then unknown; rare birds and lifers first in each', () => {
    const sorted = sortTargets([
      row('missing1', 'missing'),
      row('unknown', null),
      row('quiet1', 'quiet'),
      row('aroundOld', 'around', { lastObsDt: '2026-11-01' }),
      row('missingLifer', 'missing', { lifer: true }),
      row('aroundNew', 'around', { lastObsDt: '2026-11-03' }),
      row('aroundRare', 'around', { lastObsDt: '2026-10-30', aba: 4 }),
      row('quietRare', 'quiet', { aba: 3 }),
      row('aroundCode2', 'around', { lastObsDt: '2026-11-04', aba: 2 })
    ])
    expect(sorted.map(r => r.code)).toEqual(['aroundRare', 'aroundCode2', 'aroundNew', 'aroundOld', 'quietRare', 'quiet1', 'missingLifer', 'missing1', 'unknown'])
  })

  it('filters by status and by name, ignoring case and accents', () => {
    const rows = [row('Colibrí', 'around'), row('Trogon', 'missing'), row('Wren', 'quiet')]
    expect(filterTargets(rows, 'around', '').map(r => r.code)).toEqual(['Colibrí'])
    expect(filterTargets(rows, 'missing', '').map(r => r.code)).toEqual(['Trogon'])
    expect(filterTargets(rows, 'all', 'colibri').map(r => r.code)).toEqual(['Colibrí'])
    expect(filterTargets(rows, 'around', 'trog')).toEqual([])
  })
})

describe('today\'s scouting', () => {
  it('lists the fresh reports rarest first, keeping the server\'s order among equals', () => {
    const fresh = [{ code: 'a', obsDt: 'x', aba: 2 }, { code: 'b', obsDt: 'x', aba: 5 }, { code: 'c', obsDt: 'x', aba: null }, { code: 'd', obsDt: 'x', aba: 2 }]
    expect(rarestFirst(fresh).map(f => f.code)).toEqual(['b', 'a', 'd', 'c'])
  })

  it('shows in the scouting window, and before the day whenever there is news', () => {
    const quiet = { using: 'targets', reported: [], unreported: [], fresh: [], headline: null, bird_of_day: null } as EventScouting
    const news = { ...quiet, headline: '3 exciting birds near Chiricahuas' }
    expect(showScoutingCard(quiet, { past: false, onDay: false, scouting: true })).toBe(true)
    expect(showScoutingCard(quiet, { past: false, onDay: false, scouting: false })).toBe(false)
    expect(showScoutingCard(news, { past: false, onDay: false, scouting: false })).toBe(true)
    expect(showScoutingCard(news, { past: false, onDay: true, scouting: false })).toBe(false)
    expect(showScoutingCard(news, { past: true, onDay: false, scouting: false })).toBe(false)
  })
})
