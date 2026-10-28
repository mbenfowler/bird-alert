import { useSearchParams } from 'react-router'
import { US_STATES } from './usStates'

const COUNTY = /^US-([A-Z]{2})-\d{3}$/

/**
 * The county a page should show: the one its link names (`?region=US-ME-003`, as alert links do),
 * else the signed-in account's own. A link from another account's alert, or for a county someone
 * was looking at, then opens on that county rather than reading "no sightings".
 */
export const useLinkRegion = (user: { location: string; state: string }) => {
  const [params] = useSearchParams()
  const asked = params.get('region') ?? ''
  const m = COUNTY.exec(asked)
  const region = m ? asked : user.location
  const state = m ? m[1]! : user.state
  const own = region === user.location
  return { region, state, own, query: own ? '' : `?region=${region}` }
}

/** "Hall" for the account's own county; "Aroostook, Maine" for another, so it's clear which. */
export const countyLabel = (name: string | undefined, state: string, own: boolean) => {
  if (!name) return own ? 'your county' : 'that county'
  if (own) return name
  const stateName = US_STATES.find(([code]) => code === state)?.[1]
  return stateName ? `${name}, ${stateName}` : name
}
