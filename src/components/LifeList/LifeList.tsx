import { useRef, useState, type ChangeEvent } from 'react'
import { errorMessage } from '../../apiCalls'
import { useSeenBirdsQuery } from '../../hooks/queries'
import { useImportLifeListMutation, useToggleSeenMutation } from '../../hooks/mutations'
import type { LifeListImport } from '../../types'
import SplitHelp from './SplitHelp'
import './LifeList.css'

/**
 * The life list in Settings: how many birds are on it, and for experienced birders a one-time
 * start from eBird's life list export. Everyone else builds it with "Seen it" on each bird.
 */
const LEFT = '\u0000left'

const LifeList = () => {
  const seen = useSeenBirdsQuery()
  const importer = useImportLifeListMutation()
  const toggleSeen = useToggleSeenMutation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<LifeListImport | null>(null)
  const [picked, setPicked] = useState<Record<string, string>>({})
  const count = seen.data?.length ?? 0
  const imported = seen.data?.filter(b => b.source === 'import').length ?? 0

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setResult(null)
    setPicked({})
    importer.mutate(await file.text(), { onSuccess: setResult })
  }
  const pick = (row: string, speciesCode: string, comName: string) => {
    toggleSeen.mutate({ speciesCode, seen: true })
    setPicked(current => ({ ...current, [row]: comName }))
  }

  return (
    <section className='life-list'>
      <h2 className='fredericka'>Your life list</h2>
      <div className='notification life-list__card'>
        <div className='notification__text'>
          <p className='life-list__count'>{seen.isPending ? 'Loading…' : count ? `${count} ${count === 1 ? 'bird' : 'birds'}` : 'No birds yet'}</p>
          <p className='notification__hint'>
            {count
              ? `Tap “Seen it” on any bird to add it.${imported ? ` ${imported} came from eBird.` : ''} Where to go can look for lifers, and push alerts can tell you when one is reported nearby.`
              : 'Tap “Seen it” on any bird you’ve seen, or start from your eBird life list below.'}
          </p>
        </div>
      </div>
      <details className='life-list__import'>
        <summary>Start from your eBird life list</summary>
        <ol>
          <li>On eBird, open <a href='https://ebird.org/lifelist?r=world&time=life' target='_blank' rel='noreferrer'>My eBird → Life List</a> (World, Life).</li>
          <li>At the bottom of the list, choose <strong>Download (CSV)</strong>.</li>
          <li>Pick that file here. Importing again later adds new birds and never removes any.</li>
        </ol>
        <input ref={fileRef} type='file' accept='.csv,text/csv' className='visually-hidden' id='lifeListFile' onChange={(e) => { void onFile(e) }} />
        <button type='button' className='pill-button pill-button--primary' onClick={() => fileRef.current?.click()} disabled={importer.isPending}>{importer.isPending ? 'Importing…' : 'Choose the CSV file'}</button>
        {importer.isError && <p className='life-list__error' role='alert'>{errorMessage(importer.error)}</p>}
        {result && (
          <div className='life-list__result' role='status'>
            <p><strong>Added {result.added} {result.added === 1 ? 'bird' : 'birds'}</strong>{result.already ? `, ${result.already} already on your list` : ''}. Your life list has {result.total}.</p>
            {result.skipped.length > 0 && (
              <>
                <p>{result.skipped.length} {result.skipped.length === 1 ? 'row was' : 'rows were'} left out:</p>
                <ul>
                  {result.skipped.map(row => (
                    <li key={row.name}>
                      <strong>{row.name}</strong>: {row.reason}.
                      {picked[row.name]
                        ? <span className='life-list__picked'> {picked[row.name] === LEFT ? 'Left as a possible lifer for both' : `✓ ${picked[row.name]} added`}</span>
                        : row.choices && (
                          <span className='life-list__choices'>
                            {row.choices.length > 1 ? 'Which did you see? ' : ''}
                            {row.choices.map(c => (
                              <button key={c.speciesCode} type='button' className='pill-button life-list__choice' onClick={() => pick(row.name, c.speciesCode, c.comName)}>
                                {row.choices!.length > 1 ? c.comName : 'Count it anyway'}
                              </button>
                            ))}
                          </span>
                        )}
                      {!picked[row.name] && <SplitHelp row={row} onPick={(code, name) => pick(row.name, code, name)} onLeave={() => setPicked(current => ({ ...current, [row.name]: LEFT }))} />}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </details>
    </section>
  )
}

export default LifeList
