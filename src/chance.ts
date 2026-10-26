import type { CSSProperties } from 'react'

/**
 * The colour for a chance (0-100): dark green at the top, through yellow around the middle, to
 * grey at zero. Text flips to white once the background is dark enough. Shared by every chip
 * that shows a chance.
 */
const ramp = (chance: number) => {
  const t = Math.max(0, Math.min(100, chance)) / 100
  let hue: number, sat: number, light: number
  if (t >= 0.5) {
    const u = (t - 0.5) / 0.5
    hue = 50 + u * 90
    sat = 85 - u * 30
    light = 46 - u * 18
  } else {
    const u = t / 0.5
    hue = 50
    sat = u * 85
    light = 62 - u * 16
  }
  return { hue: Math.round(hue), sat: Math.round(sat), light: Math.round(light) }
}

/** Just the colour, for a dot or border beside text that keeps its own colour. */
export const chanceColour = (chance: number) => {
  const { hue, sat, light } = ramp(chance)
  return `hsl(${hue}, ${sat}%, ${light}%)`
}

/** A filled chip: background, border and a text colour that stays readable on it. */
export const chanceStyle = (chance: number | undefined): CSSProperties | undefined => {
  if (chance === undefined) return undefined
  const { hue, sat, light } = ramp(chance)
  const background = `hsl(${hue}, ${sat}%, ${light}%)`
  const border = `hsl(${hue}, ${sat}%, ${Math.max(12, light - 18)}%)`
  return { background, borderColor: border, color: light < 40 ? '#fff' : 'var(--ink)' }
}

export const article = (n: number) => (n === 8 || n === 11 || n === 18 || (n >= 80 && n <= 89)) ? 'an' : 'a'
