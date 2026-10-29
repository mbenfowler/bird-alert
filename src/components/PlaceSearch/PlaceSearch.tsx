import { useId, useState, type FormEvent } from 'react'
import { SearchIcon, CloseIcon } from '../Icons/Icons'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePlaceSearchQuery, useRegionsQuery } from '../../hooks/queries'
import type { PlanPoint } from '../../routePlan'
import './PlaceSearch.css'
import { countyName } from '../../usStates'

export interface Suggestion { point: PlanPoint; detail: string }

interface PlaceSearchProps {
  state: string
  label: string
  placeholder: string
  onPick: (point: PlanPoint) => void
  /** Shown before anything is typed, e.g. the list's best places not yet on the route. */
  suggestions?: Suggestion[]
  suggestionsLabel?: string
  autoFocus?: boolean
}

/**
 * Find a place by name: eBird hotspots anywhere in the state as you type, and towns and addresses
 * once the search is submitted (OpenStreetMap asks that it not be searched on every keystroke).
 */
const PlaceSearch = ({ state, label, placeholder, onPick, suggestions = [], suggestionsLabel, autoFocus }: PlaceSearchProps) => {
  const id = useId()
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState('')
  const typed = useDebouncedValue(text, 250)
  const wantsAddresses = submitted !== '' && submitted === text.trim()
  const search = usePlaceSearchQuery(state, wantsAddresses ? submitted : typed, wantsAddresses)
  const regions = useRegionsQuery(state)
  const county = (code: string | null) => regions.data?.find(r => r.code === code)?.name ?? null

  const submit = (e: FormEvent) => { e.preventDefault(); setSubmitted(text.trim()) }
  const pick = (point: PlanPoint) => { onPick(point); setText(''); setSubmitted('') }
  const searching = text.trim().length >= 2
  const hotspots = searching ? search.data?.hotspots ?? [] : []
  const addresses = wantsAddresses ? search.data?.addresses ?? [] : []

  return (
    <div className='place-search'>
      <form className='place-search__form' role='search' onSubmit={submit}>
        <label className='visually-hidden' htmlFor={id}>{label}</label>
        <SearchIcon className='place-search__icon' />
        <input id={id} className='place-search__input' type='search' placeholder={placeholder} autoComplete='off' enterKeyHint='search' autoFocus={autoFocus}
          value={text} onChange={(e) => setText(e.target.value)} />
        {text && <button type='button' className='place-search__clear' aria-label='Clear search' onClick={() => { setText(''); setSubmitted('') }}><CloseIcon /></button>}
      </form>
      {!searching && suggestions.length > 0 && (
        <div className='place-search__group'>
          {suggestionsLabel && <p className='place-search__label'>{suggestionsLabel}</p>}
          <ul className='place-search__results'>
            {suggestions.map(s => (
              <li key={`${s.point.locId ?? s.point.name}`}>
                <button type='button' onClick={() => pick(s.point)}><strong>{s.point.name}</strong><span>{s.detail}</span></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {searching && (
        <div className='place-search__group' aria-live='polite'>
          {hotspots.length > 0 && (
            <>
              <p className='place-search__label'>eBird hotspots</p>
              <ul className='place-search__results'>
                {hotspots.map(h => {
                  const where = county(h.county)
                  const detail = [where && countyName(where, state), h.species !== null && `${h.species} species all time`].filter(Boolean).join(' · ')
                  return (
                    <li key={h.locId}>
                      <button type='button' onClick={() => pick({ locId: h.locId, name: h.name, lat: h.lat, lng: h.lng, note: detail || null })}>
                        <strong>{h.name}</strong>{detail && <span>{detail}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {addresses.length > 0 && (
            <>
              <p className='place-search__label'>Towns and addresses</p>
              <ul className='place-search__results'>
                {addresses.map(a => (
                  <li key={`${a.lat},${a.lng}`}>
                    <button type='button' onClick={() => pick({ locId: null, name: a.name, lat: a.lat, lng: a.lng, note: null })}><strong>{a.name}</strong></button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {search.isFetching && <p className='place-search__hint'>Searching…</p>}
          {!search.isFetching && wantsAddresses && !hotspots.length && !addresses.length && <p className='place-search__hint'>Nothing found for “{submitted}”.</p>}
          {!wantsAddresses && <p className='place-search__hint'>Press Enter to search towns and addresses too.</p>}
        </div>
      )}
    </div>
  )
}

export default PlaceSearch
