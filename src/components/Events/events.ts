import type { EventMember, GroupEvent } from '../../types'
import { t } from '../../i18n'

const dayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const today = () => dayString(new Date())
export const daysBefore = (day: string, days: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() - days); return dayString(d) }

/** The day scouting starts, when the event scouts at all. */
export const scoutFrom = (event: Pick<GroupEvent, 'scout' | 'scout_from' | 'scout_days' | 'starts_on'>) =>
  event.scout ? (event.scout_from ?? daysBefore(event.starts_on, event.scout_days ?? 21)) : null

/** "Matt (organizer), Jane, Sam": the organizer first, as the group knows them. */
export const membersText = (members: EventMember[]) =>
  [...members].sort((a, b) => Number(b.role === 'organizer') - Number(a.role === 'organizer'))
    .map(m => (m.role === 'organizer' ? t('events.organizer', { name: m.display_name }) : m.display_name))
    .join(', ')

/** The codes on the tally, newest first, once each. */
export const tallyCodes = (event: Pick<GroupEvent, 'tally'>) => [...new Set((event.tally ?? []).map(entry => entry.code))]
