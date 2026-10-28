import { useEffect, useState } from 'react'
import { readAlertMode, saveAlertMode, soundTheAlarm, type AlertModeSettings as Settings } from '../../alertMode'
import { birdCallCredit, birdFromTitle, englishVoices, EXAMPLE, KIND_LABEL, playAlertSound, SOUND_GROUPS, SOUNDS, soundById, unlockAudio, type AlertKind } from '../../alertSounds'
import { SoundCredit } from '../SoundButton/SoundButton'
import type { BirdSound } from '../../types'
import './AlertModeSettings.css'

const KINDS: AlertKind[] = ['watchlist', 'notable', 'lifer', 'mega']
const isSpoken = (id: string) => id.startsWith('say-') || id === 'red-alert-say'

/** This device's English voices; the list arrives late in some browsers, so it follows the change event. */
const useVoices = () => {
  const [voices, setVoices] = useState(englishVoices)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const update = () => setVoices(englishVoices())
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

/** The recording behind a bird-call sound, credited as its license asks. */
const Credit = ({ soundId }: { soundId: string }) => {
  const code = soundById(soundId).birdCode
  // Kept with the code it belongs to, so switching sounds never shows the last one's credit.
  const [credit, setCredit] = useState<{ code: string; sound: BirdSound } | null>(null)
  useEffect(() => {
    let live = true
    if (code) void birdCallCredit(code).then((sound) => { if (live) setCredit({ code, sound }) }).catch(() => undefined)
    return () => { live = false }
  }, [code])
  return code && credit?.code === code ? <p className='alert-mode__credit'>Recording: <SoundCredit sound={credit.sound} /></p> : null
}

/**
 * Alert! mode's settings, kept on this device: lights, sound, how loud, and a sound for each
 * kind of alert, each one previewable. Greyed out until push is on here, since only an alert
 * can set it off.
 */
const AlertModeSettings = ({ disabled }: { disabled: boolean }) => {
  const [settings, setSettings] = useState<Settings>(readAlertMode)
  const voices = useVoices()
  const speaks = KINDS.some((kind) => isSpoken(settings.sounds[kind]))
  const change = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch, sounds: { ...settings.sounds, ...(patch.sounds ?? {}) } }
    setSettings(next)
    saveAlertMode(next)
  }
  const preview = (kind: AlertKind) => {
    unlockAudio()
    const { title } = EXAMPLE[kind]
    void playAlertSound(settings.sounds[kind], { ...birdFromTitle(title), volume: settings.volume === 'quiet' ? 0.45 : 1, voice: settings.voice })
  }
  return (
    <div className='alert-mode' aria-disabled={disabled}>
      <div className='alert-mode__row'>
        <label><input className='switch switch--small' type='checkbox' checked={settings.lights} disabled={disabled} onChange={(e) => change({ lights: e.target.checked })} /> Lights</label>
        <label><input className='switch switch--small' type='checkbox' checked={settings.sound} disabled={disabled} onChange={(e) => change({ sound: e.target.checked })} /> Sound</label>
        <fieldset className='alert-mode__volume' disabled={disabled || !settings.sound}>
          <legend className='visually-hidden'>Volume</legend>
          {(['quiet', 'normal'] as const).map((v) => (
            <label key={v} className={settings.volume === v ? 'is-selected' : undefined}>
              <input type='radio' name='alert-mode-volume' value={v} checked={settings.volume === v} onChange={() => change({ volume: v })} />
              {v === 'quiet' ? 'Quiet' : 'Normal'}
            </label>
          ))}
        </fieldset>
      </div>
      <ul className='alert-mode__sounds'>
        {KINDS.map((kind) => (
          <li key={kind}>
            <label htmlFor={`alert-sound-${kind}`}>{KIND_LABEL[kind]}</label>
            <div className='alert-mode__pick'>
              <select id={`alert-sound-${kind}`} value={settings.sounds[kind]} disabled={disabled || !settings.sound} onChange={(e) => change({ sounds: { [kind]: e.target.value } as Record<AlertKind, string> })}>
                {SOUND_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {SOUNDS.filter((s) => s.group === group).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ))}
              </select>
              <button type='button' className='alert-mode__play' aria-label={`Hear the ${KIND_LABEL[kind]} sound`} disabled={disabled || !settings.sound || settings.sounds[kind] === 'none'} onClick={() => preview(kind)}>▶</button>
            </div>
            <Credit soundId={settings.sounds[kind]} />
          </li>
        ))}
      </ul>
      {/* Spoken sounds use this device's own voices; the best one is picked unless another is chosen. */}
      {speaks && voices.length > 0 && (
        <div className='alert-mode__voice'>
          <label htmlFor='alert-voice'>Voice</label>
          <div className='alert-mode__pick'>
            <select id='alert-voice' value={settings.voice ?? ''} disabled={disabled || !settings.sound} onChange={(e) => change({ voice: e.target.value || null })}>
              <option value=''>Best on this device ({voices[0]!.name})</option>
              {voices.map((v) => <option key={v.voiceURI} value={v.name}>{v.name}{v.localService ? '' : ' (online)'}</option>)}
            </select>
            <button type='button' className='alert-mode__play' aria-label='Hear this voice' disabled={disabled || !settings.sound} onClick={() => { unlockAudio(); void playAlertSound('say-bird-alert', { bird: 'Roadside Hawk', code: 4, volume: settings.volume === 'quiet' ? 0.45 : 1, voice: settings.voice }) }}>▶</button>
          </div>
        </div>
      )}
      <button type='button' className='test-push test-push--inline' disabled={disabled || (!settings.lights && !settings.sound)} onClick={() => { unlockAudio(); soundTheAlarm(EXAMPLE.mega.title, settings) }}>Try the full alarm</button>
    </div>
  )
}

export default AlertModeSettings
