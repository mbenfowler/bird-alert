import { useSearchParams } from 'react-router'
import { countyWord, stateName, stateOfRegion } from './usStates'
import { t } from './i18n'

/**
 * The county a page should show: the one its link names (`?region=US-ME-003`, as alert links do),
 * else the signed-in account's own. A link from another account's alert, or for a county someone
 * was looking at, then opens on that county rather than reading "no sightings".
 */
export const useLinkRegion = (user: { location: string; state: string }) => {
  const [params] = useSearchParams()
  const asked = params.get('region') ?? ''
  const askedState = stateOfRegion(asked)
  const region = askedState ? asked : user.location
  const state = askedState ?? user.state
  const own = region === user.location
  return { region, state, own, query: own ? '' : `?region=${region}` }
}

/** "Hall" for the account's own county; "Aroostook, Maine" for another, so it's clear which. */
export const countyLabel = (name: string | undefined, state: string, own: boolean) => {
  if (!name) return own ? t('range.yourCounty', { word: countyWord(state) }) : t('county.that', { word: countyWord(state) })
  if (own) return name
  const full = stateName(state)
  return full ? `${name}, ${full}` : name
}
