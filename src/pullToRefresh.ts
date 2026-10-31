/** How far the indicator must be pulled (after resistance) before letting go refreshes. */
export const PULL_THRESHOLD = 64
const PULL_MAX = 110

/**
 * Pure: a pull of `dy` pixels as the indicator shows it. The finger moves farther than the
 * indicator (resistance), like the native gesture, and it stops at a maximum; past the threshold,
 * letting go refreshes.
 */
export const pullState = (dy: number) => {
  const offset = dy <= 0 ? 0 : Math.min(PULL_MAX, dy * 0.5)
  return { offset, ready: offset >= PULL_THRESHOLD, turn: Math.round(offset * 4) }
}
