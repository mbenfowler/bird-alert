import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Trans } from 'react-i18next'
import AreaPicker from '../AreaPicker/AreaPicker'
import { usePatchUserMutation } from '../../hooks/mutations'
import { useAreaName, useShownArea } from '../../shownArea'
import { t } from '../../i18n'
import './AreaBanner.css'

/**
 * Which area the page shows, said plainly with a way back: an area being explored, or the saved
 * place the person is in. At home it offers "Explore another area", which changes what this visit
 * shows and nothing in Settings (Home shows that under its list's heading instead). (Events coming
 * up and just over have their own banner.)
 */
/**
 * "Explore another area" and its picker, for pages that place it themselves (Home puts it under
 * the list's heading). Only changes what this visit shows.
 */
export const ExploreAnother = ({ className = '' }: { className?: string }) => {
  const shown = useShownArea()
  const [picking, setPicking] = useState(false)
  if (!picking) return <p className={`area-banner__another-row ${className}`}><button type='button' className='link-button link-text area-banner__another' onClick={() => setPicking(true)}>{t('explore.another')}</button></p>
  return (
    <div className={`area-banner__picker ${className}`}>
      <AreaPicker current={null} onPick={(area) => { shown.explore(area); setPicking(false) }} />
      <button type='button' className='link-button link-text' onClick={() => setPicking(false)}>{t('common.cancel')}</button>
    </div>
  )
}

/** `exploreAtHome` false: the page shows ExploreAnother itself, so at home the banner leaves it out. */
const AreaBanner = ({ exploreAtHome = true }: { exploreAtHome?: boolean }) => {
  const shown = useShownArea()
  const navigate = useNavigate()
  const patch = usePatchUserMutation()
  const [picking, setPicking] = useState(false)
  const homeName = useAreaName(shown.home.state, shown.home.region)
  const shownName = useAreaName(shown.state, shown.region)

  const picker = picking && (
    <div className='area-banner__picker'>
      <AreaPicker current={null} onPick={(area) => { shown.explore(area); setPicking(false) }} />
      <button type='button' className='link-button link-text' onClick={() => setPicking(false)}>{t('common.cancel')}</button>
    </div>
  )
  const another = !picking && <button type='button' className='link-button link-text area-banner__another' onClick={() => setPicking(true)}>{t('explore.another')}</button>

  if (shown.mode === 'explore') {
    return (
      <div className='area-banner-wrap'>
        <p className='area-banner' role='status'>
          <span><Trans i18nKey='explore.exploring' values={{ name: shownName }} components={{ b: <strong /> }} /></span>
          <button type='button' className='link-button link-text' onClick={() => shown.explore(null)}>{t('explore.back', { name: homeName })}</button>
          <button type='button' className='link-button link-text' onClick={() => navigate(`/settings?addPlace=${encodeURIComponent(shown.region)}#places`)}>{t('explore.save')}</button>
          {another}
        </p>
        {picker}
      </div>
    )
  }
  if (shown.mode === 'place' && shown.place) {
    const place = shown.place
    return (
      <p className='area-banner area-banner--place' role='status'>
        <span>
          <Trans i18nKey='places.youreIn' values={{ name: place.name, area: shownName }} components={{ b: <strong /> }} />
        </span>
        <button type='button' className='link-button link-text' onClick={() => shown.showHome(true)}>{t('places.showHome')}</button>
        {place.via === 'manual' && (
          <button type='button' className='link-button link-text' disabled={patch.isPending} onClick={() => patch.mutate({ active_place_id: null })}>{t('places.backHome')}</button>
        )}
      </p>
    )
  }
  return (
    <div className='area-banner-wrap'>
      {shown.place && (
        <p className='area-banner area-banner--quiet' role='status'>
          <span><Trans i18nKey='places.showingHome' values={{ name: homeName }} components={{ b: <strong /> }} /></span>
          <button type='button' className='link-button link-text' onClick={() => shown.showHome(false)}>{t('places.backTo', { name: shown.place.name })}</button>
        </p>
      )}
      {exploreAtHome && another && <p className='area-banner__another-row'>{another}</p>}
      {exploreAtHome && picker}
    </div>
  )
}

export default AreaBanner
