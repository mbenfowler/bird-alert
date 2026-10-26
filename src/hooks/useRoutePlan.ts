import { useEffect, useRef, useState } from 'react'
import { useSavedRouteQuery } from './queries'
import { useSaveRouteMutation } from './mutations'
import { isSynced, loadPlan, loadStart, markSynced, savePlan, saveStart, type PlanPoint } from '../routePlan'

const SAVE_AFTER_MS = 800

/**
 * The person's own route for a county and where their day starts, kept on the account so they
 * follow them between devices. This browser keeps a copy too, which answers while the account's
 * copy loads; the first time a browser meets the account, its copy goes up so nothing made
 * before is lost. Edits save a moment after the last change, so a drag is one save, not ten.
 */
export const useRoutePlan = (region: string) => {
  const saved = useSavedRouteQuery(region)
  const save = useSaveRouteMutation()
  const mutate = useRef(save.mutate)
  useEffect(() => { mutate.current = save.mutate }, [save.mutate])

  // Changes made on this page, ahead of whatever the account last said.
  const [draft, setDraft] = useState<{ region: string; stops: PlanPoint[] | null } | null>(null)
  const [startDraft, setStartDraft] = useState<{ value: PlanPoint | null } | null>(null)

  const server = saved.data
  const trustServer = Boolean(server) && isSynced()
  const custom = draft?.region === region ? draft.stops : trustServer ? server!.stops : (server?.stops ?? loadPlan(region))
  const start = startDraft ? startDraft.value : trustServer ? server!.start : (server?.start ?? loadStart())

  // First meeting: hand this browser's copy to the account where the account has none.
  useEffect(() => {
    if (!server || isSynced()) return
    const stops = loadPlan(region)
    const first = loadStart()
    markSynced()
    const change = { region, ...(stops && !server.stops ? { stops } : {}), ...(first && !server.start ? { start: first } : {}) }
    if ('stops' in change || 'start' in change) mutate.current(change)
  }, [server, region])

  // Afterwards the account is the record, and this browser's copy follows it.
  useEffect(() => {
    if (!server || !isSynced()) return
    savePlan(server.region, server.stops)
    saveStart(server.start)
  }, [server])

  const pending = useRef<{ region: string; stops: PlanPoint[] | null } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (pending.current) { mutate.current(pending.current); pending.current = null }
  }
  const flushRef = useRef(flush)
  useEffect(() => { flushRef.current = flush })
  // Leaving the page (or the app) sends whatever is still waiting.
  useEffect(() => {
    const onHide = () => flushRef.current()
    window.addEventListener('pagehide', onHide)
    return () => { window.removeEventListener('pagehide', onHide); flushRef.current() }
  }, [])

  const setCustom = (stops: PlanPoint[] | null) => {
    setDraft({ region, stops })
    savePlan(region, stops)
    pending.current = { region, stops }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_AFTER_MS)
  }
  const setStart = (value: PlanPoint | null) => {
    setStartDraft({ value })
    saveStart(value)
    mutate.current({ region, start: value })
  }

  return { custom, setCustom, start, setStart, saving: save.isPending, saveFailed: save.isError }
}
