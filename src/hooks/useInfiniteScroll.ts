import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a ref for a sentinel element; `onReachEnd` fires when it scrolls near the viewport.
 * `enabled` false pauses it (nothing more to load, or a load already in flight).
 */
export const useInfiniteScroll = (onReachEnd: () => void, enabled: boolean) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const callbackRef = useRef(onReachEnd)
  useEffect(() => { callbackRef.current = onReachEnd }, [onReachEnd])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !enabled || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) callbackRef.current()
    }, { rootMargin: '400px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled])

  const setSentinel = useCallback((node: HTMLDivElement | null) => { sentinelRef.current = node }, [])
  return setSentinel
}
