import { useState } from 'react'
import { errorMessage, getSplitEvidence } from '../../apiCalls'
import { useRegionsQuery } from '../../hooks/queries'
import type { LifeListImport, SplitEvidence } from '../../types'
import { countyName } from '../../usStates'

type Row = LifeListImport['skipped'][number]

const monthDay = (md: string) => new Date(`2000-${md}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/**
 * "Not sure?" for a one-or-the-other row: what birders identified around that place and date,
 * and a suggestion. The person still makes the call; a wrong guess would hide a real lifer.
 */
const SplitHelp = ({ row, onPick, onLeave }: { row: Row; onPick: (speciesCode: string, comName: string) => void; onLeave: () => void }) => {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const [error, setError] = useState('')
  const [evidence, setEvidence] = useState<SplitEvidence | null>(null)
  // A county answer is named from the state's county list ("US-CO-013" is Boulder).
  const regions = useRegionsQuery(evidence?.areaKind === 'county' ? evidence.area.split('-')[1] : '')
  if (!row.choices || row.choices.length < 2 || !row.where) return null

  const ask = async () => {
    setState('busy')
    try { setEvidence(await getSplitEvidence({ choices: row.choices!, ...row.where! })); setState('idle') } catch (e) { setError(errorMessage(e)); setState('error') }
  }
  if (!evidence) {
    return (
      <span className='split-help'>
        <button type='button' className='life-list__link' onClick={() => { void ask() }} disabled={state === 'busy'}>{state === 'busy' ? 'Checking local reports…' : 'Not sure? Check local reports'}</button>
        {state === 'error' && <span className='life-list__error'> {error}</span>}
      </span>
    )
  }
  const areaState = evidence.area.split('-')[1] ?? ''
  const area = evidence.areaKind === 'county' ? countyName(regions.data?.find(r => r.code === evidence.area)?.name ?? evidence.area, areaState) : evidence.area.replace(/^(US|CA)-/, '')
  const when = `${monthDay(evidence.from)} to ${monthDay(evidence.to)}`
  const counts = evidence.ranked.map(c => `${c.comName} on ${c.days}`).join(', ')
  const top = evidence.ranked[0]
  return (
    <div className='split-help__answer' role='status'>
      {evidence.strength === 'clear' && top && (
        <p><strong>Probably {top.comName}.</strong> Of {evidence.sampled} days sampled in {area}, {when}, the last two years: {counts}.</p>
      )}
      {evidence.strength === 'mixed' && <p><strong>Could be either.</strong> Both are identified in {area}, {when}: {counts}, of {evidence.sampled} days.</p>}
      {evidence.strength === 'thin' && <p><strong>Too few identified reports to say.</strong> In {area}, {when}, birders mostly report it as one-or-the-other too.</p>}
      <span className='life-list__choices'>
        {evidence.strength === 'clear' && top && <button type='button' className='pill-button pill-button--primary life-list__choice' onClick={() => onPick(top.speciesCode, top.comName)}>Mark {top.comName}</button>}
        <button type='button' className='pill-button life-list__choice' onClick={onLeave}>Leave both as lifers</button>
      </span>
    </div>
  )
}

export default SplitHelp
