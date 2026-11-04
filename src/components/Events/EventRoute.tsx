import { Trans } from 'react-i18next'
import { t } from '../../i18n'
import { duration } from '../../duration'

/** "Driving 1 h 49 min · At stops 3 h 30 min · Total 5 h 19 min"; without drive times, just the stops. */
export const RouteTotals = ({ drive, stay }: { drive: number | null; stay: number }) => (
  <p className='event-route__totals' data-testid='route-totals'>
    {typeof drive === 'number'
      ? <Trans i18nKey='routeTimes.totals' values={{ drive: duration(drive), stay: duration(stay), total: duration(drive + stay) }} components={{ b: <strong /> }} />
      : t('routeTimes.totalsNoDrive', { stay: duration(stay) })}
  </p>
)
