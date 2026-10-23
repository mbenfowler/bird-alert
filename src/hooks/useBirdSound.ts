import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { getBirdSound } from '../apiCalls'
import { queryClient } from '../queryClient'
import type { BirdSound } from '../types'

export type SoundState = 'idle' | 'loading' | 'playing' | 'paused' | 'none'

const DAY = 24 * 60 * 60 * 1000

// One bird at a time: starting a sound stops whichever was playing.
let current: { audio: HTMLAudioElement; stop: () => void } | null = null
const takeOver = (audio: HTMLAudioElement, stop: () => void) => {
  if (current && current.audio !== audio) current.stop()
  current = { audio, stop }
}

/**
 * Plays a species' representative recording on demand. Nothing is fetched until the first tap;
 * the lookup is cached for a day and the recording streams from xeno-canto.
 */
export const useBirdSound = (code: string, name: string) => {
  const [state, setState] = useState<SoundState>('idle')
  const [sound, setSound] = useState<BirdSound | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => {
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.src = ''; if (current?.audio === audio) current = null }
  }, [])

  const load = useCallback(async () => {
    const found = await queryClient.fetchQuery({ queryKey: ['sound', code], queryFn: () => getBirdSound(code), staleTime: DAY })
    setSound(found)
    return found
  }, [code])

  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (audio && state === 'playing') { audio.pause(); setState('paused'); return }
    if (audio && state === 'paused') { takeOver(audio, () => { audio.pause(); setState('paused') }); await audio.play().catch(() => setState('paused')); setState('playing'); return }
    if (state === 'loading') return
    setState('loading')
    try {
      const found = sound ?? await load()
      if (!found.found || !found.url) {
        setState('none')
        toast.info(`No recording of ${name} on xeno-canto yet.`, { position: 'bottom-center' })
        return
      }
      const next = new Audio(found.url)
      next.preload = 'auto'
      next.onended = () => setState('idle')
      next.onerror = () => { setState('idle'); toast.error('The recording could not be played.', { position: 'bottom-center' }) }
      audioRef.current = next
      takeOver(next, () => { next.pause(); setState('paused') })
      await next.play()
      setState('playing')
    } catch (error) {
      setState('idle')
      toast.error(error instanceof Error && error.message ? error.message : 'The recording could not be played.', { position: 'bottom-center' })
    }
  }, [state, sound, load, name])

  return { state, sound, toggle }
}
