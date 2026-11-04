import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { hourLabel, monthDay, t } from '../../i18n'
import type { Recap } from '../../types'
import { atClockMin, bestHourNote, clockMin, curveFrame, curvePoints, gridLines, isBigDay, liferLine, nearestIndex, pct, stopBands, timeIn, timeTicks, tipPlacement, VIEW } from './recapData'

/**
 * The species count through the day. The line and the stops' shaded bands are an SVG stretched to
 * the box (preserveAspectRatio none, strokes that don't scale); every word on it is HTML placed by
 * percentages, so it stays readable on a phone. There the stop names become a numbered legend and
 * every other hour mark hides. Hover, tap or the arrow keys show each bird.
 */
const RecapCurve = ({ recap, zone }: { recap: Recap; zone: string }) => {
  const { frame, points, bands, grid, ticks, note } = useMemo(() => {
    const mins = recap.timeline.map(row => clockMin(row.at, zone, recap.event.startsOn))
    const frame = curveFrame(mins, recap.totals.species || recap.timeline.length)
    const points = curvePoints(recap, frame, zone)
    return { frame, points, bands: stopBands(recap, frame, points, zone), grid: gridLines(frame.max), ticks: timeTicks(frame), note: bestHourNote(recap, frame, points) }
  }, [recap, zone])
  const [hover, setHover] = useState<number | null>(null)
  const [last, setLast] = useState(0)
  if (!points.length) return null
  const shownIndex = hover ?? last
  const shown = points[Math.min(shownIndex, points.length - 1)]!
  const xPct = (shown.x / VIEW.w) * 100
  const tip = tipPlacement(xPct, shown.y)
  const show = (i: number | null) => { setHover(i); if (i !== null) setLast(i) }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    if (!box.width) return
    const i = nearestIndex(points, ((e.clientX - box.left) / box.width) * VIEW.w)
    if (i !== hover) show(i)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -points.length : e.key === 'End' ? points.length : 0
    if (!step) { if (e.key === 'Escape') show(null); return }
    e.preventDefault()
    show(Math.max(0, Math.min(points.length - 1, (hover ?? (step > 0 ? -1 : points.length)) + step)))
  }
  const line = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const end = points[points.length - 1]!
  const first = points[0]!
  const lifer = liferLine(shown.row, recap.audience)
  const tickLabel = (min: number, daily: boolean) => (daily ? monthDay(atClockMin(min, zone, recap.event.startsOn)) : hourLabel(Math.floor(min / 60) % 24))
  const midPoints = [points[Math.floor(points.length / 3)]!, points[Math.floor((2 * points.length) / 3)]!]
  const summary = t('recap.curveLabel', {
    steps: [...midPoints, end].map(p => (p.row.place
      ? t('recap.curveStep', { n: p.row.n, time: timeIn(p.row.at, zone), place: p.row.place })
      : t('recap.curveStepNoPlace', { n: p.row.n, time: timeIn(p.row.at, zone) }))).join(', ')
  })
  return (
    <section className='recap-card recap-curve' aria-labelledby='recapCurve'>
      <div className='recap__head'>
        <h2 id='recapCurve' className='recap__h2'>{isBigDay(recap) ? t('recap.curveBigDay') : t('recap.curveTrip')}</h2>
        <span className='recap__aside'>{t('recap.curveHint')}</span>
      </div>
      <div className='recap-curve__plot' tabIndex={0} role='group' aria-label={summary} data-testid='recap-curve'
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)}>
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio='none' aria-hidden='true' className='recap-curve__svg'>
          {bands.map(b => <rect key={b.index} x={b.x0} y={0} width={b.x1 - b.x0} height={VIEW.base} className={b.best ? 'recap-curve__band is-best' : 'recap-curve__band'} />)}
          <line x1={VIEW.left} y1={VIEW.base} x2={VIEW.right} y2={VIEW.base} className='recap-curve__axis' vectorEffect='non-scaling-stroke' />
          <g className='recap-curve__grid'>
            {grid.map(n => <line key={n} x1={VIEW.left} y1={frame.y(n)} x2={VIEW.right} y2={frame.y(n)} vectorEffect='non-scaling-stroke' />)}
          </g>
          <polygon points={`${first.x.toFixed(1)},${VIEW.base} ${line} ${end.x.toFixed(1)},${VIEW.base}`} className='recap-curve__area' />
          <polyline points={line} className='recap-curve__line' vectorEffect='non-scaling-stroke' />
        </svg>
        <div className='recap-curve__words' aria-hidden='true'>
          {grid.map(n => <span key={n} className='recap-curve__count' style={{ top: pct(frame.y(n), VIEW.h) }}>{n}</span>)}
          {bands.map((b, i) => <span key={b.index} className='recap-curve__stop-num' style={{ left: pct((b.x0 + b.x1) / 2, VIEW.w) }}>{i + 1}</span>)}
          {note && (
            <span className='recap-curve__note' style={{ left: pct(note.x, VIEW.w), top: pct(Math.min(note.y + 26, VIEW.base - 20), VIEW.h) }}>
              {t('recap.bestHourNote', { count: note.added, from: hourLabel(Math.floor(note.from / 60) % 24), to: hourLabel(Math.floor(note.from / 60 + 1) % 24) })}
            </span>
          )}
          <span className='recap-curve__end' style={{ left: pct(end.x, VIEW.w), top: pct(end.y, VIEW.h) }} />
        </div>
        <div aria-hidden='true' className='recap-curve__rule' style={{ left: pct(shown.x, VIEW.w), opacity: hover === null ? 0 : 1 }} />
        <div aria-hidden='true' className='recap-curve__dot' style={{ left: pct(shown.x, VIEW.w), top: pct(shown.y, VIEW.h), opacity: hover === null ? 0 : 1 }} />
        <div className='recap-curve__tip' role='status' aria-live='polite' data-testid='recap-tip' data-side={tip.side} data-below={tip.below ? 'true' : undefined}
          style={{ left: pct(shown.x, VIEW.w), top: pct(shown.y, VIEW.h), transform: tip.transform, opacity: hover === null ? 0 : 1 }}>
          {hover !== null && <>
            <span className='recap-curve__tip-title'>{t('recap.tipTitle', { n: shown.row.n, name: shown.row.comName })}</span>
            <span className='recap-curve__tip-sub'>{shown.row.place ? t('recap.tipSub', { time: timeIn(shown.row.at, zone), place: shown.row.place }) : timeIn(shown.row.at, zone)}</span>
            {lifer && <span className='recap-curve__tip-lifer'>{lifer}</span>}
          </>}
        </div>
      </div>
      <div className='recap-curve__hours' aria-hidden='true'>
        {ticks.map(tick => (
          <span key={tick.min} className={tick.major ? '' : 'is-minor'} style={{ left: pct(frame.x(tick.min), VIEW.w) }}>{tickLabel(tick.min, tick.daily)}</span>
        ))}
      </div>
      {bands.length > 0 && <>
        <div className='recap-curve__names' aria-hidden='true'>
          {bands.map(b => <span key={b.index} style={{ left: pct((b.x0 + b.x1) / 2, VIEW.w) }}>{b.name}</span>)}
        </div>
        <ol className='recap-curve__legend' aria-label={t('recap.stopsLabel')}>
          {bands.map((b, i) => <li key={b.index}><strong>{i + 1}</strong> {b.name}</li>)}
        </ol>
      </>}
    </section>
  )
}

export default RecapCurve
