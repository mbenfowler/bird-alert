import type { ChangeEvent } from 'react'
import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { popStar } from '../Pop/pop'
import { offerPush } from '../../pushAsk'
import { useSavedCodes } from '../../hooks/queries'
import { useToggleSavedMutation } from '../../hooks/mutations'
import type { Arrival, Bird } from '../../types'
import './ArrivalCard.css'
import { monthDay, t } from '../../i18n'

const firstDay = (day: string | null) => (/^\d{4}-\d{2}-\d{2}/.test(day ?? '') ? monthDay(day!) : null)

/**
 * A species due back about now. Same shell as a sighting card, with the watch toggle the home
 * cards use, since "tell me when it lands" is the obvious next step.
 */
const ArrivalCard = ({ arrival }: { arrival: Arrival }) => {
  const savedCodes = useSavedCodes()
  const toggleSaved = useToggleSavedMutation()
  const isWatched = savedCodes.has(arrival.speciesCode)
  const bird: Bird = { speciesCode: arrival.speciesCode, comName: arrival.comName, sciName: arrival.sciName, birdImg: arrival.birdImg, wikiURL: arrival.wikiURL }

  const watch = (event: ChangeEvent<HTMLInputElement>) => {
    const save = !isWatched
    popStar(event.currentTarget, save)
    toggleSaved.mutate({ bird, save }, {
      // Saving may be the moment to offer alerts on this device; the ask replaces the toast when it shows.
      onSuccess: () => { void (save ? offerPush(bird.comName) : Promise.resolve(false)).then((asked) => { if (!asked) toast.success(save ? t('watch.saved') : t('watch.removed'), { position: 'bottom-center' }) }) },
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }

  const img = arrival.birdImg && arrival.birdImg !== 'undefined' ? arrival.birdImg : '/images/noBirdImg.png'
  const first = firstDay(arrival.firstLastYear)
  const body = (
    <>
      <img className='arrival-card__photo' src={img} alt={t('card.photoAlt', { name: arrival.comName })} loading='lazy' width='96' height='72' />
      <div className='arrival-card__text'>
        <h3>{arrival.comName}</h3>
        <p>{t('arrival.reported', { reported: arrival.daysLastYear, count: arrival.windowDays })}</p>
        {first && <p className='arrival-card__first'>{t('arrival.backFrom', { day: first })}</p>}
      </div>
    </>
  )

  return (
    <article className='card alert-card arrival-card'>
      {arrival.wikiURL
        ? <a className='card-link' href={arrival.wikiURL} target='_blank' rel='noreferrer'>{body}<span className='visually-hidden'>{t('card.wikiHidden')}</span></a>
        : <div className='card-link'>{body}</div>}
      <input type='checkbox' checked={isWatched} disabled={toggleSaved.isPending} id={`arriving-${arrival.speciesCode}`} aria-label={t('arrival.watch', { name: arrival.comName })} onChange={watch} />
    </article>
  )
}

export default ArrivalCard
