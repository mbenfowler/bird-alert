import type { Recap } from '../../types'
import { formatLocale, number, t } from '../../i18n'
import { unitWord, type DistanceUnit } from '../../distance'
import { clockMin, curveFrame, curvePoints, isBigDay, longDay, oneDay, timeIn } from './recapData'

/**
 * The share card: a 1080×1350 picture of the day for Instagram and the group chat, drawn on the
 * phone from the public recap (no names, no personal spots). The big count, lifers, stops and
 * distance, up to three highlights, the curve, and the hours. In the app's own fonts, loaded first.
 */
export const CARD = { w: 1080, h: 1350 } as const

const INK = '#111111'
const GOLD = '#ffd700'
const PAPER = '#f4f1e8'
const SOFT = '#e6e1d3'
const QUIET = '#c9c4b6'
const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = 'system-ui, -apple-system, sans-serif'

/** The fonts the card draws in; a font still on its way would come out as the fallback, so each is asked for first. */
const FONTS = ['52px "Fredericka the Great"', '48px "Bungee Spice"', '300px Bungee', '72px "DM Serif Display"']
const stylesheetReady = () => {
  // The fonts' own stylesheet loads alongside the app; until it's in, the browser hasn't heard of them.
  const link = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]')
  if (!link || link.sheet) return Promise.resolve()
  return new Promise<void>(resolve => {
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => resolve(), { once: true })
    window.setTimeout(resolve, 4000)
  })
}
export const cardFontsReady = async () => {
  if (typeof document === 'undefined' || !document.fonts) return
  await stylesheetReady()
  await Promise.all(FONTS.map(font => document.fonts.load(font, '0123456789 BirdALERT! species').catch(() => [])))
  await document.fonts.ready
}

/** What the card may show: the server's public view, or with only the members' one to hand, that without names or places. */
export const cardSafe = (recap: Recap): Recap => recap.audience === 'public' ? recap : {
  ...recap,
  audience: 'public',
  highlights: {
    rarest: recap.highlights.rarest ? { ...recap.highlights.rarest, place: null } : null,
    scoutingCalled: recap.highlights.scoutingCalled ? {
      ...recap.highlights.scoutingCalled,
      star: recap.highlights.scoutingCalled.star && { ...recap.highlights.scoutingCalled.star, place: null, scoutedAt: null, liferFor: null },
      others: recap.highlights.scoutingCalled.others.map(o => ({ ...o, place: null }))
    } : null
  }
}

/** Up to three lines of the day's best moments, the rarest first (with its ABA code). */
export const cardLines = (recap: Recap) => {
  const lines: { text: string; aba?: number }[] = []
  const { rarest } = recap.highlights
  const scoutStar = recap.highlights.scoutingCalled?.star
  if (rarest) lines.push({ text: rarest.place ? t('recap.cardRarest', { name: rarest.comName, place: rarest.place }) : rarest.comName, aba: rarest.aba >= 3 ? rarest.aba : undefined })
  if (scoutStar && scoutStar.speciesCode !== rarest?.speciesCode) lines.push({ text: t('recap.cardScouting', { name: scoutStar.comName }) })
  const last = recap.totals.lastBird
  if (last && !lines.some(l => l.text.startsWith(last.comName))) lines.push({ text: t('recap.cardClose', { name: last.comName }) })
  return lines.slice(0, 3)
}

const fit = (ctx: CanvasRenderingContext2D, text: string, width: number) => {
  if (ctx.measureText(text).width <= width) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const spaced = (ctx: CanvasRenderingContext2D, spacing: string) => {
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = spacing
}

/** Draws the card onto a 1080×1350 canvas. */
export const drawShareCard = (canvas: HTMLCanvasElement, recap: Recap, zone: string, unit: DistanceUnit) => {
  canvas.width = CARD.w
  canvas.height = CARD.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  const left = 80
  const right = CARD.w - 80
  const width = right - left
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, CARD.w, CARD.h)
  ctx.textBaseline = 'alphabetic'

  // Bird ALERT!, and what kind of day it was.
  let y = 72 + 48
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = '52px "Fredericka the Great", serif'
  ctx.fillText('Bird', left, y)
  const bird = ctx.measureText('Bird').width
  ctx.font = '48px "Bungee Spice", Bungee, sans-serif'
  ctx.fillStyle = GOLD
  ctx.fillText('ALERT!', left + bird + 10, y)
  ctx.textAlign = 'right'
  ctx.font = `700 24px ${SANS}`
  spaced(ctx, '0.14em')
  ctx.fillText((isBigDay(recap) ? t('recap.cardBigDay') : t('recap.cardTrip')).toLocaleUpperCase(formatLocale()), right, y)

  // The date and the area.
  y += 40 + 32
  ctx.textAlign = 'left'
  ctx.fillStyle = QUIET
  ctx.font = `26px ${SANS}`
  spaced(ctx, '0.08em')
  ctx.fillText(fit(ctx, [longDay(recap.event.startsOn), recap.event.area].filter(Boolean).join(' · ').toLocaleUpperCase(formatLocale()), width), left, y)
  spaced(ctx, '0px')

  // The count.
  y += 276
  ctx.fillStyle = GOLD
  ctx.font = '300px Bungee, sans-serif'
  const count = number(recap.totals.species)
  ctx.fillText(count, left, y)
  const countWidth = ctx.measureText(count).width
  ctx.fillStyle = '#ffffff'
  ctx.font = `72px "DM Serif Display", ${SERIF}`
  ctx.fillText(t('recap.speciesWord', { count: recap.totals.species }), left + countWidth + 22, y)
  y += 60
  ctx.fillStyle = SOFT
  ctx.font = `38px ${SERIF}`
  const days = Math.round((Date.parse(`${recap.event.endsOn}T12:00:00Z`) - Date.parse(`${recap.event.startsOn}T12:00:00Z`)) / 86_400_000) + 1
  ctx.fillText(oneDay(recap) ? t('recap.cardOneDay') : t('recap.cardDays', { count: days }), left, y)

  // Lifers, stops, distance.
  y += 40
  const boxes = [
    { value: recap.lifers.length, label: t('recap.cardLifers', { count: recap.lifers.length }), gold: true },
    { value: recap.totals.stops, label: t('recap.cardStops', { count: recap.totals.stops }), gold: false },
    ...(recap.totals.miles !== null ? [{ value: Math.round(unit === 'km' ? recap.totals.miles * 1.609344 : recap.totals.miles), label: unitWord(unit), gold: false }] : [])
  ]
  const gap = 20
  const boxW = (width - gap * (boxes.length - 1)) / boxes.length
  const boxH = 150
  boxes.forEach((box, i) => {
    const x = left + i * (boxW + gap)
    ctx.lineWidth = 3
    ctx.strokeStyle = box.gold ? GOLD : PAPER
    roundRect(ctx, x + 1.5, y + 1.5, boxW - 3, boxH - 3, 22)
    ctx.stroke()
    ctx.fillStyle = box.gold ? GOLD : PAPER
    ctx.font = '64px Bungee, sans-serif'
    ctx.fillText(number(box.value), x + 24, y + 22 + 56)
    ctx.fillStyle = PAPER
    ctx.font = `30px ${SERIF}`
    ctx.fillText(fit(ctx, box.label, boxW - 48), x + 24, y + 22 + 64 + 40)
  })

  // The highlights.
  y += boxH + 40
  for (const line of cardLines(recap)) {
    y += 40
    let x = left
    if (line.aba) {
      ctx.font = `700 20px ${SANS}`
      const chip = t('aba.short', { code: line.aba })
      const chipW = ctx.measureText(chip).width + 28
      ctx.fillStyle = GOLD
      roundRect(ctx, x, y - 30, chipW, 36, 18)
      ctx.fill()
      ctx.fillStyle = INK
      ctx.fillText(chip, x + 14, y - 5)
      x += chipW + 16
    }
    ctx.fillStyle = line.aba ? PAPER : SOFT
    ctx.font = `34px ${SERIF}`
    ctx.fillText(fit(ctx, line.text, right - x), x, y)
    y += 14
  }

  // The curve, along the bottom.
  const footY = CARD.h - 64 - 8
  const curveTop = Math.max(y + 40, footY - 60 - 170)
  const curveBottom = footY - 50
  const mins = recap.timeline.map(row => clockMin(row.at, zone, recap.event.startsOn))
  const frame = curveFrame(mins, recap.totals.species || recap.timeline.length)
  const points = curvePoints(recap, frame, zone)
  if (points.length && curveBottom - curveTop > 60) {
    const px = (vx: number) => left + 20 + ((vx - 40) / 870) * (width - 40)
    const py = (vy: number) => curveBottom - ((240 - vy) / 200) * (curveBottom - curveTop - 12)
    ctx.beginPath()
    ctx.moveTo(px(points[0]!.x), curveBottom)
    for (const p of points) ctx.lineTo(px(p.x), py(p.y))
    ctx.lineTo(px(points[points.length - 1]!.x), curveBottom)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 215, 0, 0.16)'
    ctx.fill()
    ctx.beginPath()
    points.forEach((p, i) => (i ? ctx.lineTo(px(p.x), py(p.y)) : ctx.moveTo(px(p.x), py(p.y))))
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 6
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    const end = points[points.length - 1]!
    ctx.beginPath()
    ctx.arc(px(end.x), py(end.y), 11, 0, Math.PI * 2)
    ctx.fillStyle = GOLD
    ctx.fill()
  }

  // First bird to last, and where it came from.
  ctx.font = `24px ${SANS}`
  ctx.fillStyle = QUIET
  ctx.textAlign = 'left'
  const first = recap.totals.firstBird?.at ?? recap.timeline[0]?.at
  const last = recap.totals.lastBird?.at ?? recap.timeline[recap.timeline.length - 1]?.at
  if (first && last) ctx.fillText(t('recap.cardSpan', { from: timeIn(first, zone), to: timeIn(last, zone) }), left, footY)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 24px ${SANS}`
  ctx.fillText(window.location.host || 'bird-alert.vercel.app', right, footY)
}

/** Draws the card and hands it over as a PNG download. */
export const saveShareCard = async (recap: Recap, zone: string, unit: DistanceUnit) => {
  await cardFontsReady()
  const canvas = document.createElement('canvas')
  drawShareCard(canvas, recap, zone, unit)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('no picture')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${recap.event.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'bird-alert'}-recap.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
