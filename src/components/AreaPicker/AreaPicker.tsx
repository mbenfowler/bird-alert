import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CloseIcon, LocateIcon, SearchIcon } from '../Icons/Icons'
import { errorMessage, getAreaAt, getAreaSearch } from '../../apiCalls'
import { useCountriesQuery, useProvincesQuery, useRegionsQuery } from '../../hooks/queries'
import { countryOf, countyName, rememberStateNames } from '../../usStates'
import type { Area } from '../../types'
import '../PlaceSearch/PlaceSearch.css'
import './AreaPicker.css'
import { t } from '../../i18n'

export interface PickedArea {
  location: string
  state: string
  /** "San Mateo County, California, United States". */
  label: string
}

// The four countries the app began with lead the browse list; the rest follow in eBird's order.
const FIRST = ['US', 'CA', 'MX', 'ZA']

/** "San Mateo County" in the US, the name alone elsewhere; then the rest of eBird's label. */
const areaLabel = (area: Area) => {
  const [, ...rest] = area.label.split(',').map(s => s.trim())
  return [countyName(area.name, area.state), ...rest].join(', ')
}

const pickedFrom = (area: Area): PickedArea => {
  const parts = area.label.split(',').map(s => s.trim())
  // "London, England, United Kingdom": the middle part names the province.
  if (parts.length >= 3) rememberStateNames([[area.state, parts[parts.length - 2]!]])
  return { location: area.location, state: area.state, label: areaLabel(area) }
}

/**
 * Where someone birds, found three ways: the phone's location, a town or county typed by name
 * (anywhere eBird covers; asked once submitted), or browsing country, province and area. The
 * location is turned into an area and forgotten; nothing about it is kept. A refused or missing
 * location falls back to the search, without fuss.
 */
const AreaPicker = ({ onPick, startBrowsing = false, current = null }: { onPick: (area: PickedArea) => void; startBrowsing?: boolean; current?: { state: string; location: string } | null }) => {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState('')
  const search = useQuery({
    queryKey: ['area-search', submitted],
    queryFn: () => getAreaSearch(submitted),
    staleTime: Infinity,
    enabled: submitted.length >= 3
  })

  // Use my location.
  const [locating, setLocating] = useState(false)
  const [near, setNear] = useState<Area | null>(null)
  const [locateNote, setLocateNote] = useState<string | null>(null)
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const locate = () => {
    setLocateNote(null)
    setNear(null)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const area = await getAreaAt(coords.latitude, coords.longitude)
          if (area) setNear(area)
          else setLocateNote(t('area.nothingNear'))
        } catch (error) {
          setLocateNote(errorMessage(error))
        } finally { setLocating(false) }
      },
      () => {
        setLocating(false)
        setLocateNote(t('area.locateFailed'))
        inputRef.current?.focus()
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 }
    )
  }

  // Browse by country.
  const [browsing, setBrowsing] = useState(startBrowsing)
  const [country, setCountry] = useState(current ? countryOf(current.state) : 'US')
  const [province, setProvince] = useState(current?.state ?? '')
  const [area, setArea] = useState(current?.location ?? '')
  const countries = useCountriesQuery(browsing)
  const provinces = useProvincesQuery(browsing ? country : '')
  const areas = useRegionsQuery(browsing ? province : '')
  const ordered = [...(countries.data ?? [])].sort((a, b) => {
    const ia = FIRST.indexOf(a.code); const ib = FIRST.indexOf(b.code)
    return (ia < 0 ? FIRST.length : ia) - (ib < 0 ? FIRST.length : ib)
  })
  useEffect(() => { if (provinces.data) rememberStateNames(provinces.data.map(p => [p.code, p.name])) }, [provinces.data])
  // A province eBird keeps no counties for is the one area: picked as soon as the province is.
  const whole = areas.data?.length === 1 && areas.data[0]!.whole ? areas.data[0]! : null
  const browsePick = (code: string) => {
    const a = areas.data?.find(r => r.code === code)
    const p = provinces.data?.find(r => r.code === province)
    const c = countries.data?.find(r => r.code === country)
    if (!a) return
    onPick({ location: a.code, state: province, label: [a.whole ? null : countyName(a.name, province), p?.name, c?.name].filter(Boolean).join(', ') })
  }

  const submit = (e: KeyboardEvent) => {
    e.preventDefault()
    setSubmitted(text.trim())
  }
  const found = search.data?.areas ?? []

  return (
    <div className='area-picker'>
      {canLocate && (
        <button type='button' className='pill-button area-picker__locate' onClick={locate} disabled={locating}>
          <LocateIcon aria-hidden='true' /> {locating ? t('area.finding') : t('route.useLocation')}
        </button>
      )}
      {near && (
        <ul className='place-search__results area-picker__results' aria-label={t('area.yours')}>
          <li><button type='button' onClick={() => onPick(pickedFrom(near))}><strong>{areaLabel(near)}</strong><span>{t('area.tapToUse', { word: near.countyWord })}</span></button></li>
        </ul>
      )}
      {locateNote && <p className='place-search__hint area-picker__note' role='status'>{locateNote}</p>}

      <div className='place-search'>
        {/* Not a <form>: the picker sits inside the sign-up and settings forms, and Enter here must search, not submit those. */}
        <div className='place-search__form' role='search'>
          <label className='visually-hidden' htmlFor={id}>{t('area.searchLabel')}</label>
          <SearchIcon className='place-search__icon' />
          <input id={id} ref={inputRef} className='place-search__input' type='search' placeholder={canLocate ? t('area.orType') : t('area.type')}
            autoComplete='off' enterKeyHint='search' value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(e) }} />
          {text && <button type='button' className='place-search__clear' aria-label={t('common.clearSearch')} onClick={() => { setText(''); setSubmitted('') }}><CloseIcon /></button>}
        </div>
        {submitted.length >= 3 && (
          <div className='place-search__group' aria-live='polite'>
            {found.length > 0 && (
              <ul className='place-search__results'>
                {found.map(a => (
                  <li key={a.location}>
                    <button type='button' onClick={() => onPick(pickedFrom(a))}><strong>{areaLabel(a)}</strong>{a.place && <span>{t('area.via', { place: a.place })}</span>}</button>
                  </li>
                ))}
              </ul>
            )}
            {search.isFetching && <p className='place-search__hint'>{t('common.searching')}</p>}
            {search.isError && <p className='place-search__hint'>{errorMessage(search.error)}</p>}
            {!search.isFetching && search.isSuccess && !found.length && <p className='place-search__hint'>{t('area.nothing', { text: submitted })}</p>}
          </div>
        )}
        {text.trim().length >= 3 && text.trim() !== submitted && <p className='place-search__hint'>{t('area.pressEnter')}</p>}
      </div>

      {!browsing && <button type='button' className='link-button link-text area-picker__browse' onClick={() => setBrowsing(true)}>{t('area.browse')}</button>}
      {browsing && (
        <div className='area-picker__browse-lists'>
          <label className='field'>
            <span className='field__label'>{t('area.country')}</span>
            <select className='select' name='country' value={country} onChange={(e) => { setCountry(e.target.value); setProvince(''); setArea('') }}>
              {!countries.data && <option value={country}>{country === 'US' ? t('area.unitedStates') : country}</option>}
              {ordered.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label className='field'>
            <span className='field__label'>{t('area.province')}</span>
            <select className='select' name='state' value={province} onChange={(e) => { setProvince(e.target.value); setArea('') }} disabled={!provinces.data?.length}>
              <option value=''>{provinces.data && !provinces.data.length ? t('area.notAvailable') : t('area.choose')}</option>
              {(provinces.data ?? []).map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </label>
          {whole ? (
            <button type='button' className='pill-button pill-button--primary' onClick={() => browsePick(whole.code)}>{t('area.useAll', { name: whole.name })}</button>
          ) : (
            <label className='field'>
              <span className='field__label'>{t('area.area')}</span>
              <select className='select' name='location' value={area} disabled={!areas.data?.length}
                onChange={(e) => { setArea(e.target.value); if (e.target.value) browsePick(e.target.value) }}>
                <option value=''>{t('area.choose')}</option>
                {(areas.data ?? []).map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
              </select>
            </label>
          )}
          {(countries.isError || provinces.isError || areas.isError) && <p className='place-search__hint' role='alert'>{t('area.listsFailed')}</p>}
        </div>
      )}
    </div>
  )
}

export default AreaPicker
