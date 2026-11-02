import { useMemo, useState } from 'react'
import { useSavedCodes, useSeenCodes, useSpeciesListQuery, useWhereToGoQuery } from './queries'
import { useRoutePlan } from './useRoutePlan'
import { MAX_ROUTE_STOPS, samePlace, type PlanPoint } from '../routePlan'

const LIFER_MODE_KEY = 'bird-alert:go-lifers'
const readLiferMode = () => { try { return localStorage.getItem(LIFER_MODE_KEY) === '1' } catch { return false } }

/**
 * Where to go's plan for a county, shared by both tabs: the birds it's for (the watch list, or the
 * lifers), the places and suggested route for them, and the person's own route, so a hotspot added
 * from Best hotspots lands on the same route the other tab shows. The where-to-go query is cached,
 * so the second tab asking costs nothing. `extra` adds birds beyond the watch list: a saved place's
 * target birds while the person is there.
 */
const NO_EXTRA = new Set<string>()
export const useGoPlan = (region: string, extra: Set<string> = NO_EXTRA) => {
  const savedCodes = useSavedCodes()
  // Only the watch-list birds that occur in this county are worth asking about; a long list saved
  // across many places would otherwise go over the wire for nothing.
  const speciesList = useSpeciesListQuery(region)
  // Lifers first: every bird of the county that isn't on the life list, in place of the watch list.
  const seen = useSeenCodes()
  const [liferMode, setLiferModeState] = useState(readLiferMode)
  const setLiferMode = (on: boolean) => { setLiferModeState(on); try { localStorage.setItem(LIFER_MODE_KEY, on ? '1' : '0') } catch { /* this visit only */ } }
  const lifers = liferMode && seen.codes.size > 0
  const codes = useMemo(() => {
    if (lifers) return (speciesList.data ?? []).filter(code => !seen.codes.has(code)).sort()
    const here = speciesList.data ? new Set(speciesList.data) : null
    return [...new Set([...savedCodes, ...extra])].filter(code => !here || here.has(code)).sort()
  }, [lifers, savedCodes, extra, seen.codes, speciesList.data])
  // The person's own stops for this county (null follows the suggestion) and where the day starts,
  // kept on the account. The suggested route counts the drive from the start.
  const plan = useRoutePlan(region)
  const go = useWhereToGoQuery(region, codes, plan.start)
  const route = go.data?.route
  const suggested = useMemo<PlanPoint[]>(() => (route?.stops ?? []).map(s => ({ locId: s.locId, name: s.locName ?? s.locId, lat: s.lat, lng: s.lng })), [route])
  const stops = plan.custom ?? suggested
  /** Puts a place on the end of the route, or takes it off; the first change makes the route your own. */
  const toggle = (point: PlanPoint) => {
    if (stops.some(st => samePlace(st, point))) plan.setCustom(stops.filter(st => !samePlace(st, point)))
    else if (stops.length < MAX_ROUTE_STOPS) plan.setCustom([...stops, point])
  }
  return { ...plan, seen, lifers, setLiferMode, codes, go, route, suggested, stops, toggle }
}
