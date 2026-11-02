import { Link } from 'react-router'
import { Trans } from 'react-i18next'
import { useCurrentUser, useEventsQuery } from '../../hooks/queries'
import { t } from '../../i18n'
import { tallyCodes } from './events'
import '../AreaBanner/AreaBanner.css'

/** On the event day, the home screen leads with it: "Big Day today: Chiricahuas · 31 species · Open tally". */
const EventBanner = () => {
  const user = useCurrentUser()
  const active = user.activeEvent ?? null
  const events = useEventsQuery(Boolean(active))
  if (!active) return null
  const event = events.data?.find(e => String(e.id) === String(active.id))
  const count = event ? tallyCodes(event).length : (active.count ?? 0)
  const bigDay = event ? event.kind === 'bigday' : true
  return (
    <p className='area-banner area-banner--place event-banner' role='status' data-testid='event-banner'>
      <span><Trans i18nKey={bigDay ? 'events.banner' : 'events.bannerTrip'} values={{ name: active.name, count }} components={{ b: <strong /> }} /></span>
      <Link className='link-button link-text' to={`/events/${encodeURIComponent(String(active.id))}/tally`}>{t('events.openTally')}</Link>
    </p>
  )
}

export default EventBanner
