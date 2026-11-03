import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, deleteEventRoutePlan, putEventRoutePlan } from '../../apiCalls'
import { useEventRoutePlanQuery } from '../../hooks/queries'
import { clearLegacyRoute, readLegacyRoute } from './routeChoices'
import type { EventRoutePlan, Id } from '../../types'

export type RoutePlan = Pick<EventRoutePlan, 'start' | 'stops'>
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

const SAVE_DELAY_MS = 800

const isPlan = (v: unknown): v is EventRoutePlan => Boolean(v) && typeof v === 'object' && typeof (v as EventRoutePlan).version === 'number'
/** A 409's answer: the record someone else saved since. */
const theirs = (error: unknown): EventRoutePlan | null => {
  const current = error instanceof ApiError && error.status === 409 && error.data && typeof error.data === 'object' ? (error.data as { current?: unknown }).current : null
  return isPlan(current) ? current : null
}

/**
 * The group's route for an event, kept on the event: every member sees and edits the same one.
 * Edits show at once and are saved a moment after the last one (with the version they were made
 * on). Someone else's newer save wins: their route comes in and this viewer's unsaved edit is
 * dropped, with a line saying who changed it. A failed save keeps the edit on screen to retry.
 */
export const useGroupRoute = (eventId: Id, open: boolean, editing: boolean) => {
  const queryClient = useQueryClient()
  const key = ['event-route-plan', eventId] as const
  const [draft, setDraft] = useState<RoutePlan | null>(null)
  const [status, setStatus] = useState<SaveStatus>('idle')
  /** Someone else's save replaced this viewer's edit: their record, for saying who. */
  const [note, setNote] = useState<EventRoutePlan | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef<RoutePlan | null>(null)
  const quiet = editing || draft !== null || status === 'saving'
  const query = useEventRoutePlanQuery(eventId, open, quiet)
  const saved = query.data

  // Someone else's record arrived instead of ours: show theirs and say whose it is.
  const takeTheirs = (record: EventRoutePlan) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    queryClient.setQueryData(key, record)
    draftRef.current = null
    setDraft(null)
    setStatus('idle')
    setNote(record)
    queryClient.invalidateQueries({ queryKey: ['event-route', eventId] })
  }

  const save = async () => {
    const sent = draftRef.current
    if (!sent) return
    const version = queryClient.getQueryData<EventRoutePlan>(key)?.version ?? 0
    setStatus('saving')
    try {
      // Only what the group chose goes back: the place and its minutes (null: the suggestion's).
      const stops = sent.stops?.map(({ locId, name, lat, lng, stay_min }) => ({ locId, name, lat, lng, stay_min: stay_min ?? null })) ?? null
      const record = await putEventRoutePlan(eventId, { start: sent.start, stops, version })
      queryClient.setQueryData(key, record)
      if (draftRef.current === sent) { draftRef.current = null; setDraft(null) }
      setStatus('saved')
      // The suggestion starts at the saved meeting point.
      if (JSON.stringify(sent.start) !== JSON.stringify(saved?.start ?? null)) queryClient.invalidateQueries({ queryKey: ['event-route', eventId] })
    } catch (error) {
      const current = theirs(error)
      if (current) takeTheirs(current)
      else setStatus('failed')
    }
  }

  /** An edit: on screen now, saved a moment after the last one. */
  const edit = (next: RoutePlan) => {
    draftRef.current = next
    setDraft(next)
    setNote(null)
    setStatus('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = null; void save() }, SAVE_DELAY_MS)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  /** Back to the suggestion, for the whole group. */
  const [resetting, setResetting] = useState(false)
  const reset = async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setResetting(true)
    try {
      const record = await deleteEventRoutePlan(eventId, queryClient.getQueryData<EventRoutePlan>(key)?.version ?? 0)
      queryClient.setQueryData(key, isPlan(record) ? record : { start: null, stops: null, version: 0 })
      draftRef.current = null
      setDraft(null)
      setStatus('idle')
      setNote(null)
      queryClient.invalidateQueries({ queryKey: ['event-route', eventId] })
      return true
    } catch (error) {
      const current = theirs(error)
      if (current) takeTheirs(current)
      else setStatus('failed')
      return false
    } finally {
      setResetting(false)
    }
  }

  // A route made on this device before routes were shared: offered once to the group, when the
  // group has none of its own; the old copy goes either way.
  const [legacy, setLegacy] = useState(() => readLegacyRoute(eventId))
  const groupHasStops = Boolean(saved && saved.stops !== null)
  useEffect(() => { if (legacy && groupHasStops) clearLegacyRoute(eventId) }, [legacy, groupHasStops, eventId])
  const offer = legacy && saved && !groupHasStops && !draft ? legacy : null
  const acceptOffer = () => { if (offer) edit({ start: offer.start ?? saved?.start ?? null, stops: offer.stops }); clearLegacyRoute(eventId); setLegacy(null) }
  const declineOffer = () => { clearLegacyRoute(eventId); setLegacy(null) }

  const current: RoutePlan | null = draft ?? (saved && (saved.stops !== null || saved.start) ? { start: saved.start, stops: saved.stops } : null)
  return {
    query, saved, current, status, note,
    /** An edit is waiting to be saved, so the saved record's drive times are for other stops. */
    unsaved: draft !== null, retry: () => void save(), edit, reset, resetting,
    offer, acceptOffer, declineOffer
  }
}
