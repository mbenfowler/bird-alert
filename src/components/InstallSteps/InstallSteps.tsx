import { AddToHomeIcon, ShareIcon } from '../Icons/Icons'
import './InstallSteps.css'

/**
 * On iPhone, Safari only lets a site send notifications once it's on the Home Screen, and a single
 * line saying so was easy to skim past: most iPhone users never got push. Three numbered steps with
 * Safari's own icons, and the surprise that trips people up: the Home Screen app signs in separately.
 */
const InstallSteps = ({ compact = false }: { compact?: boolean }) => (
  <div className={`install-steps ${compact ? 'install-steps--compact' : ''}`}>
    <p className='install-steps__lede'><strong>On iPhone, alerts need Bird Alert! on your Home Screen.</strong> It takes about ten seconds:</p>
    <ol className='install-steps__list'>
      <li><span className='install-steps__icon'><ShareIcon /></span><span>Tap <strong>Share</strong> in Safari’s toolbar.</span></li>
      <li><span className='install-steps__icon'><AddToHomeIcon /></span><span>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</span></li>
      <li><span className='install-steps__icon install-steps__icon--app'><img src='/images/bird.png' alt='' /></span><span>Open <strong>Bird Alert!</strong> from your Home Screen, sign in once more, and turn on alerts.</span></li>
    </ol>
  </div>
)

export default InstallSteps
