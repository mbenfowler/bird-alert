export type SettingsTab = 'account' | 'alerts' | 'places'
export const SETTINGS_TABS: SettingsTab[] = ['account', 'alerts', 'places']

/**
 * An old trip link's trip id: "Extend my trip" in trip emails was /settings#places?trip=12, and
 * Settings also took ?trip=12 (with or without ?tab=places). Trips became events, and the server
 * keeps no record of which trip became which event, so these links go to the events list.
 */
export const oldTripId = (params: URLSearchParams, hash: string): string | null =>
  params.get('trip') || /[?&#]trip=([^&]+)/.exec(hash)?.[1] || null

/**
 * Which Settings tab a link opens: ?tab= when it says, else what it's about. "Save this place"
 * (?addPlace=) opens Places; a link to the alert settings (#alert-center) opens Alerts; anything
 * else, Account.
 */
export const settingsTabFor = (params: URLSearchParams, hash: string): SettingsTab => {
  const asked = params.get('tab')
  if (asked && (SETTINGS_TABS as string[]).includes(asked)) return asked as SettingsTab
  if (params.has('addPlace') || hash.startsWith('#places')) return 'places'
  if (hash.startsWith('#alert')) return 'alerts'
  return 'account'
}
