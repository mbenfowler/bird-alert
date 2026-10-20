import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, deleteSavedBird, getBirdsByCodes, getUserExists, login } from './apiCalls'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends JSON bodies with same-origin credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    await login('a@b.co', 'secret123')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.co', password: 'secret123' })
  })

  it('encodes query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ userExists: true }))
    vi.stubGlobal('fetch', fetchMock)

    await getUserExists('a+b@example.com')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/exists?email=a%2Bb%40example.com')
  })

  it('surfaces the server error message with its status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'Incorrect email or password' }, 401)))

    const failure = login('a@b.co', 'nope').catch(error => error)
    await expect(failure).resolves.toBeInstanceOf(ApiError)
    await expect(failure).resolves.toMatchObject({ status: 401, message: 'Incorrect email or password' })
  })

  it('falls back to an HTTP message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>oops</html>', { status: 502, statusText: 'Bad Gateway' })))

    await expect(login('a@b.co', 'x')).rejects.toMatchObject({ status: 502, message: 'HTTP Error: 502 Bad Gateway' })
  })

  it('treats 204 as null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(deleteSavedBird('snogoo')).resolves.toBeNull()
  })

  it('does not call the network for an empty code list', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(getBirdsByCodes([])).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
