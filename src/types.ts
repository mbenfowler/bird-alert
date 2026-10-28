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
  /** When the short post-signup setup was finished or skipped; null until then. */
  onboarded_at?: string | null
  push_lifer_enabled?: boolean
  migration_email_enabled: boolean
  push_quiet_start: number | null
  push_quiet_end: number | null
  timezone: string | null
  created_at: string
  updated_at: string
  /** Whether any passkey is on the account. */
  hasPasskey?: boolean
}

export type EmailPreference = 'alert_digest_email_enabled' | 'rare_sightings_email_enabled' | 'migration_email_enabled'
export type PushPreference = 'push_watchlist_enabled' | 'push_notable_enabled' | 'push_first_of_season' | 'push_lifer_enabled'

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
  push_lifer_enabled?: boolean
  migration_email_enabled?: boolean
  push_quiet_start?: number | null
  push_quiet_end?: number | null
  timezone?: string
  onboarded?: true
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
  /** On the life list page: the day it went on the list. */
  firstSeen?: string | null
  /** Field craft for the species, from the API; null for species we have none for. */
  tips?: BirdTips | null
  /** ABA Checklist code (3-5 are shown), or null. */
  aba?: number | null
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
  /** ABA Checklist code, on notable sightings (3 rare, 4 casual, 5 accidental are shown); null when not on the list. */
  aba?: number | null
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
  /** The chance (0-100) that a visit finds the bird; the band is a threshold on it. */
  chance?: number
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

/** A bird a place offers, within the watch list's where-to-go answer. */
export interface PlaceBird { speciesCode: string; comName: string; chance: number; band: PlaceBand; lastSeen: Place['lastSeen']; note: PlaceNote | null }
export interface GoPlace {
  locId: string
  locName: string | null
  lat: number | null
  lng: number | null
  isHotspot: boolean | null
  merged: { locId: string; locName: string | null }[]
  birds: PlaceBird[]
  /** How many watch-list birds a visit can expect: the sum of the chances. */
  expected: number
  bestTime: string | null
  seenToday: boolean
}
export interface GoStop { locId: string; locName: string | null; lat: number; lng: number; expected: number; bestTime: string | null; birds: PlaceBird[] }
export interface WhereToGo {
  region: string
  asOf: string
  species: { speciesCode: string; comName: string; class: PersistenceClass; bestTime: WhereToFind['bestTime']; places: number; best: { locId: string; locName: string | null; chance: number } | null }[]
  places: GoPlace[]
  /** How each band has held up lately; a band is shown once `enough` predictions are graded. */
  grades?: WhereToFind['grades']
  route: { stops: GoStop[]; covers: number; url: string | null; drive?: Drive | null; origin?: { lat: number; lng: number } | null }
}

/** Public land near a point: eBird hotspots with their all-time effort, and parks eBird does not list. */
/** The drive by road: minutes, miles and the road itself as [lat, lng] points for the map. */
export interface Drive { minutes: number; miles: number; geometry: [number, number][]; legs?: { minutes: number; miles: number }[] }
export interface NearbyHotspot { locId: string; name: string; lat: number; lng: number; miles: number; checklists: number | null; species: number | null; latest: string | null; lightlyBirded: boolean; drive?: Drive | null }
export interface NearbyPark { name: string; lat: number; lng: number; miles: number; type?: string; drive?: Drive | null }
/** A stop or start found by name: an eBird hotspot anywhere in the state, or a town or address. */
export interface FoundHotspot { kind: 'hotspot'; locId: string; name: string; county: string | null; lat: number; lng: number; species: number | null; checklists: number | null; latest: string | null }
/** The route kept on the account: this county's stops (null follows the suggestion) and the start. */
export interface SavedRoute { region: string; stops: SavedPoint[] | null; start: SavedPoint | null; updatedAt: string | null }
export interface SavedPoint { locId: string | null; name: string; lat: number; lng: number; note?: string | null }
/** A bird on the life list: tapped "Seen it", or brought in from an eBird export. */
export interface SeenBird { speciesCode: string; firstSeen: string | null; source: 'tap' | 'import'; comName?: string | null; taxonOrder?: number | null }
/** What an eBird import did; rows left out say why, and offer the species to mark by hand where there is a choice. */
export interface SplitChoice { speciesCode: string; comName: string }
export interface LifeListImport { added: number; already: number; total: number; skipped: { name: string; reason: string; choices?: SplitChoice[]; where?: { locId: string | null; region: string | null; day: string } }[] }
/** Which of a slash it likely was, from identified reports around that place and date. */
export interface SplitEvidence { area: string; areaKind: 'county' | 'state'; from: string; to: string; sampled: number; lean: string | null; strength: 'clear' | 'mixed' | 'thin'; ranked: (SplitChoice & { days: number })[] }
/** A read-only link to a route or a sighting, as anyone opening it sees it. */
export interface SharedRoute {
  id: string; kind: 'route'; createdAt: string; regionName: string | null; title: string | null; covers: string | null
  stops: { name: string; lat: number; lng: number; locId: string | null; detail: string | null; birds: string[] }[]
  drive: { minutes: number; miles: number; legs: ({ minutes: number; miles: number } | null)[]; geometry: [number, number][] } | null
}
export interface SharedSighting {
  id: string; kind: 'sighting'; createdAt: string; speciesCode: string; comName: string; sciName: string | null; birdImg: string | null
  locName: string; lat: number; lng: number; obsDt: string | null; howMany: number | null; subId: string | null; regionName: string | null
  /** The eBird place; links shared before late October 2026 don't have it. */
  locId?: string | null
  /** ABA Checklist code (3-5 are shown), or null. */
  aba?: number | null
}
export type Share = SharedRoute | SharedSighting
/** Whether a bird is still at a place: the newest sighting, checklists filed since, and what they say. */
export interface Chase {
  locId: string; speciesCode: string; lastSeen: string | null; hoursAgo: number | null
  checkedSince: number; foundSince: number; missesSince: number
  /** Percent: the bird is still there; a visit now finds it. */
  stillThere: number; chance: number
  verdict: 'fresh' | 'likely' | 'maybe' | 'gone' | 'unknown'
}
/** A passkey on the account: the device it was made on and the site it belongs to. */
export interface Passkey { id: string; name: string | null; site: string; createdAt: string; lastUsedAt: string | null }
export interface FoundAddress { kind: 'address'; name: string; lat: number; lng: number }
export interface PlaceSearch { hotspots: FoundHotspot[]; addresses: FoundAddress[] }
export interface NearbyPublic { hotspots: NearbyHotspot[]; parks: NearbyPark[]; fetchedAt?: string }
