import { useState } from 'react'
import { t } from '../../i18n'
import { currentPlatform, defaultMapsApp, mapUrl, saveMapsApp, savedMapsApp, type MapArea, type MapsApp } from './offlineMaps'

const STEPS: Record<MapsApp, string[]> = {
  google: ['getReady.stepsGoogle1', 'getReady.stepsGoogle2'],
  apple: ['getReady.stepsApple1', 'getReady.stepsApple2', 'getReady.stepsApple3']
}

/**
 * The maps-app part of "Get ready for offline": a button that opens the phone's maps app on the
 * day's area (no app has a link that starts the download itself), the few taps to save it from
 * there, and a tick for "I've downloaded the map". An iPhone starts on Apple Maps with Google's
 * one tap away; Android has Google's only; a computer shows both, as the map is saved on the phone.
 */
const OfflineMapButton = ({ area, areaName, downloaded, onDownloaded }: {
  area: MapArea | null
  areaName: string
  downloaded: boolean
  onDownloaded: (done: boolean) => void
}) => {
  const [platform] = useState(currentPlatform)
  const [app, setApp] = useState<MapsApp>(() => defaultMapsApp(platform, savedMapsApp()))
  const choose = (next: MapsApp) => { setApp(next); saveMapsApp(next) }
  const other: MapsApp = app === 'apple' ? 'google' : 'apple'
  const open = (which: MapsApp, primary: boolean) => (
    <a
      className={`pill-button ${primary ? 'pill-button--primary' : ''}`}
      href={mapUrl(which, area, areaName)} target='_blank' rel='noreferrer'
      onClick={() => choose(which)} data-testid={`maps-open-${which}`}
    >
      {t(which === 'apple' ? 'getReady.openApple' : 'getReady.openGoogle')}
    </a>
  )

  return (
    <div className='get-ready__maps' data-testid='offline-maps' data-app={app}>
      <p className='notification__hint'>{t('getReady.maps', { area: areaName })}</p>
      <p className='place__actions'>
        {platform === 'desktop' ? <>{open('google', app === 'google')}{open('apple', app === 'apple')}</> : open(app, true)}
        {platform === 'ios' && (
          <button type='button' className='link-button link-text' onClick={() => choose(other)} data-testid='maps-switch'>
            {t(other === 'google' ? 'getReady.useGoogle' : 'getReady.useApple')}
          </button>
        )}
      </p>
      {platform === 'desktop' && <p className='notification__hint'>{t('getReady.mapsOnPhone')}</p>}
      <ol className='get-ready__steps notification__hint' data-testid='maps-steps'>
        {STEPS[app].map(key => <li key={key}>{t(key, { area: areaName })}</li>)}
      </ol>
      <label className='get-ready__downloaded'>
        <input type='checkbox' checked={downloaded} onChange={(e) => onDownloaded(e.target.checked)} data-testid='map-downloaded' />
        {t('getReady.mapDownloadedTick')}
      </label>
    </div>
  )
}

export default OfflineMapButton
