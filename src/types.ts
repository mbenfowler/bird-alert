export interface User {
  id: number
  username: string
  email: string
  location: string
  state: string
  email_confirmed: boolean
  alert_digest_email_enabled: boolean
  rare_sightings_email_enabled: boolean
  push_watchlist_enabled: boolean
  push_notable_enabled: boolean
  push_notable_batched: boolean
  push_first_of_season: boolean
  migration_email_enabled: boolean
  push_quiet_start: number | null
  push_quiet_end: number | null
  timezone: string | null
  created_at: string
  updated_at: string
}

export type EmailPreference = 'alert_digest_email_enabled' | 'rare_sightings_email_enabled' | 'migration_email_enabled'
export type PushPreference = 'push_watchlist_enabled' | 'push_notable_enabled' | 'push_first_of_season'

export interface UserPatch {
  email?: string
  state?: string
  location?: string
  alert_digest_email_enabled?: boolean
  rare_sightings_email_enabled?: boolean
  push_watchlist_enabled?: boolean
  push_notable_enabled?: boolean
  push_notable_batched?: boolean
  push_first_of_season?: boolean
  migration_email_enabled?: boolean
  push_quiet_start?: number | null
  push_quiet_end?: number | null
  timezone?: string
}

/** A bird as stored in our database, or as assembled from eBird taxonomy plus image and wiki lookups. */
export interface Bird {
  id?: number
  speciesCode: string
  comName: string
  sciName: string
  category?: string
  order?: string
  familyCode?: string
  familyComName?: string
  familySciName?: string
  birdImg?: string | null
  wikiURL?: string | null
  taxonOrder?: number | null
  /** Set on the saved view only: most recent nearby observation date. */
  lastObserved?: string
}

/** One row from eBird's recent observations endpoints. */
export interface Observation {
  speciesCode: string
  comName: string
  sciName: string
  locId: string
  locName: string
  obsDt: string
  howMany?: number
  lat: number
  lng: number
  obsValid: boolean
  obsReviewed: boolean
  locationPrivate: boolean
  subId: string
}

export interface Region {
  code: string
  name: string
}

/** A species expected about now, judged by this time last year, that has not been reported in the last two weeks. */
export interface Arrival {
  speciesCode: string
  comName: string
  sciName: string
  birdImg?: string | null
  wikiURL?: string | null
  /** Days it was reported on, out of `windowDays`, in the two weeks around today's date last year. */
  daysLastYear: number
  windowDays: number
  /** Its earliest report around this date last year. */
  firstLastYear: string | null
  migrant: boolean
}

export interface Arrivals {
  arrivals: Arrival[]
  /** True while the region's history is too thin to tell migrants from under-reported residents. */
  learning: boolean
}

/** One month of a species' year in the region: days with a report, out of days on file. */
export interface SeasonMonth {
  month: number
  reported: number
  covered: number
}

/** The latest push the server sent this user, and what became of it (see notificationHandoff.ts). */
export interface PendingPush {
  title: string
  url: string
  sentAt: string
  tappedAt: string | null
  offeredAt: string | null
  openedAt: string | null
}

export type EmailPreviewKind = 'watchlist' | 'rare' | 'migration'
export type EmailPreviewResult = { sent: true; items: number } | { sent: false; reason: 'nothing' | 'unconfirmed' | 'location' }

/** One representative xeno-canto recording for a species, as /api/sound answers. */
export interface BirdSound {
  speciesCode: string
  found: boolean
  xcId?: number
  url?: string
  page?: string
  type?: string | null
  quality?: string | null
  length?: number | null
  recordist?: string | null
  license?: string | null
  licenseName?: string
  country?: string | null
}
