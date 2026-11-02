/** Typed coordinates, "31.95, -109.31" or "31.95 -109.31", as a point; null when the text isn't a valid lat/long. */
export const parseCoordinates = (text: string): { lat: number; lng: number } | null => {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*(?:,\s*|\s+)(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text)
  if (!m) return null
  const [lat, lng] = [Number(m[1]), Number(m[2])]
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}
