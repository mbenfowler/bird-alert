import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Trans } from 'react-i18next'
import { useCurrentUser, useEventsQuery } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { useAreaName } from '../../shownArea'
import { daysUntil, t } from '../../i18n'
import { eventPath, tallyCodes } from './events'
import '../AreaBanner/AreaBanner.css'

/**
 * Events on the home screen. On the day it leads: "Big Day today: Chiricahuas · 31 species · Open
 * tally". Otherwise an event within the week ("Chiricahuas in 3 days · Plan it"), and once, after
 * one ends, that alerts are back home (marked seen at once so it never shows again).
 */
const EventBanner = () => {
  const user = useCurrentUser()
  const active = user.activeEvent ?? null
  const upcoming = user.upcomingEvent ?? null
  const events = useEventsQuery(Boolean(active))
  const patch = usePatchUserMutation()
  const homeName = useAreaName(user.state, user.location)
  const [welcome, setWelcome] = useState(() => (!active ? user.lastEvent ?? null : null))
  const marked = useRef(false)
  useEffect(() => {
    if (!welcome || marked.current) return
    marked.current = true
    patch.mutate({ event_return_seen: true })
  }, [welcome, patch])

  if (active) {
    const event = events.data?.find(e => String(e.id) === String(active.id))
    const count = event ? tallyCodes(event).length : (active.count ?? 0)
    const bigDay = event ? event.kind === 'bigday' : true
    return (
      <p className='area-banner area-banner--place event-banner' role='status' data-testid='event-banner'>
        <span><Trans i18nKey={bigDay ? 'events.banner' : 'events.bannerTrip'} values={{ name: active.name, count }} components={{ b: <strong /> }} /></span>
        <Link className='link-button link-text' to={`${eventPath(active.id)}/tally`}>{t('events.openTally')}</Link>
      </p>
    )
  }
  return (
    <>
      {welcome && (
        <p className='area-banner area-banner--quiet' role='status' data-testid='welcome-back'>
          <span>{t('places.welcomeBack', { name: homeName })}</span>
          <button type='button' className='link-button link-text' onClick={() => setWelcome(null)}>{t('common.ok')}</button>
        </p>
      )}
      {upcoming && daysUntil(upcoming.starts_on) > 0 && (
        <p className='area-banner area-banner--quiet' data-testid='upcoming-event'>
          <span><Trans i18nKey='events.upcomingBanner' count={daysUntil(upcoming.starts_on)} values={{ name: upcoming.name, count: daysUntil(upcoming.starts_on) }} components={{ b: <strong /> }} /></span>
          <Link className='link-button link-text' to={eventPath(upcoming.id)}>{t('places.planIt')}</Link>
        </p>
      )}
    </>
  )
}

export default EventBanner
