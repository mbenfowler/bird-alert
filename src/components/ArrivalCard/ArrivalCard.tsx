import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { useSavedCodes } from '../../hooks/queries'
import { useToggleSavedMutation } from '../../hooks/mutations'
import type { Arrival, Bird } from '../../types'
import './ArrivalCard.css'

const monthDay = (day: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day ?? '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null
}

/**
 * A species due back about now. Same shell as a sighting card, with the watch toggle the home
 * cards use, since "tell me when it lands" is the obvious next step.
 */
const ArrivalCard = ({ arrival }: { arrival: Arrival }) => {
  const savedCodes = useSavedCodes()
  const toggleSaved = useToggleSavedMutation()
  const isWatched = savedCodes.has(arrival.speciesCode)
  const bird: Bird = { speciesCode: arrival.speciesCode, comName: arrival.comName, sciName: arrival.sciName, birdImg: arrival.birdImg, wikiURL: arrival.wikiURL }

  const watch = () => {
    const save = !isWatched
    toggleSaved.mutate({ bird, save }, {
      onSuccess: () => toast.success(save ? 'Bird saved to watch list!' : 'Bird removed from watch list!', { position: 'bottom-center' }),
      onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
    })
  }

  const img = arrival.birdImg && arrival.birdImg !== 'undefined' ? arrival.birdImg : '/images/noBirdImg.png'
  const first = monthDay(arrival.firstLastYear)
  const body = (
    <>
      <img className='arrival-card__photo' src={img} alt={`a ${arrival.comName}`} loading='lazy' width='96' height='72' />
      <div className='arrival-card__text'>
        <h3>{arrival.comName}</h3>
        <p>Reported {arrival.daysLastYear} of {arrival.windowDays} days this time last year</p>
        {first && <p className='arrival-card__first'>Back from {first} last year</p>}
      </div>
    </>
  )

  return (
    <article className='card alert-card arrival-card'>
      {arrival.wikiURL
        ? <a className='card-link' href={arrival.wikiURL} target='_blank' rel='noreferrer'>{body}<span className='visually-hidden'>, read about this bird on Wikipedia (opens in a new tab)</span></a>
        : <div className='card-link'>{body}</div>}
      <input type='checkbox' checked={isWatched} disabled={toggleSaved.isPending} id={`arriving-${arrival.speciesCode}`} aria-label={`Watch ${arrival.comName}`} onChange={watch} />
    </article>
  )
}

export default ArrivalCard
