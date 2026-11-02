/**
 * An invite opened before signing in: remembered for a day in this browser, so that after logging
 * in or signing up (and however that goes: password, passkey, a new account) the person lands back
 * on the invite to join.
 */
const KEY = 'bird-alert:join'
const DAY_MS = 24 * 60 * 60 * 1000

export const rememberJoin = (token: string) => {
  try { localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() })) } catch { /* this visit only */ }
}

export const pendingJoin = (): string | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { token?: string; at?: number } | null
    if (!saved?.token || !saved.at || Date.now() - saved.at > DAY_MS) return null
    return saved.token
  } catch { return null }
}

export const forgetJoin = () => {
  try { localStorage.removeItem(KEY) } catch { /* nothing kept */ }
}
