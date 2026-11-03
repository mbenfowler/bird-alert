import { t } from '../../i18n'

/** "just now", "12 minutes ago", "2 hours ago", "yesterday", "4 days ago": when the group's route was last edited. */
export const editedAgo = (iso: string, now = Date.now()) => {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const minutes = Math.max(0, Math.round((now - then) / 60000))
  if (minutes < 1) return t('landing.justNow')
  if (minutes < 60) return t('eventRoute.minutesAgo', { count: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('still.hoursAgo', { count: hours })
  const days = Math.round(hours / 24)
  return days === 1 ? t('landing.yesterday') : t('landing.daysAgo', { count: days })
}
