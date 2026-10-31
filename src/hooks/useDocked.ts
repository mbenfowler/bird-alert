import { useEffect, useRef, useState } from 'react'

/**
 * Docking, as on the species page: a map-and-list frame whose list scrolls by itself only once the
 * frame has reached the bar (its --dock-gap below it). `watch` re-measures when the content above
 * the frame changes height.
 */
export const useDocked = (watch: unknown) => {
  const frameRef = useRef<HTMLDivElement>(null)
  const [docked, setDocked] = useState(false)
  useEffect(() => {
    const update = () => {
      const frame = frameRef.current
      if (!frame) return
      const bar = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 55
      const gap = Number.parseFloat(getComputedStyle(frame).getPropertyValue('--dock-gap')) || 0
      setDocked(frame.getBoundingClientRect().top <= bar + gap + 1)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [watch])
  return { frameRef, docked }
}
