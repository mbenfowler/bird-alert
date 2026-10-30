import { useState } from 'react'
import { useCurrentUser, useRegionsQuery } from '../../hooks/queries'
import { usePatchUserMutation } from '../../hooks/mutations'
import { useDistanceUnit } from '../../distance'
import { countyName, countyWord } from '../../usStates'
import PlaceSearch from '../PlaceSearch/PlaceSearch'

// The server's choices (lib/range.js), in miles; Canadians and Mexicans see them in kilometres.
const RANGES = [0, 15, 30] as const

/**
 * How far rare-bird and lifer alerts reach past the county line, and the spot it's measured from.
 * A bird one county over is one you could still go for, or one coming your way; the alerts say
 * how far it is. Watch-list alerts stay in the county.
 */
const AlertRange = () => {
  const user = useCurrentUser()
  const patch = usePatchUserMutation()
  const unit = useDistanceUnit()
  const regions = useRegionsQuery(user.state)
  const [choosing, setChoosing] = useState(false)
  const county = regions.data?.find(r => r.code === user.location)?.name
  const range = user.range_mi ?? 30
  const label = (mi: number) => (mi === 0 ? 'Just my county' : unit === 'km' ? `${Math.round(mi * 1.609344 / 5) * 5} km` : `${mi} mi`)
  const ownSpot = user.home_lat != null && user.home_lng != null

  return (
    <div className='notification-group alert-range'>
      <div className='notification'>
        <div className='notification__text'>
          <span className='notification__label' id='alert-range-label'>How far rare birds and lifers reach</span>
          <p className='notification__hint'>Rare-bird and lifer alerts, push and email, also cover sightings this far from home, past the county line, and say how far away they are. Watch-list alerts stay in your county.</p>
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
    </div>
  )
}

export default AlertRange
