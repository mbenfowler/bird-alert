import './Loading.css'
import { t } from '../../i18n'

interface LoadingStateProps {
  label?: string
  /** 'block' centres in a tall area; 'inline' sits beside content. */
  variant?: 'block' | 'inline'
}

/** A ring and a label, centred in the space the content will take. */
export const LoadingState = ({ label = t('loading.default'), variant = 'block' }: LoadingStateProps) => (
  <div className={`loading loading--${variant}`} role='status' aria-live='polite'>
    <span className='loading__ring' aria-hidden='true'></span>
    <span className={variant === 'inline' ? 'visually-hidden' : 'loading__label'}>{label}</span>
  </div>
)

/**
 * Placeholder shaped like a bird card, shimmering until the real one arrives: the photo in the
 * photo's box, three lines of name, and the seen, star and sound buttons in their corners, so
 * nothing moves when the birds land.
 */
export const SkeletonCard = () => (
  <div className='card skeleton' aria-hidden='true'>
    <div className='skeleton__img'></div>
    <div className='skeleton__lines'>
      <div className='skeleton__line skeleton__line--title'></div>
      <div className='skeleton__line skeleton__line--sub'></div>
      <div className='skeleton__line skeleton__line--note'></div>
    </div>
    <span className='skeleton__dot skeleton__dot--seen'></span>
    <span className='skeleton__dot skeleton__dot--star'></span>
    <span className='skeleton__dot skeleton__dot--sound'></span>
  </div>
)

export const SkeletonList = ({ count = 3, label = t('loading.birds') }: { count?: number; label?: string }) => (
  <div className='skeleton-list' role='status' aria-live='polite' aria-busy='true'>
    <span className='visually-hidden'>{label}</span>
    {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} />)}
  </div>
)
