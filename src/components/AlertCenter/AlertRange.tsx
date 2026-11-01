import { useState } from 'react'
import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser, useRegionsQuery } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { useDistanceUnit } from '../../distance'
import { countyName, countyWord } from '../../usStates'
import PlaceSearch from '../PlaceSearch/PlaceSearch'
import { t } from '../../i18n'

// The server's choices (lib/range.js), in miles; Canadians and Mexicans see them in kilometres.
const RANGES = [0, 15, 30] as const

/**
 * How far rare-bird and lifer alerts reach past the county line, and the spot it's measured from.
 * A bird one county over is one you could still go for, or one coming your way; the alerts say
 * how far it is. Watch-list alerts stay in the county. Below it, whether rare-bird alerts wait for
 * proof. Shown whether or not push is on here, since both settings shape the emails too.
 */
const AlertRange = () => {
  const user = useCurrentUser()
  const patch = usePatchUserMutation()
  const unit = useDistanceUnit()
  const regions = useRegionsQuery(user.state)
  const [choosing, setChoosing] = useState(false)
  const county = regions.data?.find(r => r.code === user.location)?.name
  const range = user.range_mi ?? 30
  const label = (mi: number) => (mi === 0 ? t('range.justCounty') : unit === 'km' ? t('range.km', { n: Math.round(mi * 1.609344 / 5) * 5 }) : t('range.mi', { n: mi }))
  const ownSpot = user.home_lat != null && user.home_lng != null

  return (
    <div className='notification-group alert-range'>
      <div className='notification'>
        <div className='notification__text'>
          <span className='notification__label' id='alert-range-label'>{t('range.title')}</span>
          <p className='notification__hint'>{t('range.hint')}</p>
        </div>
      </div>
      <fieldset className='timing alert-range__choices' aria-labelledby='alert-range-label' disabled={patch.isPending}>
        {RANGES.map(mi => (
          <label key={mi} className={`timing__option ${range === mi ? 'is-selected' : ''}`}>
            <input type='radio' name='range_mi' value={mi} checked={range === mi} onChange={() => patch.mutate({ range_mi: mi })} />
            {label(mi)}
          </label>
        ))}
      </fieldset>
      {range > 0 && (
        <div className='alert-range__home'>
          <p className='notification__hint'>
            {ownSpot ? t('range.fromSpot') : t('range.fromCenter', { place: county ? countyName(county, user.state) : t('range.yourCounty', { word: countyWord(user.state) }) })}{' '}
            {!choosing && <button type='button' className='link-button link-text' onClick={() => setChoosing(true)}>{ownSpot ? t('range.change') : t('range.ownSpot')}</button>}
            {!choosing && ownSpot && <>{' · '}<button type='button' className='link-button link-text' onClick={() => patch.mutate({ home_lat: null, home_lng: null })}>{t('range.useCenter')}</button></>}
          </p>
          {choosing && (
            <div className='alert-range__search'>
              <PlaceSearch state={user.state} label={t('range.homeSpot')} placeholder={t('range.homePlaceholder')} autoFocus
                onPick={(p) => { patch.mutate({ home_lat: p.lat, home_lng: p.lng }); setChoosing(false) }} />
              <button type='button' className='link-button link-text' onClick={() => setChoosing(false)}>{t('common.cancel')}</button>
            </div>
          )}
        </div>
      )}
      {/* For people who'd rather not drive for an unproven report; off by default, since most would
          rather hear early and judge the evidence on the alert themselves. Push and email alike. */}
      <div className='notification notification--sub alert-range__proof'>
        <div className='notification__text'>
          <label htmlFor='rare_alerts_need_proof'>{t('range.proof')}</label>
          <p className='notification__hint'>{t('range.proofHint')}</p>
        </div>
        <div className='notification__controls'>
          <input className='switch switch--small' type='checkbox' id='rare_alerts_need_proof' name='rare_alerts_need_proof'
            checked={Boolean(user.rare_alerts_need_proof)} disabled={patch.isPending}
            onChange={(e) => patch.mutate({ rare_alerts_need_proof: e.target.checked }, {
              onSuccess: () => toast.success(t('alertCenter.updated'), { position: 'bottom-center' }),
              onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
            })} />
        </div>
      </div>
    </div>
  )
}

export default AlertRange
