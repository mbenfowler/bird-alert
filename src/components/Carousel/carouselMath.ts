/**
 * The carousel's sums, kept pure so they're tested on their own. The track holds every slide once,
 * with copies of the last few before them and of the first few after, so moving on from the last
 * slide slides onto a copy of the first; when the move ends, the track jumps (unseen) back to the
 * real one. `pos` is a place on that longer track.
 */

/** Copies on each side: enough for three across plus the one sliding in. */
export const CLONES = 3

/** The carousel's layout for its width: three across when wide, one centred when narrow, or still. */
export type CarouselMode = 'static' | 'wide' | 'narrow'

export const VISIBLE = 3
/** A narrow carousel's slide, as a share of its width; its neighbours show at both edges. */
export const NARROW_SHARE = 0.72

export const wrap = (i: number, n: number) => (n > 0 ? ((i % n) + n) % n : 0)

/** Each place on the track, as the slide it shows: [4, 5, 6, 0, 1, …, 6, 0, 1, 2] for 7. */
export const trackOrder = (n: number, clones = CLONES) => (n > 0 ? Array.from({ length: n + 2 * clones }, (_, e) => wrap(e - clones, n)) : [])

export const isClone = (e: number, n: number, clones = CLONES) => e < clones || e >= clones + n

/** The slide at a place on the track. */
export const realIndex = (pos: number, n: number, clones = CLONES) => wrap(pos - clones, n)

/** The real slide's own place for whatever `pos` shows (a copy's place becomes its original's). */
export const settle = (pos: number, n: number, clones = CLONES) => clones + wrap(pos - clones, n)

/**
 * Whether the track can move straight to `target` with every slide in view (or sliding into it)
 * there to draw; if not, it settles first. A wide track shows `target` to `target + 2`; a narrow one
 * `target - 1` to `target + 1`.
 */
export const canReach = (target: number, n: number, mode: CarouselMode, clones = CLONES) =>
  target >= 1 && target <= n + 2 * clones - (mode === 'wide' ? VISIBLE : 2)

/** Three across with two gaps when wide; 72% of the width when narrow. */
export const slideWidth = (width: number, mode: CarouselMode, gap: number) =>
  mode === 'narrow' ? width * NARROW_SHARE : Math.max(0, (width - gap * (VISIBLE - 1)) / VISIBLE)

/** The track's offset in px: the slide at `pos` first when wide, centred when narrow. */
export const trackX = (width: number, pos: number, mode: CarouselMode, gap: number) => {
  const w = slideWidth(width, mode, gap)
  const lead = mode === 'narrow' ? (width - w) / 2 : 0
  return lead - pos * (w + gap)
}

/** Still for one slide, or for three or fewer when wide; moving otherwise. */
export const carouselMode = (width: number, n: number, wideAt = 640): CarouselMode =>
  n <= 1 ? 'static' : width >= wideAt ? (n <= VISIBLE ? 'static' : 'wide') : 'narrow'

/** A drag far enough (a fifth of a slide, or 60 px) moves one slide the way it went; else nothing. */
export const swipeStep = (dx: number, slide: number) => (Math.abs(dx) >= Math.min(60, slide * 0.2) ? (dx < 0 ? 1 : -1) : 0)
