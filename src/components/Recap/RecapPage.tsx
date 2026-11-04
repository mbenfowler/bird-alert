import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useLoginHere } from '../../returnTo'
import { LoadingState } from '../Loading/Loading'
import { LoadProblem } from '../Offline/Offline'
import { useSessionQuery, useSharedRecapQuery } from '../../hooks/queries'
import { t } from '../../i18n'
import Recap from './Recap'
import { normalizeRecap } from './recapData'
import type { Recap as RecapData } from '../../types'
import '../Shared/Shared.css'

/**
 * A recap's share link (/recap/:code), for anyone, signed in or not: the public view, with no
 * names and no personal spots. A quiet invitation to Bird Alert for anyone not signed in.
 */
// /recap/demo on a preview or local build shows the sample day, so the design can be checked before
// any event has ended. Production never loads it.
const demoAllowed = () => typeof window !== 'undefined' && window.location.hostname !== 'bird-alert.vercel.app'

const RecapDemo = () => {
  const [recap, setRecap] = useState<RecapData | null>(null)
  useEffect(() => {
    import('./recapFixture').then(({ membersRecap }) => setRecap(normalizeRecap(membersRecap())))
  }, [])
  if (!recap) return <LoadingState />
  return <article className='recap-page'><Recap recap={recap} /></article>
}

const RecapPage = () => {
  const { code = '' } = useParams()
  if (code === 'demo' && demoAllowed()) return <RecapDemo />
  return <SharedRecap code={code} />
}

const SharedRecap = ({ code }: { code: string }) => {
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
