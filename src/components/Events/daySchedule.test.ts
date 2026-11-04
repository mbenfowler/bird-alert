import { describe, expect, it } from 'vitest'
import { appleDirections, dayRoute, dayState, googleDirections, groupLog, notOnMyChecklist, plannedTimes, readProgress, scheduleStart, stillNeededAt, trimSuggestion, writeProgress, zonedDay, zonedHhmm, zonedInstant, zoneOffsetMin, type DayStop } from './daySchedule'
import type { EventLogEntry, EventRoutePlan, EventTallyEntry } from '../../types'

const AZ = 'America/Phoenix'
const at = (iso: string) => new Date(iso)
const stop = (index: number, name: string, legMin: number | null, stayMin: number, species: string[] = []): DayStop => ({ index, locId: `L${index}`, name, lat: 31.4 + index / 100, lng: -110.3, stayMin, legMin, legMi: legMin, species })

describe('the event time zone', () => {
  it('reads the day and the clock in the event zone, not the phone', () => {
    const lateEvening = at('2026-11-11T05:30:00Z') // 10:30 PM in Arizona, Nov 10
    expect(zonedDay(lateEvening, AZ)).toBe('2026-11-10')
    expect(zonedHhmm(lateEvening, AZ)).toBe('22:30')
    expect(zoneOffsetMin(lateEvening, AZ)).toBe(-420)
  })

  it('turns a meeting time on the day into the moment', () => {
    expect(zonedInstant('2026-11-10', '05:30', AZ).toISOString()).toBe('2026-11-10T12:30:00.000Z')
    // A zone with daylight time, on the day it ends.
    expect(zonedInstant('2026-11-01', '12:00', 'America/New_York').toISOString()).toBe('2026-11-01T17:00:00.000Z')
  })
})

describe('the schedule', () => {
  const stops = [stop(0, 'Ramsey Canyon', 30, 45), stop(1, 'Carr Canyon', 20, 60), stop(2, 'San Pedro House', 25, 30)]
  const start = zonedInstant('2026-11-10', '05:30', AZ)
  const planned = plannedTimes(stops, start)

  it('plans each stop from the start, each drive and each stay', () => {
    expect(planned.map(p => [zonedHhmm(p.arrive, AZ), zonedHhmm(p.leave, AZ)])).toEqual([['06:00', '06:45'], ['07:05', '08:05'], ['08:30', '09:00']])
    expect(plannedTimes(stops, null)).toEqual([])
  })

  it('counts a drive it has no time for as nothing', () => {
    expect(plannedTimes([stop(0, 'A', null, 30)], start).map(p => zonedHhmm(p.arrive, AZ))).toEqual(['05:30'])
  })

  it('starts the clock at the meeting time, else when the day was started', () => {
    expect(scheduleStart({ meetAt: '05:30' }, '2026-11-10', AZ)?.toISOString()).toBe('2026-11-10T12:30:00.000Z')
    expect(scheduleStart({ startedAt: '2026-11-10T13:00:00.000Z' }, '2026-11-10', AZ)?.toISOString()).toBe('2026-11-10T13:00:00.000Z')
    expect(scheduleStart({}, '2026-11-10', AZ)).toBeNull()
  })

  it('times the stay at a stop: 38 of 45 minutes, on schedule', () => {
    const progress = { meetAt: '05:30', startedAt: '2026-11-10T12:30:00Z', at: 0, arrivedAt: '2026-11-10T13:00:00Z' }
    const state = dayState(stops, planned, progress, at('2026-11-10T13:38:00Z'), true)
    expect(state).toMatchObject({ phase: 'at', at: 0, next: 1, minutesHere: 38, stayMin: 45, over: false, behindMin: 0 })
  })

  it('says when the stay is over and how far behind that puts the day', () => {
    const progress = { meetAt: '05:30', at: 0, arrivedAt: '2026-11-10T13:10:00Z' }
    // Arrived 10 minutes late, and still there 5 minutes after the stay ran out.
    const state = dayState(stops, planned, progress, at('2026-11-10T14:00:00Z'), true)
    expect(state.over).toBe(true)
    expect(state.behindMin).toBe(15)
  })

  it('counts ahead as negative', () => {
    const progress = { meetAt: '05:30', at: 1, arrivedAt: '2026-11-10T13:50:00Z' }
    expect(dayState(stops, planned, progress, at('2026-11-10T13:55:00Z'), true).behindMin).toBe(-15)
  })

  it('is behind on the way to the first stop once the drive runs past its time', () => {
    const progress = { meetAt: '05:30', startedAt: '2026-11-10T12:45:00Z' }
    const state = dayState(stops, planned, progress, at('2026-11-10T13:05:00Z'), true)
    expect(state).toMatchObject({ phase: 'driving', next: 0 })
    expect(state.behindMin).toBe(15)
  })

  it('is behind before starting once the meeting time has passed', () => {
    expect(dayState(stops, planned, { meetAt: '05:30' }, at('2026-11-10T12:50:00Z'), true)).toMatchObject({ phase: 'before', behindMin: 20 })
    expect(dayState(stops, planned, { meetAt: '05:30' }, at('2026-11-10T12:00:00Z'), true).behindMin).toBeNull()
  })

  it('offers to trim the later stop with the fewest birds still needed', () => {
    const needed: Record<string, number> = { L1: 1, L2: 3 }
    expect(trimSuggestion(stops, 0, s => needed[s.locId!] ?? 0)?.name).toBe('Carr Canyon')
    expect(trimSuggestion(stops, 2, () => 0)).toBeNull()
  })
})

describe('targets still needed at a stop', () => {
  it('is the targets reported there minus the tally, crossed off as they are found', () => {
    const here = stop(0, 'Ramsey Canyon', 30, 45, ['eletro', 'heptan', 'mexchi', 'norcar'])
    const targets = ['eletro', 'heptan', 'mexchi']
    expect(stillNeededAt(here, targets, [])).toEqual(['eletro', 'heptan', 'mexchi'])
    expect(stillNeededAt(here, targets, ['heptan'])).toEqual(['eletro', 'mexchi'])
  })
})

describe('the route of the day', () => {
  const plan: EventRoutePlan = {
    start: { name: 'Sierra Vista', lat: 31.55, lng: -110.3 },
    stops: [{ locId: 'L1', name: 'Ramsey Canyon', lat: 31.44, lng: -110.3, stay_min: null, suggested_stay_min: 45 }, { locId: null, name: 'Gas', lat: 31.5, lng: -110.2, stay_min: 10 }],
    version: 2,
    legs: [{ min: 25, mi: 12 }, null]
  }

  it('takes the group route with its stays and drive times, and each stop’s reported targets from the suggestion', () => {
    const route = dayRoute(plan, { from: null, stops: [{ n: 1, locId: 'L1', locName: 'Ramsey', lat: 1, lng: 1, new_birds: [], leg_min: 1, leg_mi: 1, species: ['eletro'] }], total_min: 0, total_mi: 0, covered: 0, reported: 0, skipped: 0, geometry: [], routed: true })!
    expect(route.custom).toBe(true)
    expect(route.stops.map(s => [s.name, s.stayMin, s.legMin, s.species])).toEqual([['Ramsey Canyon', 45, 25, ['eletro']], ['Gas', 10, null, []]])
  })

  it('falls back to the suggested route, and has nothing with neither', () => {
    const route = dayRoute({ start: null, stops: null, version: 0 }, { from: null, stops: [{ n: 1, locId: 'L9', locName: 'Carr', lat: 1, lng: 1, new_birds: [{ code: 'heptan' }], leg_min: 12, leg_mi: 5, suggested_stay_min: 30 }], total_min: 0, total_mi: 0, covered: 0, reported: 0, skipped: 0, geometry: [], routed: true })!
    expect(route.custom).toBe(false)
    expect(route.stops[0]).toMatchObject({ name: 'Carr', stayMin: 30, legMin: 12, species: ['heptan'] })
    expect(dayRoute(undefined, undefined)).toBeNull()
  })

  it('links directions in Google and Apple Maps', () => {
    expect(googleDirections({ lat: 31.4, lng: -110.3 })).toBe('https://www.google.com/maps/dir/?api=1&destination=31.4,-110.3&travelmode=driving')
    expect(appleDirections({ lat: 31.4, lng: -110.3 })).toBe('https://maps.apple.com/?daddr=31.4,-110.3&dirflg=d')
  })
})

describe('progress on this phone', () => {
  it('is kept per event, and survives junk', () => {
    writeProgress(2, { at: 1, arrivedAt: '2026-11-10T14:00:00Z' })
    expect(readProgress(2)).toEqual({ at: 1, arrivedAt: '2026-11-10T14:00:00Z' })
    expect(readProgress(3)).toEqual({})
    localStorage.setItem('bird-alert:event-day:2', '{nope')
    expect(readProgress(2)).toEqual({})
  })
})

describe('the group log', () => {
  const tally: (EventTallyEntry & { pending?: boolean; clientId?: string })[] = [
    { id: 1, code: 'eletro', added_by_name: 'Sam', added_at: '2026-11-10T14:42:30Z', observed_at: '2026-11-10T14:42:00Z', stop_name: 'Ramsey Canyon' },
    // Kim was out of signal: seen at 7:15, reached the server at 9:00.
    { id: 2, code: 'heptan', added_by_name: 'Kim', added_at: '2026-11-10T16:00:00Z', observed_at: '2026-11-10T14:15:00Z' },
    { id: 3, code: 'mexchi', added_by_you: true, added_by_name: 'Matt', added_at: '2026-11-10T15:00:00Z', observed_at: '2026-11-10T15:00:00Z', marked_by_me: false },
    { code: 'acowoo', added_by_you: true, added_at: '2026-11-10T16:10:00Z', pending: true, clientId: 'c1' }
  ]
  const log: EventLogEntry[] = [
    { id: 1, speciesCode: 'eletro', comName: 'Elegant Trogon', by_name: 'Sam', observed_at: '2026-11-10T14:42:00Z', stop_name: 'Ramsey Canyon' },
    { id: 3, speciesCode: 'mexchi', comName: 'Mexican Chickadee', by_name: 'Matt', observed_at: '2026-11-10T15:00:00Z' },
    { id: 4, speciesCode: 'norcar', comName: 'Northern Cardinal', by_name: 'Sam', observed_at: '2026-11-10T15:30:00Z', removed: true },
    { id: 2, speciesCode: 'heptan', comName: 'Hepatic Tanager', by_name: 'Kim', observed_at: '2026-11-10T14:15:00Z' }
  ]

  it('is in the order seen, a late-synced bird slotted in where it was seen and marked', () => {
    const rows = groupLog(log, tally)
    expect(rows.map(r => r.code)).toEqual(['heptan', 'eletro', 'mexchi', 'norcar', 'acowoo'])
    expect(rows.find(r => r.code === 'heptan')!.late).toBe(true)
    expect(rows.find(r => r.code === 'eletro')!.late).toBe(false)
    expect(rows.find(r => r.code === 'norcar')!.removed).toBe(true)
    expect(rows.find(r => r.code === 'acowoo')!.pending).toBe(true)
  })

  it('reads the same from the tally alone when no log is saved', () => {
    const rows = groupLog(undefined, tally)
    expect(rows.map(r => r.code)).toEqual(['heptan', 'eletro', 'mexchi', 'acowoo'])
    expect(rows[0]!.late).toBe(true)
  })
})

describe('not on my checklist yet', () => {
  it('is the birds others found that I haven’t ticked, in the order seen', () => {
    const tally: (EventTallyEntry & { pending?: boolean })[] = [
      { id: 1, code: 'eletro', added_by_name: 'Sam', added_at: 'x', observed_at: '2026-11-10T14:42:00Z' },
      { id: 2, code: 'heptan', added_by_name: 'Kim', added_at: 'x', observed_at: '2026-11-10T14:15:00Z' },
      { id: 3, code: 'mexchi', added_by_you: true, added_at: 'x', observed_at: '2026-11-10T15:00:00Z' },
      { id: 4, code: 'brncre', added_by_name: 'Sam', added_at: 'x', observed_at: '2026-11-10T15:10:00Z', marked_by_me: true },
      { code: 'acowoo', added_by_name: 'Sam', added_at: 'x', pending: true }
    ]
    expect(notOnMyChecklist(tally).map(e => e.code)).toEqual(['heptan', 'eletro'])
  })
})
