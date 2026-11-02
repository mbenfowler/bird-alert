import type { EventMember, GroupEvent } from '../../types'
import { t } from '../../i18n'

const dayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const today = () => dayString(new Date())
export const daysBefore = (day: string, days: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() - days); return dayString(d) }

// Scouting lead times, in days (1-4 weeks); a Big Day scouts three weeks ahead unless told otherwise.
export const SCOUT_DAYS = [7, 14, 21, 28] as const
export const DEFAULT_SCOUT_DAYS = 21
// The server's limit on an event's target birds.
export const MAX_TARGETS = 50

/** The day scouting starts, when the event scouts at all. */
export const scoutFrom = (event: Pick<GroupEvent, 'scout' | 'scout_from' | 'scout_days' | 'starts_on'>) =>
  event.scout ? (event.scout_from ?? daysBefore(event.starts_on, event.scout_days ?? DEFAULT_SCOUT_DAYS)) : null

/** Inside the scouting window: scouting has started and the event hasn't. */
export const isScouting = (event: GroupEvent, now = today()) => {
  const from = scoutFrom(event)
  return from !== null && !event.active && now >= from && now < event.starts_on
}

/** Over: the server says so, or its last day is behind us. */
export const isPast = (event: GroupEvent, now = today()) => Boolean(event.past) || (!event.active && event.ends_on < now)

/** Someone besides you is in it. */
export const isGroup = (event: GroupEvent) => event.members.length > 1

/** "Matt (organizer), Jane, Sam": the organizer first, as the group knows them. */
export const membersText = (members: EventMember[]) =>
  [...members].sort((a, b) => Number(b.role === 'organizer') - Number(a.role === 'organizer'))
    .map(m => {
      const name = m.display_name ?? (m.you ? t('events.you') : '')
      return m.role === 'organizer' ? t('events.organizer', { name }) : name
    })
    .filter(Boolean)
    .join(', ')

/** The codes on the tally, newest first, once each. */
export const tallyCodes = (event: Pick<GroupEvent, 'tally'>) => [...new Set((event.tally ?? []).map(entry => entry.code))]

/** "142 species · 31 of 40 targets", from the server's recap or, failing that, the tally itself. */
export const recapText = (event: GroupEvent) => {
  const species = event.recap?.species ?? tallyCodes(event).length
  const total = event.recap?.targets_total ?? event.targets.length
  const got = event.recap?.targets_got ?? event.targets.filter(target => tallyCodes(event).includes(target.code)).length
  return total > 0 ? t('events.recapTargets', { count: species, got, total }) : t('events.recap', { count: species })
}

export const eventPath = (id: GroupEvent['id']) => `/events/${encodeURIComponent(String(id))}`
