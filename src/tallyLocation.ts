import { useEffect, useState } from 'react'

/**
 * Where each bird was seen, for the group log: asked once, kept as a yes or no on this phone. With a
 * yes, the phone's position is followed while the tally is open (GPS works with no signal) and the
 * latest fix rides along with each add, to 3 decimals (about 100 m).
 */
const KEY = 'bird-alert:tally-location'
export type LocationChoice = 'yes' | 'no' | null

export const readLocationChoice = (): LocationChoice => {
  try { const v = localStorage.getItem(KEY); return v === 'yes' || v === 'no' ? v : null } catch { return null }
}
const writeLocationChoice = (choice: Exclude<LocationChoice, null>) => {
  try { localStorage.setItem(KEY, choice) } catch { /* private mode: asked again next time */ }
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000

/** A fix older than this isn't where the bird was. */
const FRESH_MS = 10 * 60_000

interface Fix { lat: number; lng: number; at: number }
let last: Fix | null = null

/** The latest position, rounded, if it's recent. */
export const currentSpot = (now = Date.now()) => (last && now - last.at <= FRESH_MS ? { lat: last.lat, lng: last.lng } : null)

const available = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

/** The choice, the way to make it, and (with a yes) the phone's position followed while mounted. */
export const useTallyLocation = (active: boolean) => {
  const [choice, setChoice] = useState<LocationChoice>(() => (available() ? readLocationChoice() : 'no'))
  useEffect(() => {
    if (!active || choice !== 'yes' || !available()) return
    const id = navigator.geolocation.watchPosition(
      (p) => { last = { lat: round3(p.coords.latitude), lng: round3(p.coords.longitude), at: p.timestamp || Date.now() } },
      (error) => { if (error.code === error.PERMISSION_DENIED) { writeLocationChoice('no'); setChoice('no') } },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 30_000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [active, choice])
  return {
    choice,
    allow: () => { writeLocationChoice('yes'); setChoice('yes') },
    decline: () => { writeLocationChoice('no'); setChoice('no') }
  }
}
