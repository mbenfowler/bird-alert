import { useBirdSound, type SoundState } from '../../hooks/useBirdSound'
import type { BirdSound } from '../../types'
import './SoundButton.css'

const PlayIcon = () => <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'><path d='M8 5v14l11-7z' /></svg>
const PauseIcon = () => <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'><path d='M6 5h4v14H6zm8 0h4v14h-4z' /></svg>
const MuteIcon = () => <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'><path d='M16.5 12A4.5 4.5 0 0 0 14 8v2.2l2.5 2.5zM19 12c0 .9-.2 1.8-.5 2.6l1.5 1.5A8.9 8.9 0 0 0 21 12a9 9 0 0 0-7-8.8v2.1A7 7 0 0 1 19 12zM4.3 3 3 4.3 7.7 9H3v6h4l5 5v-6.7l4.3 4.3a7 7 0 0 1-2.3 1.3v2.1a9 9 0 0 0 3.7-1.9l2 2 1.3-1.3zM12 4 9.9 6.1 12 8.2z' /></svg>

/** The credit the recording's Creative Commons license asks for: the XC number, recordist and license. */
export const SoundCredit = ({ sound, className }: { sound: BirdSound | null; className?: string }) => {
  if (!sound?.found) return null
  return (
    <span className={`sound-credit ${className ?? ''}`}>
      <a href={sound.page} target='_blank' rel='noreferrer'>XC{sound.xcId}</a>
      {sound.recordist ? ` · ${sound.recordist}` : ''}
      {sound.licenseName ? ` · ${sound.licenseName}` : ''}
    </span>
  )
}

const labelFor = (state: SoundState, name: string) =>
  state === 'none' ? `No recording of ${name} available` : state === 'playing' ? `Pause the ${name} recording` : `Hear a ${name}`

const iconFor = (state: SoundState) => state === 'none' ? <MuteIcon /> : state === 'playing' ? <PauseIcon /> : <PlayIcon />

interface SoundToggleProps { state: SoundState; name: string; onToggle: () => void; className?: string }

/** The round play/pause button on its own, for a page that places the credit itself (cards). */
export const SoundToggle = ({ state, name, onToggle, className }: SoundToggleProps) => {
  const label = labelFor(state, name)
  return (
    <button type='button' className={`sound__round ${className ?? ''}`} onClick={onToggle} aria-label={label} aria-pressed={state === 'playing'} aria-busy={state === 'loading'} disabled={state === 'none'} data-state={state} title={label}>
      {iconFor(state)}
    </button>
  )
}

interface SoundButtonProps { code: string; name: string; className?: string }

/** "Hear it" pill with the credit beside it while the recording plays (species page). */
const SoundButton = ({ code, name, className }: SoundButtonProps) => {
  const { state, sound, toggle } = useBirdSound(code, name)
  const playing = state === 'playing'
  return (
    <span className={`sound sound--pill ${className ?? ''}`}>
      <button type='button' className='pill-button sound__pill' onClick={() => { void toggle() }} aria-pressed={playing} aria-busy={state === 'loading'} disabled={state === 'none'} data-state={state}>
        {iconFor(state)}
        <span>{state === 'none' ? 'No recording' : playing ? 'Playing…' : state === 'loading' ? 'Loading…' : 'Hear it'}</span>
        <span className='visually-hidden'>{state === 'none' ? ` of ${name}` : playing ? `, pause the ${name} recording` : `: a ${name} recording`}</span>
      </button>
      {(playing || state === 'paused') && <SoundCredit sound={sound} />}
    </span>
  )
}

export default SoundButton
