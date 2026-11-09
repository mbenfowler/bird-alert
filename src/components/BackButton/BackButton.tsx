import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChevronIcon } from '../Icons/Icons'
import { canGoBack } from '../../pageMemory'
import { t } from '../../i18n'

/**
 * Back, for the pages one step in (a sighting, an alert's sightings, Where to go). The installed
 * app has no browser Back button, so this is the way out. It goes to wherever the person came from
 * when that was a page of this app, so the list they left is as they left it; a page opened
 * straight from an email, a notification or a fresh tab has nothing behind it, and goes to
 * `fallback` instead. A real link to the fallback, so a middle click or a long press still works.
 */
const BackButton = ({ fallback = '/' }: { fallback?: string }) => {
  const navigate = useNavigate()
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (!canGoBack()) return
    event.preventDefault()
    void navigate(-1)
  }
  return (
    <Link to={fallback} className='pill-button pill-button--small back-button' onClick={onClick}>
      <ChevronIcon className='pill-button__icon back-button__icon' />{t('common.back')}
    </Link>
  )
}

export default BackButton
