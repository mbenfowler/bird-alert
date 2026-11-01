import type { Evidence as EvidenceData } from '../../types'
import './Evidence.css'
import { t } from '../../i18n'

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
        <span className={confirmed ? 'evidence__confirmed' : 'evidence__unconfirmed'}>{confirmed ? t('evidence.confirmedShort') : t('evidence.unconfirmedShort')}</span>
        {media && <span className='evidence__item'><span aria-hidden='true'>📷</span><span className='visually-hidden'>{t('evidence.mediaShort')}</span></span>}
        {birders > 1 && <span className='evidence__item'>{t('evidence.birders', { count: birders })}</span>}
      </p>
    )
  }
  return (
    <ul className='evidence evidence--full' aria-label={t('evidence.label')}>
      <li className={confirmed ? 'evidence__confirmed' : 'evidence__unconfirmed'}>
        {confirmed ? t('evidence.confirmed') : t('evidence.unconfirmed')}
      </li>
      {media && <li><span aria-hidden='true'>📷 </span>{t('evidence.media')}</li>}
      {birders > 1 && <li>{t('evidence.reportedBy', { count: birders })}</li>}
    </ul>
  )
}

export default Evidence
