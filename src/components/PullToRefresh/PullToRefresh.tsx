import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isStandalone } from '../../install'
import { pullState } from '../../pullToRefresh'
import './PullToRefresh.css'
import { t } from '../../i18n'

// Gestures that start here belong to something else: the map pans, fields scroll their text.
const NOT_FROM = '.leaflet-container, input, textarea, select, [data-no-pull]'

/**
 * Pull down at the top of a page to fetch everything on it again, in the app installed to the
 * Home Screen, where iOS has no pull-to-refresh of its own. A browser tab keeps its native one, so
 * this stays off there. Listeners are passive and the indicator moves by style, not by render,
 * so scrolling never waits on it.
 */
const PullToRefresh = () => {
  const queryClient = useQueryClient()
  const indicator = useRef<HTMLDivElement>(null)
  const [refreshing, setRefreshing] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    if (!isStandalone()) return
    let start: { x: number; y: number } | null = null
    let ready = false
    const show = (offset: number, turn: number) => {
      const el = indicator.current
      if (!el) return
      el.style.transform = `translate(-50%, ${offset}px)`
      el.style.opacity = String(Math.min(1, offset / 40))
      el.style.setProperty('--turn', `${turn}deg`)
      el.classList.toggle('is-ready', ready)
    }
    const reset = () => {
      const el = indicator.current
      if (!el) return
      el.style.transition = 'transform 200ms ease, opacity 200ms ease'
      show(0, 0)
      window.setTimeout(() => { if (indicator.current) indicator.current.style.transition = '' }, 220)
    }
    const onStart = (e: TouchEvent) => {
      if (busy.current || window.scrollY > 0 || e.touches.length !== 1) { start = null; return }
      if ((e.target as Element | null)?.closest?.(NOT_FROM)) { start = null; return }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      ready = false
    }
    const onMove = (e: TouchEvent) => {
      if (!start) return
      const dy = e.touches[0].clientY - start.y
      const dx = e.touches[0].clientX - start.x
      // A sideways swipe (the list tabs, a card row) or scrolling down is not a pull.
      if (Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) { start = null; ready = false; reset(); return }
      const state = pullState(dy)
      ready = state.ready
      show(state.offset, state.turn)
    }
    const onEnd = () => {
      if (!start) return
      start = null
      if (!ready) { reset(); return }
      ready = false
      busy.current = true
      setRefreshing(true)
      show(56, 0)
      queryClient.refetchQueries({ type: 'active' })
        .catch(() => undefined)
        .finally(() => { busy.current = false; setRefreshing(false); reset() })
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [queryClient])

  return (
    <div ref={indicator} className={`pull-refresh ${refreshing ? 'is-refreshing' : ''}`} aria-hidden={!refreshing} role='status'>
      <img src='/images/bird.png' alt='' />
      {refreshing && <span className='visually-hidden'>{t('pull.refreshing')}</span>}
    </div>
  )
}

export default PullToRefresh
