import { getBirdSound } from './apiCalls'
import type { BirdSound } from './types'

/**
 * The sounds Alert! mode can play, one chosen per kind of alert. Sci-fi and classic sounds are
 * made in the browser (no files); bird calls are short clips of xeno-canto recordings, credited;
 * spoken ones use the device's own voice and say the bird's name. All free.
 */
export type AlertKind = 'watchlist' | 'notable' | 'mega' | 'lifer'
export type SoundGroup = 'Sci-fi' | 'Bird calls' | 'Spoken' | 'Classic' | 'Off'
export interface PlayContext { bird: string; code: number | null; volume: number; voice?: string | null }
interface AlertSound { id: string; name: string; group: SoundGroup; play: (ctx: PlayContext) => Promise<void> | void; birdCode?: string }

export const KIND_LABEL: Record<AlertKind, string> = { watchlist: 'Watch list', notable: 'Notable', mega: 'ABA Code 4–5', lifer: 'Lifer chance' }
export const DEFAULT_SOUNDS: Record<AlertKind, string> = { watchlist: 'chime', notable: 'bridge-chirp', lifer: 'say-binoculars', mega: 'red-alert-say' }
/** What a preview pretends arrived, per kind. */
export const EXAMPLE: Record<AlertKind, { title: string }> = {
  watchlist: { title: '⭐ Painted Bunting spotted nearby!' },
  notable: { title: '❗ Notable: Black Scoter reported nearby' },
  mega: { title: '❗ ABA Code 4: Roadside Hawk reported nearby' },
  lifer: { title: '🎯 Lifer chance: Sedge Wren reported nearby' }
}

/** Pure: which kind an alert is, from its notification title. */
export const kindFor = (title: string): AlertKind => {
  if (/ABA Code [45]\b/.test(title)) return 'mega'
  if (/^🎯/u.test(title.trim())) return 'lifer'
  if (/^❗/u.test(title.trim())) return 'notable'
  return 'watchlist'
}

/** Pure: the bird and the ABA code a title names ("❗ ABA Code 4: Roadside Hawk reported nearby" → Roadside Hawk, 4). */
export const birdFromTitle = (title: string): { bird: string; code: number | null } => {
  const code = /ABA Code ([3-5])\b/.exec(title)
  const bird = title
    .replace(/^[^\p{L}]*/u, '')
    .replace(/^(Notable|ABA Code \d|Lifer chance|Test):\s*/i, '')
    .replace(/^First\s+/i, '')
    .replace(/\s+(reported nearby|spotted nearby!?|of the season!?)\s*$/i, '')
    .replace(/^\d+ watch list birds$/i, 'watch list birds')
    .trim()
  return { bird: bird || 'a bird', code: code ? Number(code[1]) : null }
}

// ---- made in the browser ----
let audio: AudioContext | null = null
/** Browsers only let a page play sound after a click or key on it; the first one opens the audio here. */
export const unlockAudio = () => {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audio ??= new Ctx()
    void audio.resume()
  } catch { audio = null }
}
if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, unlockAudio, { passive: true })
}
const ready = () => (audio && audio.state === 'running' ? audio : null)

/** One note: a shape, a pitch (optionally sliding), a soft envelope, through an optional low-pass. */
const note = (a: AudioContext, o: { at: number; dur: number; freq: number; to?: number; type?: OscillatorType; gain: number; decay?: boolean; lowpass?: number }) => {
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, o.at)
  if (o.to) osc.frequency.linearRampToValueAtTime(o.to, o.at + o.dur)
  g.gain.setValueAtTime(0.0001, o.at)
  g.gain.exponentialRampToValueAtTime(o.gain, o.at + 0.015)
  if (o.decay) g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur)
  else { g.gain.setValueAtTime(o.gain, o.at + o.dur - 0.03); g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur) }
  let out: AudioNode = g
  if (o.lowpass) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass; g.connect(f); out = f }
  osc.connect(g)
  out.connect(a.destination)
  osc.start(o.at)
  osc.stop(o.at + o.dur + 0.05)
}
const synth = (build: (a: AudioContext, t: number, v: number) => number) => ({ volume }: PlayContext) => new Promise<void>((resolve) => {
  const a = ready()
  if (!a) return resolve()
  const seconds = build(a, a.currentTime + 0.02, volume)
  window.setTimeout(resolve, seconds * 1000 + 50)
})

const chime = synth((a, t, v) => {
  // Three bell notes, each with a quiet octave above, ringing out.
  ;[1318.5, 1046.5, 1568].forEach((f, i) => {
    note(a, { at: t + i * 0.16, dur: 1.1, freq: f, gain: 0.09 * v, decay: true })
    note(a, { at: t + i * 0.16, dur: 0.6, freq: f * 2, gain: 0.025 * v, decay: true })
  })
  return 1.5
})
const pager = synth((a, t, v) => { [0, 0.22].forEach((d) => note(a, { at: t + d, dur: 0.12, freq: 2900, type: 'square', gain: 0.03 * v, lowpass: 5000 })); return 0.4 })
const bridgeChirp = synth((a, t, v) => {
  // Two quick rising blips, twice: a ship's communicator.
  ;[0, 0.11, 0.42, 0.53].forEach((d) => note(a, { at: t + d, dur: 0.07, freq: 1250, to: 1900, gain: 0.08 * v }))
  return 0.7
})
const scanner = synth((a, t, v) => {
  for (let i = 0; i < 8; i++) note(a, { at: t + i * 0.09, dur: 0.045, freq: i % 2 ? 2400 : 1900, type: 'square', gain: 0.025 * v, lowpass: 4000 })
  return 0.8
})
const transporter = synth((a, t, v) => {
  // A swell of high partials, each shimmering at its own rate.
  for (let i = 0; i < 9; i++) {
    const osc = a.createOscillator(); const g = a.createGain(); const lfo = a.createOscillator(); const depth = a.createGain()
    osc.frequency.value = 1200 + i * 330
    lfo.frequency.value = 9 + i * 1.7; depth.gain.value = 0.012 * v
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.014 * v, t + 0.8); g.gain.linearRampToValueAtTime(0.0001, t + 1.8)
    lfo.connect(depth).connect(g.gain); osc.connect(g).connect(a.destination)
    osc.start(t); lfo.start(t); osc.stop(t + 1.85); lfo.stop(t + 1.85)
  }
  return 1.9
})
const proximity = synth((a, t, v) => { for (let i = 0; i < 5; i++) note(a, { at: t + i * 0.24, dur: 0.12, freq: 1046.5, type: 'square', gain: 0.03 * v, lowpass: 3000 }); return 1.2 })
const redAlert = synth((a, t, v) => {
  // The klaxon: a softened sawtooth whooping upward, three times.
  for (let i = 0; i < 3; i++) note(a, { at: t + i * 0.75, dur: 0.62, freq: 440, to: 880, type: 'sawtooth', gain: 0.05 * v, lowpass: 1600 })
  return 2.25
})

// ---- spoken ----
/**
 * Voices that sound like a person, best first. Browsers default to whatever the system lists
 * first, which on a Mac can be a novelty voice; these are the good ones on Apple, Google and
 * Microsoft systems ("Enhanced", "Premium" and "Natural" are the higher-quality downloads).
 */
const GOOD_VOICES = [/\b(Premium|Enhanced|Natural)\b/i, /^Samantha/i, /^Google US English/i, /^Daniel/i, /^Karen/i, /^Moira/i, /^Microsoft (Aria|Jenny|Guy)/i, /^Google UK English/i, /^Alex$/i]
/** Novelty and robotic voices, never picked on their own. */
const SILLY_VOICES = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)\b/i

/** This device's English voices, for choosing one, best first. */
export const englishVoices = (): SpeechSynthesisVoice[] => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  const rank = (v: SpeechSynthesisVoice) => { const i = GOOD_VOICES.findIndex((re) => re.test(v.name)); return i === -1 ? GOOD_VOICES.length + (SILLY_VOICES.test(v.name) ? 1 : 0) : i }
  return window.speechSynthesis.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang)).sort((a, b) => rank(a) - rank(b) || Number(b.localService) - Number(a.localService))
}
/** The chosen voice if this device has it, else the best one it has. */
const pickVoice = (name?: string | null) => {
  const voices = englishVoices()
  return voices.find((v) => v.name === name) ?? voices.find((v) => !SILLY_VOICES.test(v.name)) ?? null
}
// The list arrives late in some browsers; asking once early gets it loading.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.getVoices()

const say = (text: (ctx: PlayContext) => string) => (ctx: PlayContext) => new Promise<void>((resolve) => {
  if (!('speechSynthesis' in window)) return resolve()
  const synth = window.speechSynthesis
  const u = new SpeechSynthesisUtterance(text(ctx))
  const voice = pickVoice(ctx.voice)
  if (voice) { u.voice = voice; u.lang = voice.lang }
  u.volume = Math.min(1, ctx.volume)
  u.rate = 1
  u.pitch = 1
  u.onend = () => resolve()
  u.onerror = () => resolve()
  // Cancelling and speaking in the same moment garbles the start in Chrome, so only clear the queue if something is in it.
  if (synth.speaking || synth.pending) synth.cancel()
  window.setTimeout(() => synth.speak(u), 60)
  window.setTimeout(resolve, 8000)
})

// ---- bird calls ----
const credits = new Map<string, BirdSound>()
/** The recording a bird-call sound uses, with its credit (cached for the session). */
export const birdCallCredit = async (speciesCode: string) => {
  if (!credits.has(speciesCode)) credits.set(speciesCode, await getBirdSound(speciesCode))
  return credits.get(speciesCode)!
}
const birdCall = (speciesCode: string, seconds = 4) => async ({ volume }: PlayContext) => {
  const sound = await birdCallCredit(speciesCode).catch(() => null)
  if (!sound?.found || !sound.url) return
  const clip = new Audio(sound.url)
  const peak = Math.min(1, 0.55 * volume)
  clip.volume = peak
  await clip.play().catch(() => undefined)
  // A short clip, faded out, not the whole recording.
  await new Promise<void>((resolve) => {
    const stopAt = window.setTimeout(() => {
      let step = 0
      const fade = window.setInterval(() => {
        step += 1
        clip.volume = Math.max(0, peak * (1 - step / 8))
        if (step >= 8) { window.clearInterval(fade); clip.pause(); resolve() }
      }, 60)
    }, seconds * 1000)
    clip.onended = () => { window.clearTimeout(stopAt); resolve() }
  })
}

export const SOUNDS: AlertSound[] = [
  { id: 'chime', name: 'Gentle chime', group: 'Classic', play: chime },
  { id: 'pager', name: 'Pager', group: 'Classic', play: pager },
  { id: 'bridge-chirp', name: 'Bridge chirp', group: 'Sci-fi', play: bridgeChirp },
  { id: 'scanner', name: 'Scanner sweep', group: 'Sci-fi', play: scanner },
  { id: 'transporter', name: 'Transporter shimmer', group: 'Sci-fi', play: transporter },
  { id: 'proximity', name: 'Proximity alarm', group: 'Sci-fi', play: proximity },
  { id: 'red-alert', name: 'Red alert klaxon', group: 'Sci-fi', play: redAlert },
  { id: 'red-alert-say', name: 'Red alert + announcement', group: 'Sci-fi', play: async (ctx) => { await redAlert(ctx); await say(({ bird }) => `Red alert. ${bird}.`)(ctx) } },
  { id: 'hawk', name: 'Red-tailed Hawk (the movie “eagle” scream)', group: 'Bird calls', play: birdCall('rethaw'), birdCode: 'rethaw' },
  { id: 'eagle', name: 'Bald Eagle', group: 'Bird calls', play: birdCall('baleag'), birdCode: 'baleag' },
  { id: 'loon', name: 'Common Loon wail', group: 'Bird calls', play: birdCall('comloo', 6), birdCode: 'comloo' },
  { id: 'jay', name: 'Blue Jay alarm', group: 'Bird calls', play: birdCall('blujay'), birdCode: 'blujay' },
  { id: 'kookaburra', name: 'Laughing Kookaburra', group: 'Bird calls', play: birdCall('laukoo1', 6), birdCode: 'laukoo1' },
  { id: 'owl', name: 'Barred Owl (“who cooks for you”)', group: 'Bird calls', play: birdCall('brdowl', 5), birdCode: 'brdowl' },
  { id: 'crane', name: 'Sandhill Crane', group: 'Bird calls', play: birdCall('sancra'), birdCode: 'sancra' },
  { id: 'raven', name: 'Common Raven', group: 'Bird calls', play: birdCall('comrav'), birdCode: 'comrav' },
  { id: 'woodpecker', name: 'Pileated Woodpecker', group: 'Bird calls', play: birdCall('pilwoo'), birdCode: 'pilwoo' },
  { id: 'killdeer', name: 'Killdeer', group: 'Bird calls', play: birdCall('killde'), birdCode: 'killde' },
  { id: 'say-bird-alert', name: '“Bird alert! … nearby.”', group: 'Spoken', play: say(({ bird }) => `Bird alert! ${bird} nearby.`) },
  { id: 'say-not-a-drill', name: '“This is not a drill.”', group: 'Spoken', play: say(({ bird }) => `This is not a drill. ${bird} reported nearby.`) },
  { id: 'say-binoculars', name: '“Grab your binoculars!”', group: 'Spoken', play: say(({ bird }) => `Grab your binoculars! ${bird}!`) },
  { id: 'say-code', name: '“Code four! Code four!”', group: 'Spoken', play: say(({ bird, code }) => code ? `Code ${code}! Code ${code}! ${bird}!` : `Heads up! ${bird}!`) },
  { id: 'say-mission', name: '“Mission control, we have a…”', group: 'Spoken', play: say(({ bird }) => `Mission control, we have a ${bird}.`) },
  { id: 'say-drop', name: '“Drop everything.”', group: 'Spoken', play: say(({ bird }) => `Drop everything. ${bird}.`) },
  { id: 'none', name: 'None (lights only)', group: 'Off', play: () => undefined }
]
export const SOUND_GROUPS: SoundGroup[] = ['Classic', 'Sci-fi', 'Bird calls', 'Spoken', 'Off']
export const soundById = (id: string) => SOUNDS.find((s) => s.id === id) ?? SOUNDS.find((s) => s.id === 'none')!

let playing = false
/** Plays a sound once; a second alert while one plays is skipped rather than talked over. */
export const playAlertSound = async (id: string, ctx: PlayContext) => {
  if (playing) return
  playing = true
  try { await soundById(id).play(ctx) } finally { playing = false }
}
