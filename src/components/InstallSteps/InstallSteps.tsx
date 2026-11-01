import { AddToHomeIcon, ShareIcon } from '../Icons/Icons'
import './InstallSteps.css'
import { Trans } from 'react-i18next'

/**
 * On iPhone, Safari only lets a site send notifications once it's on the Home Screen, and a single
 * line saying so was easy to skim past: most iPhone users never got push. Three numbered steps with
 * Safari's own icons, and the surprise that trips people up: the Home Screen app signs in separately.
 */
const InstallSteps = ({ compact = false }: { compact?: boolean }) => (
  <div className={`install-steps ${compact ? 'install-steps--compact' : ''}`}>
    <p className='install-steps__lede'><Trans i18nKey='install.lede' components={{ b: <strong /> }} /></p>
    <ol className='install-steps__list'>
      <li><span className='install-steps__icon'><ShareIcon /></span><span><Trans i18nKey='install.step1' components={{ b: <strong /> }} /></span></li>
      <li><span className='install-steps__icon'><AddToHomeIcon /></span><span><Trans i18nKey='install.step2' components={{ b: <strong /> }} /></span></li>
      <li><span className='install-steps__icon install-steps__icon--app'><img src='/images/bird.png' alt='' /></span><span><Trans i18nKey='install.step3' components={{ b: <strong /> }} /></span></li>
    </ol>
  </div>
)

export default InstallSteps
