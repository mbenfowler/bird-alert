export interface User {
  id: number
  username: string
  email: string
  phone: string
  location: string
  state: string
  email_confirmed: boolean
  alert_digest_email_enabled: boolean
  rare_sightings_email_enabled: boolean
  created_at: string
  updated_at: string
}

export type EmailPreference = 'alert_digest_email_enabled' | 'rare_sightings_email_enabled'

export interface UserPatch {
  email?: string
  state?: string
  location?: string
  phone?: string
  alert_digest_email_enabled?: boolean
  rare_sightings_email_enabled?: boolean
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
