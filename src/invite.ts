/**
 * The one-time nudge to invite a birding friend, offered after a happy moment: a lifer just
 * celebrated, or a rare-bird alert opened. Once per person ever: whichever answer (Invite or Not
 * now) is kept in this browser and it never comes back. Never in an account's first 3 days, and
 * never on an event's pages or on the day of an event, when they're busy birding.
 */

export type InviteMoment = 'lifer' | 'rare'

const KEY = 'bird-alert:invite-nudge'
export const QUIET_DAYS = 3
const DAY = 86_400_000

export const nudgeDone = () => { try { return Boolean(localStorage.getItem(KEY)) } catch { return false } }
/** Remembers the answer ('invited' or 'not-now'); either way the nudge is done for good. */
export const finishNudge = (answer: 'invited' | 'not-now') => { try { localStorage.setItem(KEY, answer) } catch { /* private mode: it may show once more */ } }

/** Pure: whether the nudge may show for this account, now, on this page. */
export const mayNudge = ({ createdAt, now, pathname, eventToday, done }: { createdAt: string | undefined; now: number; pathname: string; eventToday: boolean; done: boolean }) => {
  if (done || eventToday || pathname.startsWith('/events')) return false
  const created = createdAt ? Date.parse(createdAt) : NaN
  return Number.isFinite(created) && now - created >= QUIET_DAYS * DAY
}

/** Says whether the nudge will show for this moment. */
type Listener = (moment: InviteMoment) => boolean
let listener: Listener | null = null
let offeredThisVisit = false

/** The nudge the app mounts registers here. */
export const onInviteNudge = (next: Listener) => {
  listener = next
  return () => { if (listener === next) listener = null }
}

/** A happy moment: offers the nudge (the nudge itself decides whether it may show). At most once a visit. */
export const offerInvite = (moment: InviteMoment) => {
  if (!listener || offeredThisVisit || nudgeDone()) return
  if (listener(moment)) offeredThisVisit = true
}
