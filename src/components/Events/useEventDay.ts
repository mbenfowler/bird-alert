import { useEffect, useMemo, useState } from 'react'
import { useEventRoutePlanQuery, useEventRouteQuery, useEventScoutingQuery } from '../../hooks/queries'
import { sunTimes } from '../../solar'
import { usePendingTally, withPending } from '../../tallySync'
import type { GroupEvent } from '../../types'
import { speciesByPlace } from './customRoute'
import { dayRoute, dayState, plannedTimes, readProgress, safeZone, scheduleStart, writeProgress, zoneOffsetMin, zonedInstant, type DayProgress } from './daySchedule'

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
  const plan = useEventRoutePlanQuery(event.id, enabled, false)
  const suggestedQuery = useEventRouteQuery(event.id, enabled)
  const scouting = useEventScoutingQuery(enabled ? event.id : null)
  const pending = usePendingTally(event.id)
  const tally = withPending(event.tally, pending)
  const tallyCodes = tally.map(entry => entry.code)
  const targets = event.targets.map(target => target.code)
  const timeZone = safeZone(event.timezone)
  const day = event.starts_on
  const [progress, setProgressState] = useState<DayProgress>(() => readProgress(event.id))
  const setProgress = (next: DayProgress) => { writeProgress(event.id, next); setProgressState(next) }
  const now = useNow()

  const route = useMemo(() => {
    const base = dayRoute(plan.data, suggestedQuery.data)
    if (!base) return null
    const speciesAt = speciesByPlace(suggestedQuery.data, scouting.data?.reported ?? [])
    return { ...base, stops: base.stops.map(stop => ({ ...stop, species: [...new Set([...stop.species, ...speciesAt(stop.locId)])] })) }
  }, [plan.data, suggestedQuery.data, scouting.data?.reported])

  const stops = route?.stops ?? []
  const startAt = scheduleStart(progress, day, timeZone)
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
    route, stops, planned, state, progress, setProgress, now, sun, timeZone, tally, tallyCodes, targets,
    loading: enabled && (plan.isPending || suggestedQuery.isPending) && !route,
    failed: enabled && !route && (plan.isError || suggestedQuery.isError),
    error: plan.error ?? suggestedQuery.error
  }
}

export type EventDay = ReturnType<typeof useEventDay>
