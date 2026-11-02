export type SettingsTab = 'account' | 'alerts' | 'places'
export const SETTINGS_TABS: SettingsTab[] = ['account', 'alerts', 'places']

/**
 * Which Settings tab a link opens: ?tab= when it says, else what it's about. "Save this place"
 * (?addPlace=) and "Extend my trip" (#places?trip=12, ?trip=12) open Places; a link to the alert
 * settings (#alert-center) opens Alerts; anything else, Account.
 */
export const settingsTabFor = (params: URLSearchParams, hash: string): SettingsTab => {
  const asked = params.get('tab')
  if (asked && (SETTINGS_TABS as string[]).includes(asked)) return asked as SettingsTab
  if (params.has('addPlace') || params.has('trip') || hash.startsWith('#places')) return 'places'
  if (hash.startsWith('#alert')) return 'alerts'
  return 'account'
}
