import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useEventRoutePlanQuery, useEventRouteQuery, useEventScoutingQuery } from '../../hooks/queries'
import { sunTimes } from '../../solar'
import { usePendingTally, withPending } from '../../tallySync'
import { queuePosition, suggestionAsRoute, usePendingPosition } from '../../routeSync'
import type { GroupEvent } from '../../types'
import { speciesByPlace } from './customRoute'
import { dayRoute, dayState, plannedTimes, progressFrom, safeZone, scheduleStart, zoneOffsetMin, zonedInstant } from './daySchedule'

/** The time now, ticking every 15 seconds (enough for "38 of 45 min"). */
export const useNow = (everyMs = 15_000) => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs)
    const wake = () => { if (document.visibilityState === 'visible') setNow(new Date()) }
    document.addEventListener('visibilitychange', wake)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', wake) }
  }, [everyMs])
  return now
}

/** On the day: the server says it's one of its days, or the tally still takes late adds. */
export const isEventDay = (event: Pick<GroupEvent, 'active' | 'tally_open'>) => Boolean(event.active || event.tally_open)

/**
 * Everything the day view reads, from what's saved on the phone: the group's route (or the
 * suggestion), each stop's reported targets, the tally with this phone's unsent changes, the
 * planned times, where the day stands now, and the sun.
 */
export const useEventDay = (event: GroupEvent, enabled: boolean) => {
  const plan = useEventRoutePlanQuery(event.id, enabled, false, enabled && isEventDay(event))
  const suggestedQuery = useEventRouteQuery(event.id, enabled)
  const scouting = useEventScoutingQuery(enabled ? event.id : null)
  const pending = usePendingTally(event.id)
  const tally = withPending(event.tally, pending)
  const tallyCodes = tally.map(entry => entry.code)
  const targets = event.targets.map(target => target.code)
  const timeZone = safeZone(event.timezone)
  const day = event.starts_on
  // Where the group is: the group's shared position, or this phone's own tap while it waits to be sent.
  const queryClient = useQueryClient()
  const waiting = usePendingPosition(event.id)
  const position = waiting
    ? { stop: waiting.stop, at: waiting.at, by_you: true, by_name: event.display_name ?? null, pending: true }
    : plan.data?.position ? { ...plan.data.position, pending: false } : null
  const progress = progressFrom(position)
  /** "We're here" at a stop (-1: the meeting point; null: start over), for the whole group. */
  // A route that's still only the suggestion is saved as the group's first (in the same queue, so offline too).
  const setPosition = (stop: number | null) => { queuePosition(queryClient, { id: event.id, stop, ensure: plan.data?.stops ? null : suggestionAsRoute(queryClient, event.id) }) }
  const now = useNow()

  const route = useMemo(() => {
    const base = dayRoute(plan.data, suggestedQuery.data)
    if (!base) return null
    const speciesAt = speciesByPlace(suggestedQuery.data, scouting.data?.reported ?? [])
    return { ...base, stops: base.stops.map(stop => ({ ...stop, species: [...new Set([...stop.species, ...speciesAt(stop.locId)])] })) }
  }, [plan.data, suggestedQuery.data, scouting.data?.reported])

  const stops = route?.stops ?? []
  const meetAt = plan.data?.start?.time ?? null
  const startAt = scheduleStart(meetAt, day, timeZone)
  const planned = plannedTimes(stops, startAt)
  const state = dayState(stops, planned, progress, now, Boolean(route?.start))

  // The sun where the day starts: the meeting point, else the first stop, else the event's own spot.
  const where = route?.start ?? stops[0] ?? (typeof event.home_lat === 'number' && typeof event.home_lng === 'number' ? { lat: event.home_lat, lng: event.home_lng } : null)
  const sun = useMemo(() => {
    if (!where) return null
    const noon = timeZone ? zonedInstant(day, '12:00', timeZone) : new Date(`${day}T12:00:00`)
    const offset = timeZone ? zoneOffsetMin(noon, timeZone) : -noon.getTimezoneOffset()
    return sunTimes(day, where.lat, where.lng, offset)
  }, [where?.lat, where?.lng, day, timeZone]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    route, stops, planned, state, progress, position, setPosition, meetAt, startAt, now, sun, timeZone, tally, tallyCodes, targets,
    loading: enabled && (plan.isPending || suggestedQuery.isPending) && !route,
    failed: enabled && !route && (plan.isError || suggestedQuery.isError),
    error: plan.error ?? suggestedQuery.error
  }
}

export type EventDay = ReturnType<typeof useEventDay>
