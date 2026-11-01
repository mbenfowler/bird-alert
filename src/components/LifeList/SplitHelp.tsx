import { useState } from 'react'
import { errorMessage, getSplitEvidence } from '../../apiCalls'
import { useRegionsQuery } from '../../hooks/queries'
import type { LifeListImport, SplitEvidence } from '../../types'
import { countyName, stateName, stateOfCode } from '../../usStates'
import { monthDay, t } from '../../i18n'
import { Trans } from 'react-i18next'

type Row = LifeListImport['skipped'][number]

const shortDay = (md: string) => monthDay(`2000-${md}`)

/**
 * "Not sure?" for a one-or-the-other row: what birders identified around that place and date,
 * and a suggestion. The person still makes the call; a wrong guess would hide a real lifer.
 */
const SplitHelp = ({ row, onPick, onLeave }: { row: Row; onPick: (speciesCode: string, comName: string) => void; onLeave: () => void }) => {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const [error, setError] = useState('')
  const [evidence, setEvidence] = useState<SplitEvidence | null>(null)
  // A county answer is named from the state's county list ("US-CO-013" is Boulder).
  const regions = useRegionsQuery(evidence?.areaKind === 'county' ? stateOfCode(evidence.area) : '')
  if (!row.choices || row.choices.length < 2 || !row.where) return null

  const ask = async () => {
    setState('busy')
    try { setEvidence(await getSplitEvidence({ choices: row.choices!, ...row.where! })); setState('idle') } catch (e) { setError(errorMessage(e)); setState('error') }
  }
  if (!evidence) {
    return (
      <span className='split-help'>
        <button type='button' className='life-list__link' onClick={() => { void ask() }} disabled={state === 'busy'}>{state === 'busy' ? t('split.checking') : t('split.check')}</button>
        {state === 'error' && <span className='life-list__error'> {error}</span>}
      </span>
    )
  }
  const areaState = stateOfCode(evidence.area)
  const area = evidence.areaKind === 'county' ? countyName(regions.data?.find(r => r.code === evidence.area)?.name ?? evidence.area, areaState) : stateName(areaState) ?? evidence.area.replace(/^(US|CA|MX|ZA)-/, '')
  const when = t('split.when', { from: shortDay(evidence.from), to: shortDay(evidence.to) })
  const counts = evidence.ranked.map(c => t('split.countOn', { name: c.comName, days: c.days })).join(t('split.listSep'))
  const top = evidence.ranked[0]
  return (
    <div className='split-help__answer' role='status'>
      {evidence.strength === 'clear' && top && (
        <p><Trans i18nKey='split.clear' values={{ name: top.comName, sampled: evidence.sampled, area, when, counts }} components={{ b: <strong /> }} /></p>
      )}
      {evidence.strength === 'mixed' && <p><Trans i18nKey='split.mixed' values={{ sampled: evidence.sampled, area, when, counts }} components={{ b: <strong /> }} /></p>}
      {evidence.strength === 'thin' && <p><Trans i18nKey='split.thin' values={{ area, when }} components={{ b: <strong /> }} /></p>}
      <span className='life-list__choices'>
        {evidence.strength === 'clear' && top && <button type='button' className='pill-button pill-button--primary life-list__choice' onClick={() => onPick(top.speciesCode, top.comName)}>{t('split.mark', { name: top.comName })}</button>}
        <button type='button' className='pill-button life-list__choice' onClick={onLeave}>{t('split.leave')}</button>
      </span>
    </div>
  )
}

export default SplitHelp
