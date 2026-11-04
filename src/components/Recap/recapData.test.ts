import { describe, expect, it } from 'vitest'
import type { Recap } from '../../types'
import { membersRecap, publicRecap } from './recapFixture'
import { clockMin, crewLine, curveFrame, curvePoints, dayStrip, gridLines, liferLine, liferTally, liferWho, nearestIndex, normalizeRecap, redactForPublic, stopBands, timeTicks, tipPlacement, VIEW } from './recapData'
import { cardLines, cardSafe } from './shareCard'

const ZONE = 'America/Phoenix'
const members = normalizeRecap(membersRecap())
const shared = normalizeRecap(publicRecap())
const mins = members.timeline.map(row => clockMin(row.at, ZONE, members.event.startsOn))
const frame = curveFrame(mins, members.totals.species)
const points = curvePoints(members, frame, ZONE)

describe('a thin recap', () => {
  it('still draws: every list a list, every count a number', () => {
    const thin = normalizeRecap({ audience: 'members', status: 'open', event: { id: 1, name: 'Quiet day', kind: 'big_day', startsOn: '2026-11-10', endsOn: '2026-11-10' } } as unknown as Recap)
    expect(thin.timeline).toEqual([])
    expect(thin.lifers).toEqual([])
    expect(thin.stops).toEqual([])
    expect(thin.totals).toMatchObject({ species: 0, stops: 0, miles: null, firstBird: null, bestStop: null })
    expect(thin.targets).toEqual({ total: 0, found: 0, missed: [] })
    expect(thin.route.line).toBeNull()
    expect(curveFrame([], 0)).toMatchObject({ start: 300, end: 1200, max: 1 })
  })

  it('numbers the birds in the order found, whatever order they came in', () => {
    const shuffled = normalizeRecap(membersRecap({ timeline: [...membersRecap().timeline].reverse() }))
    expect(shuffled.timeline[0]!.comName).toBe('Great Horned Owl')
    expect(shuffled.timeline.map(r => r.n)).toEqual(members.timeline.map((_, i) => i + 1))
  })
})

describe('the curve', () => {
  it('reads times in the event’s own zone, after midnight UTC too', () => {
    expect(clockMin('2026-11-10T12:41:00Z', ZONE, '2026-11-10')).toBe(5 * 60 + 41)
    expect(clockMin('2026-11-11T01:52:00Z', ZONE, '2026-11-10')).toBe(18 * 60 + 52)
    expect(clockMin('2026-11-11T15:00:00Z', ZONE, '2026-11-10')).toBe(24 * 60 + 8 * 60)
  })

  it('runs from the first bird’s hour to the last one’s, and from none to the day’s count', () => {
    expect(frame.start).toBe(5 * 60)
    expect(frame.end).toBe(19 * 60)
    expect(frame.x(frame.start)).toBe(VIEW.left)
    expect(frame.x(frame.end)).toBe(VIEW.right)
    expect(frame.y(0)).toBe(VIEW.base)
    expect(frame.y(92)).toBe(VIEW.top)
  })

  it('climbs left to right, one point a bird', () => {
    expect(points).toHaveLength(92)
    expect(points.every((p, i) => i === 0 || (p.x >= points[i - 1]!.x && p.y < points[i - 1]!.y))).toBe(true)
  })

  it('has grid lines at round counts, never above the top', () => {
    expect(gridLines(92)).toEqual([30, 60, 90])
    expect(gridLines(5)).toEqual([2, 4])
    expect(gridLines(0)).toEqual([])
  })

  it('marks every other hour on a long day, every hour on a short one, and midnights over days', () => {
    const day = timeTicks(frame)
    expect(day.map(tick => tick.min / 60)).toEqual([5, 7, 9, 11, 13, 15, 17, 19])
    expect(day.map(tick => tick.major)).toEqual([true, false, true, false, true, false, true, false])
    expect(timeTicks({ start: 360, end: 540 }).map(tick => tick.min / 60)).toEqual([6, 7, 8, 9])
    const trip = timeTicks({ start: 360, end: 3 * 1440 + 600 })
    expect(trip.map(tick => tick.min / 1440)).toEqual([1, 2, 3])
    expect(trip.every(tick => tick.daily)).toBe(true)
  })

  it('shades each stop from arriving to leaving, the best one darker', () => {
    const bands = stopBands(members, frame, points, ZONE)
    expect(bands).toHaveLength(6)
    expect(bands[0]!.x0).toBeCloseTo(frame.x(6 * 60 + 20))
    expect(bands[0]!.x1).toBeCloseTo(frame.x(8 * 60))
    expect(bands.filter(b => b.best).map(b => b.name)).toEqual(['Whitewater Draw'])
  })
})

describe('the bird nearest a finger', () => {
  const xs = [{ x: 10 }, { x: 20 }, { x: 30 }]

  it('picks the nearest point across, a tie going to the earlier bird', () => {
    expect(nearestIndex(xs, 24)).toBe(1)
    expect(nearestIndex(xs, 25)).toBe(1)
    expect(nearestIndex(xs, 26)).toBe(2)
    expect(nearestIndex(xs, -5)).toBe(0)
    expect(nearestIndex(xs, 500)).toBe(2)
    expect(nearestIndex([], 5)).toBe(-1)
  })

  it('finds #27, the Bridled Titmouse, at 7:31 AM', () => {
    const i = nearestIndex(points, frame.x(7 * 60 + 31))
    expect(points[i]!.row.n).toBe(27)
    expect(points[i]!.row.comName).toBe('Bridled Titmouse')
  })

  it('puts the label beside the dot near the edges and centred between, below high points and above low ones', () => {
    expect(tipPlacement(5, 230)).toMatchObject({ side: 'right', below: false, transform: 'translate(-8%, calc(-100% - 16px))' })
    expect(tipPlacement(95, 40)).toMatchObject({ side: 'left', below: true, transform: 'translate(-92%, 16px)' })
    expect(tipPlacement(50, 100).transform).toBe('translate(-50%, 16px)')
    expect(tipPlacement(50, 200).transform).toBe('translate(-50%, calc(-100% - 16px))')
  })
})

describe('the day, sunrise to sunset', () => {
  it('lights the sun’s hours and marks the first and last birds, 5 AM to 8 PM', () => {
    const strip = dayStrip(members, ZONE)!
    expect(strip.start).toBe(300)
    expect(strip.end).toBe(1200)
    // Sunrise near 6:45 AM in Cochise County on Nov 10; sunset near 5:25 PM.
    expect(strip.at.sunrise!).toBeGreaterThan(10)
    expect(strip.at.sunrise!).toBeLessThan(13)
    expect(strip.at.sunset!).toBeGreaterThan(80)
    expect(strip.at.sunset!).toBeLessThan(84)
    expect(strip.at.first!).toBeCloseTo(4.56, 1)
    expect(strip.at.last!).toBeCloseTo(92.44, 1)
  })

  it('has no sun without a place', () => {
    const strip = dayStrip(normalizeRecap(membersRecap({ event: { ...membersRecap().event, lat: null, lng: null } })), ZONE)!
    expect(strip.sunrise).toBeNull()
    expect(strip.at.sunrise).toBeNull()
  })
})

describe('names: members see them, the link never does', () => {
  const robin = members.timeline.find(r => r.comName === 'Rufous-backed Robin')!

  it('says whose lifer it was to members, and the group’s to the public', () => {
    expect(liferLine(robin, 'members')).toBe('Lifer for Kirin and Matt')
    expect(liferLine(shared.timeline.find(r => r.comName === 'Rufous-backed Robin')!, 'public')).toBe('A lifer for the group')
    expect(liferLine(members.timeline[0]!, 'members')).toBeNull()
    expect(liferWho(members.lifers[2]!, 'members')).toBe('Kirin’s lifer #210')
    expect(liferWho({ who: 'Kirin', number: null }, 'members')).toBe('Kirin’s lifer')
    expect(liferWho(shared.lifers[2]!, 'public')).toBe('A lifer for one of the group')
  })

  it('names the crew and the lifer counts for members only', () => {
    expect(crewLine(members)).toBe('Matt (organizer) · Kirin')
    expect(crewLine(shared)).toBe('A group of birders, with Bird Alert')
    expect(liferTally(members)).toBe('Kirin 5 · Matt 2')
    expect(liferTally(shared)).toBeNull()
  })

  it('previews the link with no names anywhere', () => {
    const preview = redactForPublic(members)
    expect(preview.audience).toBe('public')
    expect(preview.shareCode).toBeUndefined()
    expect(JSON.stringify(preview)).not.toMatch(/Kirin|Matt/)
    expect(JSON.stringify(shared)).not.toMatch(/Kirin|Matt/)
  })

  it('keeps personal spots off the public view', () => {
    expect(shared.timeline[0]!.place).toBeNull()
    expect(shared.timeline.find(r => r.comName === 'Bridled Titmouse')!.place).toBe('Ramsey Canyon')
  })

  it('puts the public view on the share card, with places only the server says are public', () => {
    expect(cardLines(shared)).toEqual([
      { text: 'Rufous-backed Robin, San Pedro House', aba: 3 },
      { text: 'Lewis\'s Woodpecker, just as the scouting said' },
      { text: 'Whiskered Screech-Owl to close it out' }
    ])
    expect(cardLines(cardSafe(members))[0]).toEqual({ text: 'Rufous-backed Robin', aba: 3 })
  })
})
