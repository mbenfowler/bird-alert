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
/** Where a species lives, how to find it, and the time of day that pays. */
export interface BirdTips {
  habitat: string
  look: string
  time: string
}

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
  /** Field craft for the species, from the API; null for species we have none for. */
  tips?: BirdTips | null
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

/** A place a species has been reported lately, with the chance a visit pays off and the evidence. */
export type PlaceBand = 'High' | 'Good' | 'Fair' | 'Long shot'
export interface PlaceNote { day: string; time: string | null; observer: string | null; text: string; subId: string | null }
export interface Place {
  locId: string
  locName: string | null
  lat: number | null
  lng: number | null
  /** true for an eBird hotspot, false for someone's personal location, null when unknown. */
  isHotspot?: boolean | null
  /** Personal locations within a few hundred metres that were folded into this hotspot. */
  merged?: { locId: string; locName: string | null }[]
  /** The place's own busiest two hours, once it has five timed reports. */
  bestTime?: { label: string; share: number; samples: number } | null
  band: PlaceBand
  score: number
  days: number
  lastSeen: { day: string; time: string | null; subId: string | null; daysAgo: number }
  effort: { checklists: number; withSpecies: number; detection: number | null }
  notes: PlaceNote[]
}
export type PersistenceClass = 'resident' | 'seasonal' | 'passage' | 'rare'
/** How a band has fared lately: graded predictions and how often the bird was there. */
export interface BandGrade { n: number; hits: number; rate: number | null; enough: boolean }
export interface WhereToFind {
  speciesCode: string
  class: PersistenceClass
  halfLifeDays: number
  bestTime: { label: string; source: 'reports' | 'typical'; share?: number; samples?: number }
  asOf: string
  places: Place[]
  grades?: Partial<Record<PlaceBand, BandGrade>>
}
