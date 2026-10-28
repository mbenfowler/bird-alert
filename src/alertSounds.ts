/**
 * The sounds Alert! mode can play, one chosen per kind of alert. Sci-fi and classic sounds are
 * made in the browser (no files); bird calls are short clips of xeno-canto recordings, cut and
 * levelled, kept in public/sounds/alerts (credits in CREDITS.txt there and in BIRD_CALLS here);
 * spoken ones use the device's own voice and say the bird's name. All free.
 */
export type AlertKind = 'watchlist' | 'notable' | 'mega' | 'lifer'
export type SoundGroup = 'Sci-fi' | 'Bird calls' | 'Spoken' | 'Classic' | 'Off'
export interface PlayContext { bird: string; code: number | null; volume: number; voice?: string | null }
export interface BirdCallCredit { xcId: number; recordist: string; license: string }
interface AlertSound { id: string; name: string; group: SoundGroup; play: (ctx: PlayContext) => Promise<void> | void; credit?: BirdCallCredit }

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
/** Spelled out, so every voice says the number the same way. */
const CODE_WORDS: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five' }

/**
 * The voices worth hearing, picked by ear on a Mac: Daniel (the default), plus five of the
 * novelty voices that make good alarms. Chrome and Safari name some of them with their region.
 */
const VOICES: { label: string; match: RegExp }[] = [
  { label: 'Daniel', match: /^Daniel\b/ },
  { label: 'Bad News', match: /^Bad News\b/ },
  { label: 'Bells', match: /^Bells\b/ },
  { label: 'Boing', match: /^Boing\b/ },
  { label: 'Grandpa', match: /^Grandpa \(English \((United States|US)\)\)/ },
  { label: 'Trinoids', match: /^Trinoids\b/ }
]
/** Fallbacks on devices without Daniel (Windows, Android): their natural voices. */
const FALLBACK_VOICES = [/\b(Natural|Premium|Enhanced)\b/i, /^Google UK English Male/i, /^Google US English/i, /^Microsoft (Ryan|Guy|Aria|Jenny)/i]

/** The voices on this device that can be chosen, Daniel first: { label, name }. */
export const alertVoices = (): { label: string; name: string }[] => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  const all = window.speechSynthesis.getVoices()
  return VOICES.flatMap(({ label, match }) => { const v = all.find((x) => match.test(x.name)); return v ? [{ label, name: v.name }] : [] })
}
/** The chosen voice if this device has it, else Daniel, else the device's best natural English voice. */
const pickVoice = (name?: string | null) => {
  const all = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []
  const chosen = all.find((v) => v.name === name) ?? all.find((v) => VOICES[0]!.match.test(v.name))
  if (chosen) return chosen
  const english = all.filter((v) => /^en(-|_|$)/i.test(v.lang))
  for (const re of FALLBACK_VOICES) { const v = english.find((x) => re.test(x.name)); if (v) return v }
  return english[0] ?? null
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
/** The recording each clip was cut from (see public/sounds/alerts/CREDITS.txt). */
const BIRD_CALLS: Record<string, BirdCallCredit> = {
  rethaw: { xcId: 645523, recordist: 'Bobby Wilcox', license: 'CC BY-NC-SA 4.0' },
  baleag: { xcId: 769877, recordist: 'Russ Wigh', license: 'CC BY-NC-SA 4.0' },
  comloo: { xcId: 432766, recordist: 'Stanislas Wroza', license: 'CC BY-NC-SA 4.0' },
  blujay: { xcId: 994294, recordist: 'Rory Nefdt', license: 'CC BY-NC-SA 4.0' },
  laukoo1: { xcId: 1104895, recordist: 'Tom Cooney', license: 'CC BY-NC-SA 4.0' },
  sancra: { xcId: 794683, recordist: 'Valerie Heemstra', license: 'CC BY-NC-SA 4.0' },
  comrav: { xcId: 1084372, recordist: 'Lars Edenius', license: 'CC BY-NC-SA 4.0' },
  osprey: { xcId: 145834, recordist: 'Paul Marvin', license: 'CC BY-NC-SA 3.0' },
  amecro: { xcId: 1104243, recordist: 'Fred Rowley', license: 'CC BY-NC-SA 4.0' }
}
/** A clip, already cut to the call and levelled, played whole. */
const birdCall = (speciesCode: string) => ({ volume }: PlayContext) => new Promise<void>((resolve) => {
  const clip = new Audio(`/sounds/alerts/${speciesCode}.m4a`)
  clip.volume = Math.min(1, 0.8 * volume)
  clip.onended = () => resolve()
  clip.onerror = () => resolve()
  void clip.play().catch(() => resolve())
  window.setTimeout(resolve, 8000)
})
const call = (id: string, name: string, code: string): AlertSound => ({ id, name, group: 'Bird calls', play: birdCall(code), credit: BIRD_CALLS[code] })

export const SOUNDS: AlertSound[] = [
  { id: 'chime', name: 'Gentle chime', group: 'Classic', play: chime },
  { id: 'pager', name: 'Pager', group: 'Classic', play: pager },
  { id: 'bridge-chirp', name: 'Bridge chirp', group: 'Sci-fi', play: bridgeChirp },
  { id: 'scanner', name: 'Scanner sweep', group: 'Sci-fi', play: scanner },
  { id: 'transporter', name: 'Transporter shimmer', group: 'Sci-fi', play: transporter },
  { id: 'proximity', name: 'Proximity alarm', group: 'Sci-fi', play: proximity },
  { id: 'red-alert', name: 'Red alert klaxon', group: 'Sci-fi', play: redAlert },
  { id: 'red-alert-say', name: 'Red alert + announcement', group: 'Sci-fi', play: async (ctx) => { await redAlert(ctx); await say(({ bird }) => `Red alert. ${bird}.`)(ctx) } },
  call('hawk', 'Red-tailed Hawk (the movie “eagle” scream)', 'rethaw'),
  call('eagle', 'Bald Eagle', 'baleag'),
  call('osprey', 'Osprey', 'osprey'),
  call('loon', 'Common Loon wail', 'comloo'),
  call('jay', 'Blue Jay alarm', 'blujay'),
  call('kookaburra', 'Laughing Kookaburra', 'laukoo1'),
  call('crane', 'Sandhill Crane', 'sancra'),
  call('raven', 'Common Raven', 'comrav'),
  call('crow', 'American Crow', 'amecro'),
  { id: 'say-bird-alert', name: '“Bird alert! … nearby.”', group: 'Spoken', play: say(({ bird }) => `Bird alert! ${bird} nearby.`) },
  { id: 'say-not-a-drill', name: '“This is not a drill.”', group: 'Spoken', play: say(({ bird }) => `This is not a drill. ${bird} reported nearby.`) },
  { id: 'say-binoculars', name: '“Grab your binoculars!”', group: 'Spoken', play: say(({ bird }) => `Grab your binoculars! ${bird}!`) },
  // The bird's own ABA code when it has one (3-5), otherwise the phrase as it's known: "code four".
  { id: 'say-code', name: '“Code four! Code four!”', group: 'Spoken', play: say(({ bird, code }) => { const n = CODE_WORDS[code ?? 4] ?? 'four'; return `Code ${n}! Code ${n}! ${bird}!` }) },
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
