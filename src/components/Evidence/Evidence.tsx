import type { Evidence as EvidenceData } from '../../types'
import './Evidence.css'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * What a rare-bird report rests on, so a chase can be judged before the drive: whether an eBird
 * reviewer has confirmed it, whether the checklist has a photo or recording, and how many birders
 * reported it. Every report shows, confirmed or not (an unreviewed one is just marked so), and a
 * report without evidence from the server shows nothing. Compact on an alert card; spelled out on
 * the sighting page, beside its link to the checklist.
 */
const Evidence = ({ evidence, compact = false }: { evidence?: EvidenceData | null; compact?: boolean }) => {
  if (!evidence) return null
  const { confirmed, media, birders } = evidence
  if (compact) {
    return (
      <p className='evidence evidence--compact'>
        <span className={confirmed ? 'evidence__confirmed' : 'evidence__unconfirmed'}>{confirmed ? '✓ Confirmed' : 'Unconfirmed'}</span>
        {media && <span className='evidence__item'><span aria-hidden='true'>📷</span><span className='visually-hidden'>Photo or audio</span></span>}
        {birders > 1 && <span className='evidence__item'>{plural(birders, 'birder')}</span>}
      </p>
    )
  }
  return (
    <ul className='evidence evidence--full' aria-label='What this report rests on'>
      <li className={confirmed ? 'evidence__confirmed' : 'evidence__unconfirmed'}>
        {confirmed ? '✓ Confirmed by an eBird reviewer' : 'Unconfirmed: not yet reviewed by eBird'}
      </li>
      {media && <li><span aria-hidden='true'>📷 </span>Photo or audio on the checklist</li>}
      {birders > 1 && <li>Reported by {plural(birders, 'birder')}</li>}
    </ul>
  )
}

export default Evidence
