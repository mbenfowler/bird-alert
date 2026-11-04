import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteEventRoutePlan } from '../../apiCalls'
import { useEventRoutePlanQuery } from '../../hooks/queries'
import { useOnline } from '../../offline'
import { cancelRouteSaves, queueRouteSave, routeNoteKey, theirs, usePendingRouteSave } from '../../routeSync'
import { clearLegacyRoute, readLegacyRoute } from './routeChoices'
import type { EventRoutePlan, Id } from '../../types'

export type RoutePlan = Pick<EventRoutePlan, 'start' | 'stops'>
export type SaveStatus = 'idle' | 'saving' | 'waiting' | 'saved' | 'failed'

const SAVE_DELAY_MS = 800

/**
 * The group's route for an event, kept on the event: every member sees and edits the same one.
 * Edits show at once and are queued a moment after the last one (src/routeSync.ts): with no signal
 * they wait on the phone and go when it's back. Someone else's newer save wins: their route comes
 * in, this phone's edit is dropped, and a line says who changed it. Editing the suggestion saves it
 * as the group's route (version 0).
 */
export const useGroupRoute = (eventId: Id, open: boolean, live = false) => {
  const queryClient = useQueryClient()
  const online = useOnline()
  const key = ['event-route-plan', eventId] as const
  const [draft, setDraft] = useState<RoutePlan | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef<RoutePlan | null>(null)
  const pendingSave = usePendingRouteSave(eventId)
  const quiet = draft !== null || pendingSave !== null
  const query = useEventRoutePlanQuery(eventId, open, quiet, live)
  const saved = query.data
  // Someone else's save replaced this phone's edit: their record, for saying who.
  const noteQuery = useQuery({ queryKey: routeNoteKey(eventId), queryFn: () => null as EventRoutePlan | null, enabled: false, staleTime: Infinity })
  const note = noteQuery.data ?? null
  const [failed, setFailed] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // The draft stays on screen until the queue holds it (or the record has moved on), so nothing blinks.
  const queued = useRef<{ clientId: string; version: number } | null>(null)
  useEffect(() => {
    const q = queued.current
    if (!q || timer.current) return
    if (pendingSave?.clientId === q.clientId || (saved && saved.version !== q.version)) {
      queued.current = null
      draftRef.current = null
      setDraft(null)
    }
  }, [pendingSave, saved])
  // "Saved" once the last queued save has gone through.
  const pendingId = pendingSave?.clientId ?? null
  const [lastPendingId, setLastPendingId] = useState<string | null>(pendingId)
  if (lastPendingId !== pendingId) {
    setLastPendingId(pendingId)
    setJustSaved(pendingId === null)
  }

  const flush = () => {
    timer.current = null
    const sent = draftRef.current
    if (!sent) return
    const version = queryClient.getQueryData<EventRoutePlan>(key)?.version ?? 0
    const change = queueRouteSave(queryClient, { id: eventId, start: sent.start, stops: sent.stops, baseVersion: version })
    queued.current = { clientId: change.clientId, version }
  }

  /** An edit: on screen now, queued to be saved a moment after the last one. */
  const edit = (next: RoutePlan) => {
    draftRef.current = next
    setDraft(next)
    queryClient.setQueryData(routeNoteKey(eventId), null)
    setFailed(false)
    setJustSaved(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY_MS)
  }
  // Leaving the page with an edit still in its delay: queue it now rather than lose it.
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); flush() } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Back to the suggestion, for the whole group (needs signal). */
  const [resetting, setResetting] = useState(false)
  const reset = async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    cancelRouteSaves(queryClient, eventId)
    setResetting(true)
    try {
      const record = await deleteEventRoutePlan(eventId, queryClient.getQueryData<EventRoutePlan>(key)?.version ?? 0)
      const position = queryClient.getQueryData<EventRoutePlan>(key)?.position ?? null
      queryClient.setQueryData(key, record && typeof record === 'object' && 'version' in record ? record : { start: null, stops: null, version: 0, position })
      draftRef.current = null
      queued.current = null
      setDraft(null)
      setFailed(false)
      queryClient.setQueryData(routeNoteKey(eventId), null)
      queryClient.invalidateQueries({ queryKey: ['event-route', eventId] })
      return true
    } catch (error) {
      const current = theirs(error)
      if (current) { queryClient.setQueryData(key, current); queryClient.setQueryData(routeNoteKey(eventId), current) } else setFailed(true)
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

  const pendingPlan: RoutePlan | null = pendingSave ? { start: pendingSave.start, stops: pendingSave.stops as EventRoutePlan['stops'] } : null
  const current: RoutePlan | null = draft ?? pendingPlan ?? (saved && (saved.stops !== null || saved.start) ? { start: saved.start, stops: saved.stops } : null)
  const status: SaveStatus = failed ? 'failed' : draft ? 'idle' : pendingSave ? (online ? 'saving' : 'waiting') : justSaved ? 'saved' : 'idle'
  return {
    query, saved, current, status, note,
    /** An edit hasn't reached the server yet, so the saved record's drive times are for other stops. */
    unsaved: draft !== null || pendingSave !== null, edit, reset, resetting,
    offer, acceptOffer, declineOffer
  }
}
