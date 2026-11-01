import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../apiCalls'
import { useSeenBirdsQuery } from '../../hooks/queries'
import { useImportLifeListMutation, useToggleSeenMutation } from '../../hooks/mutations'
import type { LifeListImport } from '../../types'
import SplitHelp from './SplitHelp'
import './LifeList.css'
import { t } from '../../i18n'
import { Trans } from 'react-i18next'

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
      <h2 className='fredericka'>{t('lifePage.title')}</h2>
      <div className='notification life-list__card'>
        <div className='notification__text'>
          <p className='life-list__count'>{seen.isPending ? t('loading.default') : count ? t('lifeList.count', { count }) : t('lifeList.none')}</p>
          <p className='notification__hint'>
            {count
              ? (imported ? t('lifeList.hintImported', { count: imported }) : t('lifeList.hint'))
              : t('lifeList.hintEmpty')}
          </p>
        </div>
        {count > 0 && <Link className='pill-button life-list__view' to='/life-list'>{t('lifeList.view')}</Link>}
      </div>
      <details className='life-list__import'>
        <summary>{t('lifeList.importTitle')}</summary>
        <ol>
          <li><Trans i18nKey='lifeList.step1' components={{ link: <a href='https://ebird.org/lifelist?r=world&time=life' target='_blank' rel='noreferrer' /> }} /></li>
          <li><Trans i18nKey='lifeList.step2' components={{ b: <strong /> }} /></li>
          <li>{t('lifeList.step3')}</li>
        </ol>
        <input ref={fileRef} type='file' accept='.csv,text/csv' className='visually-hidden' id='lifeListFile' onChange={(e) => { void onFile(e) }} />
        <button type='button' className='pill-button pill-button--primary' onClick={() => fileRef.current?.click()} disabled={importer.isPending}>{importer.isPending ? t('lifeList.importing') : t('lifeList.choose')}</button>
        {importer.isError && <p className='life-list__error' role='alert'>{errorMessage(importer.error)}</p>}
        {result && (
          <div className='life-list__result' role='status'>
            <p><Trans i18nKey={result.already ? 'lifeList.addedAlready' : 'lifeList.added'} count={result.added} values={{ count: result.added, already: result.already, total: result.total }} components={{ b: <strong /> }} /></p>
            {result.skipped.length > 0 && (
              <>
                <p>{t('lifeList.skipped', { count: result.skipped.length })}</p>
                <ul>
                  {result.skipped.map(row => (
                    <li key={row.name}>
                      <strong>{row.name}</strong>: {row.reason}.
                      {picked[row.name]
                        ? <span className='life-list__picked'> {picked[row.name] === LEFT ? t('lifeList.leftBoth') : t('lifeList.pickedAdded', { name: picked[row.name] })}</span>
                        : row.choices && (
                          <span className='life-list__choices'>
                            {row.choices.length > 1 ? t('lifeList.which') : ''}
                            {row.choices.map(c => (
                              <button key={c.speciesCode} type='button' className='pill-button life-list__choice' onClick={() => pick(row.name, c.speciesCode, c.comName)}>
                                {row.choices!.length > 1 ? c.comName : t('lifeList.countAnyway')}
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
