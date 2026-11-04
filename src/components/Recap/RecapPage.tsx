import { Link, useParams } from 'react-router'
import { useLoginHere } from '../../returnTo'
import { LoadingState } from '../Loading/Loading'
import { LoadProblem } from '../Offline/Offline'
import { useSessionQuery, useSharedRecapQuery } from '../../hooks/queries'
import { t } from '../../i18n'
import Recap from './Recap'
import '../Shared/Shared.css'

/**
 * A recap's share link (/recap/:code), for anyone, signed in or not: the public view, with no
 * names and no personal spots. A quiet invitation to Bird Alert for anyone not signed in.
 */
const RecapPage = () => {
  const { code = '' } = useParams()
  const loginHere = useLoginHere()
  const recap = useSharedRecapQuery(code)
  const signedIn = Boolean(useSessionQuery().data)
  if (recap.isPending) return <LoadingState />
  if (!recap.data) return <section className='recap-page'><LoadProblem error={recap.error} missing={t('recap.missing')} /></section>
  return (
    <article className='recap-page'>
      {!signedIn && (
        <aside className='shared__pitch'>
          <p>{t('recap.pitch')}</p>
          <Link className='pill-button pill-button--primary' to={loginHere}>{t('events.viewPromptButton')}</Link>
        </aside>
      )}
      <Recap recap={recap.data} />
    </article>
  )
}

export default RecapPage
