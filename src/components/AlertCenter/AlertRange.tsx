import { useState } from 'react'
import { toast } from 'react-toastify'
import { errorMessage } from '../../apiCalls'
import { useCurrentUser, useRegionsQuery } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { useDistanceUnit } from '../../distance'
import { countyName, countyWord, stateName } from '../../usStates'
import PlaceSearch from '../PlaceSearch/PlaceSearch'

// The server's choices (lib/range.js), in miles; outside the US they show in kilometres. -1 is the
// whole state or province.
const WHOLE_STATE = -1
const RANGES = [0, 15, 30, WHOLE_STATE] as const

/**
 * How far alerts reach past the county line (watch list, rare birds and lifers alike): a set
 * distance from a home spot, or the whole state or province. A bird one county over is one you
 * could still go for, or one coming your way; the alerts say where it is. Below it, whether
 * rare-bird alerts wait for proof. Shown whether or not push is on here, since both settings shape
 * the emails too.
 */
const AlertRange = () => {
  const user = useCurrentUser()
  const patch = usePatchUserMutation()
  const unit = useDistanceUnit()
  const regions = useRegionsQuery(user.state)
  const [choosing, setChoosing] = useState(false)
  const county = regions.data?.find(r => r.code === user.location)?.name
  const range = user.range_mi ?? 30
  const state = stateName(user.state)
  // Where the home area already is the whole province (no counties there), there's nothing wider to offer.
  const choices = RANGES.filter(mi => mi !== WHOLE_STATE || (user.location ?? '').split('-').length > 2)
  const label = (mi: number) => mi === 0 ? 'Just my county'
    : mi === WHOLE_STATE ? `All of ${state ?? 'my state'}`
    : unit === 'km' ? `${Math.round(mi * 1.609344 / 5) * 5} km` : `${mi} mi`
  const ownSpot = user.home_lat != null && user.home_lng != null

  return (
    <div className='notification-group alert-range'>
      <div className='notification'>
        <div className='notification__text'>
          <span className='notification__label' id='alert-range-label'>How far your alerts reach</span>
          <p className='notification__hint'>Watch-list, rare-bird and lifer alerts, push and email, also cover sightings this far from home, and say where they are.</p>
        </div>
      </div>
      <fieldset className='timing alert-range__choices' aria-labelledby='alert-range-label' disabled={patch.isPending}>
        {choices.map(mi => (
          <label key={mi} className={`timing__option ${range === mi ? 'is-selected' : ''}`}>
            <input type='radio' name='range_mi' value={mi} checked={range === mi} onChange={() => patch.mutate({ range_mi: mi })} />
            {label(mi)}
          </label>
        ))}
      </fieldset>
      {range > 0 && (
        <div className='alert-range__home'>
          <p className='notification__hint'>
            Measured from {ownSpot ? 'a spot you chose' : `the center of ${county ? countyName(county, user.state) : `your ${countyWord(user.state)}`}`}.{' '}
            {!choosing && <button type='button' className='link-button link-text' onClick={() => setChoosing(true)}>{ownSpot ? 'Change it' : 'Use a spot of my own'}</button>}
            {!choosing && ownSpot && <>{' · '}<button type='button' className='link-button link-text' onClick={() => patch.mutate({ home_lat: null, home_lng: null })}>Use the county center</button></>}
          </p>
          {choosing && (
            <div className='alert-range__search'>
              <PlaceSearch state={user.state} label='Home spot' placeholder='Your town, address or a hotspot' autoFocus
                onPick={(p) => { patch.mutate({ home_lat: p.lat, home_lng: p.lng }); setChoosing(false) }} />
              <button type='button' className='link-button link-text' onClick={() => setChoosing(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}
      {/* For people who'd rather not drive for an unproven report; off by default, since most would
          rather hear early and judge the evidence on the alert themselves. Push and email alike. */}
      <div className='notification notification--sub alert-range__proof'>
        <div className='notification__text'>
          <label htmlFor='rare_alerts_need_proof'>Only once there&rsquo;s proof</label>
          <p className='notification__hint'>Rare-bird alerts wait until a report has a photo, an eBird reviewer&rsquo;s OK, or a second birder. Watch-list alerts aren&rsquo;t affected.</p>
        </div>
        <div className='notification__controls'>
          <input className='switch switch--small' type='checkbox' id='rare_alerts_need_proof' name='rare_alerts_need_proof'
            checked={Boolean(user.rare_alerts_need_proof)} disabled={patch.isPending}
            onChange={(e) => patch.mutate({ rare_alerts_need_proof: e.target.checked }, {
              onSuccess: () => toast.success('Alert preferences updated!', { position: 'bottom-center' }),
              onError: (error) => toast.error(errorMessage(error), { position: 'bottom-center' })
            })} />
        </div>
      </div>
    </div>
  )
}

export default AlertRange
