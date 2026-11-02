import { useNavigate, useSearchParams } from 'react-router'
import { t } from '../../i18n'
import EventPlan from './EventPlan'
import { eventPath } from './events'
import '../AlertCenter/Places.css'
import './Events.css'

/** A new event (/events/new, or /events/new?place=7 from a place's "Plan an event here"): solo until you invite anyone. */
const EventNew = () => {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  return (
    <section className='event-page'>
      <h1 className='fredericka event-page__title'>{t('events.newTitle')}</h1>
      <p className='notification__hint'>{t('events.newHint')}</p>
      <EventPlan placeId={params.get('place')} onDone={(saved) => navigate(eventPath(saved.id), { replace: true })} onCancel={() => navigate('/events')} />
    </section>
  )
}

export default EventNew
