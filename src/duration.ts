import { t } from './i18n'

/** "42 min", "3 h", "3 h 10 min". */
export const duration = (minutes: number) => {
  const m = Math.round(minutes)
  if (m < 60) return t('eventRoute.min', { m })
  return m % 60 ? t('eventRoute.hMin', { h: Math.floor(m / 60), m: m % 60 }) : t('eventRoute.h', { h: m / 60 })
}
