import { Component, type ErrorInfo, type ReactNode } from 'react'
import './RouteError.css'
import { t } from '../../i18n'

interface Props { children: ReactNode; resetKey: string }
interface State { error: Error | null }

/**
 * Keeps the header on screen when a page throws (most often a route chunk that could not be
 * loaded), and offers a reload. Clears itself when the route changes.
 */
class RouteError extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page failed to render:', error, info.componentStack)
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className='route-error' role='alert'>
        <h2 className='fredericka'>{t('routeError.title')}</h2>
        <p>{t('routeError.why')}</p>
        <button type='button' className='pill-button pill-button--primary' onClick={() => window.location.reload()}>{t('routeError.reload')}</button>
      </section>
    )
  }
}

export default RouteError
