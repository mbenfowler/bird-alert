/**
 * How far along a drawn road each stop sits, from 0 (the start) to 1 (the end), so a stop's
 * marker can appear as the line reaches it. Distances are in degrees, which is plenty for the
 * order and the rough timing of a few miles of road.
 */
export const stopFractions = (path: [number, number][], stops: { lat: number; lng: number }[]): number[] => {
  if (path.length < 2) return stops.map((_, i) => (stops.length > 1 ? i / (stops.length - 1) : 1))
  const cumulative = [0]
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]]
    cumulative.push(cumulative[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = cumulative[cumulative.length - 1] || 1
  return stops.map((stop) => {
    let nearest = 0
    let best = Infinity
    path.forEach(([lat, lng], i) => {
      const d = Math.hypot(lat - stop.lat, lng - stop.lng)
      if (d < best) { best = d; nearest = i }
    })
    return cumulative[nearest] / total
  })
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
