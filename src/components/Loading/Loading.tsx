import './Loading.css'

interface LoadingStateProps {
  label?: string
  /** 'block' centres in a tall area; 'inline' sits beside content. */
  variant?: 'block' | 'inline'
}

/** A ring and a label, centred in the space the content will take. */
export const LoadingState = ({ label = 'Loading…', variant = 'block' }: LoadingStateProps) => (
  <div className={`loading loading--${variant}`} role='status' aria-live='polite'>
    <span className='loading__ring' aria-hidden='true'></span>
    <span className={variant === 'inline' ? 'visually-hidden' : 'loading__label'}>{label}</span>
  </div>
)

/** Placeholder shaped like a bird card, shimmering until the real one arrives. */
export const SkeletonCard = () => (
  <div className='card skeleton' aria-hidden='true'>
    <div className='skeleton__img'></div>
    <div className='skeleton__lines'>
      <div className='skeleton__line skeleton__line--title'></div>
      <div className='skeleton__line skeleton__line--sub'></div>
    </div>
  </div>
)

export const SkeletonList = ({ count = 3, label = 'Loading birds…' }: { count?: number; label?: string }) => (
  <div className='skeleton-list' role='status' aria-live='polite' aria-label={label}>
    {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} />)}
  </div>
)
