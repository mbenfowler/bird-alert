import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'
import { useCurrentUser, usePlaceSeenQuery, usePlacesQuery, useRegionsQuery } from './hooks/queries'
import { countyName, countyWord, stateOfRegion } from './usStates'
import { daysUntil, t } from './i18n'
import type { ActivePlace, SavedPlace } from './types'

/**
 * Which area the home screen, alerts bar, Where to go and the map show: an area being explored
 * (named in the link, ?region=US-CO-031, so it can be shared, and kept for the visit as the person
 * moves between pages), else the saved place the person is in (switched by hand or by a trip's
 * dates), else home. Exploring never touches the account; being at a place is the account's own
 * setting, and "Show home" only changes what this visit shows.
 */
const EXPLORE_KEY = 'bird-alert:explore'
const SHOW_HOME_KEY = 'bird-alert:show-home'

const read = (key: string) => { try { return sessionStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string | null) => {
  try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key) } catch { /* this page only */ }
}

// A small store over sessionStorage, so every page re-renders the moment the area changes.
let explored = read(EXPLORE_KEY)
let homeOver = read(SHOW_HOME_KEY)
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const notify = () => listeners.forEach(listener => listener())
const setExplored = (region: string | null) => { if (explored === region) return; explored = region; write(EXPLORE_KEY, region); notify() }
const setHomeOver = (placeId: string | null) => { if (homeOver === placeId) return; homeOver = placeId; write(SHOW_HOME_KEY, placeId); notify() }
const snapshot = () => `${explored ?? ''}|${homeOver ?? ''}`

export type ShownMode = 'home' | 'explore' | 'place'

export interface ShownArea {
  region: string
  state: string
  mode: ShownMode
  home: { region: string; state: string }
  /** The place the person is in, whether or not it's the area shown (they can look at home instead). */
  place: ActivePlace | null
  explore: (area: { location: string } | null) => void
  /** While at a place: show home for this visit (true), or the place again (false). */
  showHome: (yes: boolean) => void
}

export const useShownArea = (): ShownArea => {
  const user = useCurrentUser()
  const [params, setParams] = useSearchParams()
  useSyncExternalStore(subscribe, snapshot, snapshot)
  const home = { region: user.location, state: user.state }
  const place = user.activePlace ?? null

  const asked = params.get('region') ?? ''
  const fromLink = stateOfRegion(asked) && asked !== user.location ? asked : null
  // A link that names an area makes it the one explored for the rest of the visit.
  useEffect(() => { if (fromLink) setExplored(fromLink) }, [fromLink])
  const exploring = fromLink ?? (explored && explored !== user.location ? explored : null)

  const explore = (area: { location: string } | null) => {
    setExplored(area && area.location !== user.location ? area.location : null)
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (area && area.location !== user.location) next.set('region', area.location)
      else next.delete('region')
      return next
    }, { replace: true })
  }
  const showHome = (yes: boolean) => setHomeOver(yes && place ? String(place.id) : null)

  if (exploring) return { region: exploring, state: stateOfRegion(exploring)!, mode: 'explore', home, place, explore, showHome }
  if (place && homeOver !== String(place.id)) return { region: place.location, state: place.state, mode: 'place', home, place, explore, showHome }
  return { region: home.region, state: home.state, mode: 'home', home, place, explore, showHome }
}

/**
 * The birds a page looks for beyond the watch list: while the person is at a saved place and the
 * page shows it, that place's target birds. Empty at home and while exploring.
 */
export const useShownTargets = (shown: ShownArea): Set<string> => {
  const places = usePlacesQuery()
  if (shown.mode !== 'place' || !shown.place) return EMPTY
  const place = places.data?.find(p => String(p.id) === String(shown.place!.id))
  return place?.targets.length ? new Set(place.targets) : EMPTY
}
const EMPTY = new Set<string>()

/**
 * The list "new for me" is measured against while a place is shown: the place's own seen list when
 * the person chose "in <place>" for it, else null (the life list).
 */
export const useShownSeen = (shown: ShownArea): Set<string> | null => {
  const places = usePlacesQuery()
  const place = shown.mode === 'place' && shown.place ? places.data?.find(p => String(p.id) === String(shown.place!.id)) : undefined
  const byPlace = place?.lifers_scope === 'place'
  const seen = usePlaceSeenQuery(byPlace ? place!.id : null, byPlace)
  return useMemo(() => (byPlace && seen.data ? new Set(seen.data) : null), [byPlace, seen.data])
}

const UPCOMING_DAYS = 7

/** The saved place with the soonest trip starting within the week (not yet under way), and that trip. */
export const nextTrip = (places: SavedPlace[]) => places
  .flatMap(place => place.trips.filter(trip => !trip.active && daysUntil(trip.starts_on) > 0 && daysUntil(trip.starts_on) <= UPCOMING_DAYS).map(trip => ({ place, trip })))
  .sort((a, b) => a.trip.starts_on.localeCompare(b.trip.starts_on))[0]

/** "Denver County" in the US, "Calgary" elsewhere; "your county" while the names load. */
export const useAreaName = (state: string, region: string) => {
  const regions = useRegionsQuery(state)
  const name = regions.data?.find(r => r.code === region)?.name
  return name ? countyName(name, state) : t('range.yourCounty', { word: countyWord(state) })
}
