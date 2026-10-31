import { useId, useMemo, useState } from 'react'
import { SearchIcon, CloseIcon } from '../Icons/Icons'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { SEARCH_MIN_LENGTH, useBirdSearchQuery, useRegionBirds, useSpeciesListQuery } from '../../hooks/queries'
import type { Bird } from '../../types'
import '../PlaceSearch/PlaceSearch.css'

const MAX_RESULTS = 8

/** The county's birds whose name holds the text, those starting with it first. */
const matching = (birds: Bird[], text: string) => {
  const q = text.toLowerCase()
  const starts = (b: Bird) => b.comName.toLowerCase().startsWith(q) || b.comName.toLowerCase().includes(` ${q}`)
  return birds
    .filter(b => b.comName.toLowerCase().includes(q) || b.sciName?.toLowerCase().includes(q))
    .sort((a, b) => Number(starts(b)) - Number(starts(a)) || a.comName.localeCompare(b.comName))
}

/**
 * Pick one of the county's birds by name, as you type. The county's whole list, names and all, is
 * fetched once when the picker appears and searched right here, so results keep up with every
 * keystroke. Until it has arrived the app's bird search stands in, narrowed to the county's list,
 * and only an answer for the text as it stands is shown: an earlier, slower answer never flashes up
 * under newer text. Styled like the place search.
 */
const BirdPicker = ({ region, regionName, onPick }: { region: string; regionName: string; onPick: (code: string) => void }) => {
  const id = useId()
  const [text, setText] = useState('')
  const typed = text.trim()
  const local = useRegionBirds(region)
  const term = useDebouncedValue(typed, 250)
  const search = useBirdSearchQuery(local.ready ? '' : term)
  const speciesList = useSpeciesListQuery(region)
  const here = useMemo(() => new Set(speciesList.data ?? []), [speciesList.data])
  const searching = typed.length >= SEARCH_MIN_LENGTH
  // The server's answer counts only if it is for exactly what's in the box now.
  const current = !local.ready && search.data && !search.isPlaceholderData && term === typed
  const results = useMemo(() => local.ready
    ? matching(local.birds, typed).slice(0, MAX_RESULTS)
    : current ? (search.data ?? []).filter(bird => here.has(bird.speciesCode)).slice(0, MAX_RESULTS) : [],
  [local.ready, local.birds, typed, current, search.data, here])
  const answered = local.ready || current
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
      {searching && answered && (
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
            : <p className='place-search__label'>No birds on {regionName}’s list match “{typed}”.</p>}
        </div>
      )}
    </div>
  )
}

export default BirdPicker
