import { birdFromTitle, DEFAULT_SOUNDS, kindFor, playAlertSound, type AlertKind } from './alertSounds'

/**
 * "Alert! mode": when a notification arrives while the app is open on screen, the app sounds the
 * alarm. The bar goes siren red, a glow pulses round the edges, "Alert!" flashes, and the sound
 * chosen for that kind of alert plays (src/alertSounds.ts). Bigger for rarer birds: a watch-list
 * bird is a gentle pulse, a notable or a lifer chance the full alarm, an ABA Code 4-5 the siren.
 * Settings are per device (it's about this screen and speaker), on by default.
 */
export type Intensity = 'gentle' | 'full' | 'siren'
export type Volume = 'quiet' | 'normal'
export interface AlertModeSettings { lights: boolean; sound: boolean; volume: Volume; sounds: Record<AlertKind, string>; voice: string | null }

const KEY = 'alertMode'
const DEFAULTS: AlertModeSettings = { lights: true, sound: true, volume: 'quiet', sounds: DEFAULT_SOUNDS, voice: null }
const DURATION_MS: Record<Intensity, number> = { gentle: 2400, full: 6000, siren: 9000 }
const INTENSITY: Record<AlertKind, Intensity> = { watchlist: 'gentle', notable: 'full', lifer: 'full', mega: 'siren' }
const VOLUME: Record<Volume, number> = { quiet: 0.45, normal: 1 }

/** Pure: how big the alarm is for a notification, from its title. */
export const intensityFor = (title: string): Intensity => INTENSITY[kindFor(title)]

export const readAlertMode = (): AlertModeSettings => {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<AlertModeSettings>
    return { ...DEFAULTS, ...kept, sounds: { ...DEFAULTS.sounds, ...(kept.sounds ?? {}) } }
  } catch { return DEFAULTS }
}
export const saveAlertMode = (settings: AlertModeSettings) => {
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* storage unavailable: defaults next time */ }
}

let settle: number | undefined
/** Sounds the alarm for a notification on this page, by the device's settings (or the ones given, for a preview). */
export const soundTheAlarm = (title: string, settings: AlertModeSettings = readAlertMode()) => {
  const kind = kindFor(title)
  const intensity = INTENSITY[kind]
  if (settings.lights) {
    const root = document.documentElement
    // Restart the animation if one is already running.
    delete root.dataset.alarm
    void root.offsetWidth
    root.dataset.alarm = intensity
    window.clearTimeout(settle)
    settle = window.setTimeout(() => { delete root.dataset.alarm }, DURATION_MS[intensity])
  }
  if (settings.sound) void playAlertSound(settings.sounds[kind], { ...birdFromTitle(title), volume: VOLUME[settings.volume], voice: settings.voice })
}
