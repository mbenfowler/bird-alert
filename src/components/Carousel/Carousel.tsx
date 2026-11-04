import { flushSync } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type TransitionEvent } from 'react'
import { ChevronIcon } from '../Icons/Icons'
import { t } from '../../i18n'
import { CLONES, canReach, carouselMode, isClone, realIndex, settle, slideWidth, swipeStep, trackOrder, trackX } from './carouselMath'
import './Carousel.css'

export interface CarouselSlide {
  key: string
  node: ReactNode
}

interface CarouselProps {
  slides: CarouselSlide[]
  /** What the carousel holds, for screen readers ("The lifers"). */
  label: string
  /** Milliseconds between moves on its own. */
  interval?: number
  /** At this width or more, three across; under it, one centred with its neighbours at the edges. */
  wideAt?: number
  testId?: string
}

const GAP = 14
// More than this and a count ("7 of 20") stands in for the dots.
const MAX_DOTS = 10

const useReducedMotion = () => {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches)
  useEffect(() => {
    const list = window.matchMedia?.(query)
    if (!list) return
    const change = () => setReduced(list.matches)
    list.addEventListener('change', change)
    return () => list.removeEventListener('change', change)
  }, [])
  return reduced
}

/**
 * Cards that move along on their own, one every few seconds, round and round: three across when
 * wide, one centred (its neighbours showing at the edges) when narrow, and still when they all fit.
 * It waits while it's hovered, focused, touched, off-screen or in a hidden tab, and never moves on
 * its own for anyone who asks for less motion. The buttons and dots sit below, outside what moves.
 */
const Carousel = ({ slides, label, interval = 4000, wideAt = 640, testId }: CarouselProps) => {
  const n = slides.length
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [pos, setPos] = useState(CLONES)
  // A moment with no transition: a jump from a copy to its original, or a resize.
  const [instant, setInstant] = useState(false)
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [held, setHeld] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const [tabShown, setTabShown] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  const [drag, setDrag] = useState<number | null>(null)
  const dragStart = useRef<{ x: number; y: number; id: number } | null>(null)
  const dragged = useRef(false)
  const reduced = useReducedMotion()
  const mode = carouselMode(width, n, wideAt)
  const moving = mode !== 'static'

  /** Changes made with no transition, drawn at once; then transitions are back on for what follows. */
  const unseen = (change: () => void) => {
    flushSync(() => { setInstant(true); change() })
    trackRef.current?.getBoundingClientRect()
    setInstant(false)
  }
  const unseenRef = useRef(unseen)

  // Measured before the first paint, then whenever the column changes width.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width ?? 0
      unseenRef.current(() => setWidth(next))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.5)), { threshold: [0, 0.5, 1] })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const change = () => setTabShown(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])

  useEffect(() => {
    if (!held) return
    const up = () => setHeld(false)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [held])

  /** Move `step` slides (negative is back), settling onto the real slides first when a copy is showing. */
  const go = (step: number) => {
    if (!step || n < 2) return
    if (reduced) { setPos(settle(pos + step, n)); return }
    if (canReach(pos + step, n, mode)) { setPos(pos + step); return }
    const home = settle(pos, n)
    unseen(() => setPos(home))
    setPos(home + step)
  }
  // The timer and the observer call the latest of these.
  const goRef = useRef(go)
  useLayoutEffect(() => { goRef.current = go; unseenRef.current = unseen })

  const current = realIndex(pos, n)
  const running = moving && !reduced && !hover && !focus && !held && onScreen && tabShown && drag === null
  // Keyed on the slide, not the place, so settling from a copy doesn't restart the wait.
  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(() => goRef.current(1), interval)
    return () => window.clearTimeout(id)
  }, [running, current, interval])

  const settleAfterMove = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current || e.propertyName !== 'transform') return
    if (isClone(pos, n)) unseen(() => setPos(settle(pos, n)))
  }

  const slideW = slideWidth(width, mode, GAP)

  const pointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setHeld(true)
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    dragged.current = false
  }
  const pointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current
    if (!start || start.id !== e.pointerId) return
    const dx = e.clientX - start.x
    if (drag === null) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - start.y)) return
      dragged.current = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
      if (isClone(pos, n)) unseen(() => setPos(settle(pos, n)))
    }
    const most = slideW + GAP
    setDrag(Math.max(-most, Math.min(most, dx)))
  }
  const pointerEnd = () => {
    setHeld(false)
    dragStart.current = null
    if (drag === null) return
    const step = swipeStep(drag, slideW)
    setDrag(null)
    go(step)
  }

  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!moving) return
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
  }

  const blur = (e: FocusEvent<HTMLDivElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false) }

  if (!moving) {
    // All in view: a third of the width each when wide, the narrow share for a lone card on a phone.
    const stillW = width ? slideWidth(width, width >= wideAt ? 'wide' : 'narrow', GAP) : undefined
    return (
      <div ref={rootRef} className='carousel carousel--static' data-testid={testId} data-mode='static'>
        <div className='carousel__still' role='list' aria-label={label}>
          {slides.map(s => <div key={s.key} role='listitem' className='carousel__slide' style={{ width: stillW }}>{s.node}</div>)}
        </div>
      </div>
    )
  }

  const order = trackOrder(n)
  const x = trackX(width, pos, mode, GAP) + (drag ?? 0)
  return (
    <div ref={rootRef} className={`carousel carousel--${mode}`} role='region' aria-roledescription={t('carousel.role')} aria-label={label}
      data-testid={testId} data-mode={mode} data-current={current} tabIndex={0} onKeyDown={keyDown}
      onPointerEnter={e => { if (e.pointerType === 'mouse') setHover(true) }} onPointerLeave={() => setHover(false)}
      onFocus={() => setFocus(true)} onBlur={blur}>
      <div className='carousel__viewport' onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
        onClickCapture={e => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); dragged.current = false } }}>
        <div ref={trackRef} className={`carousel__track${instant || reduced || drag !== null ? ' is-instant' : ''}`} aria-live={running ? 'off' : 'polite'}
          style={{ transform: `translate3d(${x.toFixed(2)}px, 0, 0)` }} onTransitionEnd={settleAfterMove}>
          {order.map((real, e) => {
            const clone = isClone(e, n)
            const side = mode === 'narrow' && e !== pos
            return (
              <div key={clone ? `${slides[real]!.key}~${e}` : slides[real]!.key} className={`carousel__slide${side ? ' is-side' : ''}`} style={{ width: slideW, marginRight: GAP }}
                {...(clone
                  ? { 'aria-hidden': true, inert: true, 'data-clone': '' }
                  : { role: 'group', 'aria-roledescription': t('carousel.slideRole'), 'aria-label': t('carousel.slide', { n: real + 1, count: n }) })}>
                {slides[real]!.node}
              </div>
            )
          })}
        </div>
      </div>
      <div className='carousel__controls'>
        <button type='button' className='carousel__button carousel__button--prev' aria-label={t('carousel.prev')} onClick={() => go(-1)}>
          <ChevronIcon width='24' height='24' />
        </button>
        {n > MAX_DOTS ? <span className='carousel__count'>{t('carousel.slide', { n: current + 1, count: n })}</span> : <div className='carousel__dots'>
          {slides.map((s, i) => (
            <button key={s.key} type='button' className='carousel__dot' aria-label={t('carousel.goTo', { n: i + 1, count: n })}
              aria-current={i === current ? 'true' : undefined} onClick={() => go(i - current)} />
          ))}
        </div>}
        <button type='button' className='carousel__button carousel__button--next' aria-label={t('carousel.next')} onClick={() => go(1)}>
          <ChevronIcon width='24' height='24' />
        </button>
      </div>
    </div>
  )
}

export default Carousel
