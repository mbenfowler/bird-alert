import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const toast = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }))
vi.mock('react-toastify', () => ({ toast }))
const getBirdSound = vi.hoisted(() => vi.fn())
vi.mock('../apiCalls', () => ({ getBirdSound }))

import { useBirdSound } from './useBirdSound'
import { queryClient } from '../queryClient'

/** A stand-in for the browser's Audio: records what the hook does to it and lets a test fire its events. */
class FakeAudio {
  static instances: FakeAudio[] = []
  src: string
  preload = ''
  paused = true
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(src: string) { this.src = src; FakeAudio.instances.push(this) }
  play = vi.fn(async () => { this.paused = false })
  pause = vi.fn(() => { this.paused = true })
  removeAttribute = vi.fn((name: string) => { if (name === 'src') { this.src = ''; this.onerror?.() } })
  load = vi.fn()
}

describe('useBirdSound', () => {
  beforeEach(() => {
    FakeAudio.instances = []
    vi.stubGlobal('Audio', FakeAudio)
    queryClient.clear()
    getBirdSound.mockResolvedValue({ speciesCode: 'cangoo', found: true, xcId: 1, url: 'https://xeno-canto.org/1/download', page: 'https://xeno-canto.org/1', licenseName: 'CC BY-NC-SA 4.0', recordist: 'A Birder' })
  })
  afterEach(() => { vi.unstubAllGlobals(); toast.error.mockClear(); toast.info.mockClear(); getBirdSound.mockClear() })

  it('fetches once on the first tap, plays, pauses, and resumes without fetching again', async () => {
    const { result } = renderHook(() => useBirdSound('cangoo', 'Canada Goose'))
    expect(result.current.state).toBe('idle')
    await act(async () => { await result.current.toggle() })
    expect(getBirdSound).toHaveBeenCalledTimes(1)
    expect(result.current.state).toBe('playing')
    expect(FakeAudio.instances[0].play).toHaveBeenCalled()
    await act(async () => { await result.current.toggle() })
    expect(result.current.state).toBe('paused')
    await act(async () => { await result.current.toggle() })
    expect(result.current.state).toBe('playing')
    expect(getBirdSound).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('leaving the page releases the audio without reporting an error', async () => {
    const { result, unmount } = renderHook(() => useBirdSound('cangoo', 'Canada Goose'))
    await act(async () => { await result.current.toggle() })
    const audio = FakeAudio.instances[0]
    unmount()
    expect(audio.pause).toHaveBeenCalled()
    expect(audio.removeAttribute).toHaveBeenCalledWith('src')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('says so when the species has no recording', async () => {
    getBirdSound.mockResolvedValue({ speciesCode: 'emgoo1', found: false })
    const { result } = renderHook(() => useBirdSound('emgoo1', 'Emperor Goose'))
    await act(async () => { await result.current.toggle() })
    expect(result.current.state).toBe('none')
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Emperor Goose'), expect.anything())
    expect(FakeAudio.instances).toHaveLength(0)
  })

  it('starting one bird stops another', async () => {
    const goose = renderHook(() => useBirdSound('cangoo', 'Canada Goose'))
    await act(async () => { await goose.result.current.toggle() })
    const cardinal = renderHook(() => useBirdSound('norcar', 'Northern Cardinal'))
    await act(async () => { await cardinal.result.current.toggle() })
    expect(FakeAudio.instances[0].pause).toHaveBeenCalled()
    expect(goose.result.current.state).toBe('paused')
    expect(cardinal.result.current.state).toBe('playing')
  })
})
