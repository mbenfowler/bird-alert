import { useId, useMemo, useState } from 'react'
import { SearchIcon, CloseIcon } from '../Icons/Icons'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { SEARCH_MIN_LENGTH, useBirdSearchQuery, useSpeciesListQuery } from '../../hooks/queries'
import '../PlaceSearch/PlaceSearch.css'

const MAX_RESULTS = 8

/**
 * Pick one of the county's birds by name, as you type: the app's bird search, narrowed to the
 * county's species list so every choice can have somewhere to rank. Styled like the place search.
 */
const BirdPicker = ({ region, regionName, onPick }: { region: string; regionName: string; onPick: (code: string) => void }) => {
  const id = useId()
  const [text, setText] = useState('')
  const term = useDebouncedValue(text.trim(), 250)
  const search = useBirdSearchQuery(term)
  const speciesList = useSpeciesListQuery(region)
  const here = useMemo(() => new Set(speciesList.data ?? []), [speciesList.data])
  const searching = text.trim().length >= SEARCH_MIN_LENGTH
  const results = useMemo(() => (search.data ?? []).filter(bird => here.has(bird.speciesCode)).slice(0, MAX_RESULTS), [search.data, here])
  const pick = (code: string) => { onPick(code); setText('') }

  return (
    <div className='place-search best__bird-picker'>
      <form className='place-search__form' role='search' onSubmit={(e) => { e.preventDefault(); if (results[0]) pick(results[0].speciesCode) }}>
        <label className='visually-hidden' htmlFor={id}>Filter by a bird</label>
        <SearchIcon className='place-search__icon' />
        <input id={id} className='place-search__input' type='search' placeholder='Filter by a bird, e.g. Painted Bunting' autoComplete='off' enterKeyHint='search'
          value={text} onChange={(e) => setText(e.target.value)} />
        {text && <button type='button' className='place-search__clear' aria-label='Clear search' onClick={() => setText('')}><CloseIcon /></button>}
      </form>
      {searching && search.data && (
        <div className='place-search__group' aria-live='polite'>
          {results.length
            ? (
              <ul className='place-search__results'>
                {results.map(bird => (
                  <li key={bird.speciesCode}>
                    <button type='button' onClick={() => pick(bird.speciesCode)}><strong>{bird.comName}</strong><span>{bird.sciName}</span></button>
                  </li>
                ))}
              </ul>
            )
            : <p className='place-search__label'>No birds on {regionName}’s list match “{text.trim()}”.</p>}
        </div>
      )}
    </div>
  )
}

export default BirdPicker
