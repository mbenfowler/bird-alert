import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { errorMessage, postSavedBird } from '../../apiCalls'
import { queryKeys, useArrivalsQuery, useBirdsQuery, useCurrentUser, useNotableThisWeekQuery, useObservationsQuery, useRegionsQuery } from '../../hooks/queries'
import { useImportLifeListMutation, usePatchUserMutation } from '../../hooks/mutations'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useQueryClient } from '@tanstack/react-query'
import { countyLabel, countyWord, stateName, subnational1 } from '../../usStates'
import StateOptions from '../StateOptions/StateOptions'
import type { UserPatch } from '../../types'
import { isIOS, isStandalone } from '../../install'
import './Onboarding.css'

const TILES = 12
type Step = 'county' | 'birds' | 'alerts' | 'lifelist'
type Tag = 'Notable this week' | 'Arriving now' | null


/**
 * The short setup after signing up, shown once: tap the birds you'd love to see, choose how to
 * hear about them, then (only if you keep one) bring your eBird life list. Every step can be
 * skipped, nothing is explained twice, and it ends on Where to go with the birds just starred.
 */
const Onboarding = () => {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const patch = usePatchUserMutation()
  const [step, setStep] = useState<Step>(user.location ? 'birds' : 'county')
  const steps: Step[] = user.location || step !== 'county' ? ['birds', 'alerts', 'lifelist'] : ['county', 'birds', 'alerts', 'lifelist']

  const finish = (to: string) => patch.mutate({ onboarded: true }, { onSettled: () => navigate(to, { replace: true }) })

  // Step 0, only for someone who arrived without a county.
  const [pickState, setPickState] = useState(user.state || 'GA')
  const regions = useRegionsQuery(pickState)
  const [pickCounty, setPickCounty] = useState('')

  // Step 1: birds around the county now. This week's notables, then arriving migrants, then the most recent reports.
  const region = user.location
  const notable = useNotableThisWeekQuery(region)
  const arrivals = useArrivalsQuery(region)
  const recent = useObservationsQuery(region)
  // A quiet county (or a rural Mexican district) may have nothing reported lately; then the birds
  // come from across the state, so the step still has something to star.
  const quiet = Boolean(region) && !recent.isPending && !recent.data?.length && !notable.isPending && !notable.data?.length
  const stateRecent = useObservationsQuery(quiet && user.state ? subnational1(user.state) : '')
  const fromState = quiet && Boolean(stateRecent.data?.length)
  const candidates = useMemo(() => {
    const out: { code: string; tag: Tag }[] = []
    const add = (code: string, tag: Tag) => { if (out.length < TILES && !out.some(c => c.code === code)) out.push({ code, tag }) }
    for (const o of notable.data ?? []) if (out.filter(c => c.tag === 'Notable this week').length < 4) add(o.speciesCode, 'Notable this week')
    for (const a of (arrivals.data?.learning ? [] : arrivals.data?.arrivals ?? [])) if (out.filter(c => c.tag === 'Arriving now').length < 4) add(a.speciesCode, 'Arriving now')
    for (const o of (fromState ? stateRecent.data : recent.data) ?? []) add(o.speciesCode, null)
    return out
  }, [notable.data, arrivals.data, recent.data, fromState, stateRecent.data])
  const birds = useBirdsQuery(candidates.map(c => c.code))
  const byCode = useMemo(() => new Map((birds.data ?? []).map(b => [b.speciesCode, b])), [birds.data])
  const tiles = candidates.map(c => ({ ...c, bird: byCode.get(c.code) })).filter(t => t.bird && t.bird.birdImg && t.bird.birdImg !== 'undefined')
  const [starred, setStarred] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const toggle = (code: string) => setStarred(current => { const next = new Set(current); if (next.has(code)) next.delete(code); else next.add(code); return next })
  const saveBirds = async () => {
    setSaving(true)
    for (const code of starred) { try { await postSavedBird(code) } catch { /* one that fails is easy to star later */ } }
    await queryClient.invalidateQueries({ queryKey: queryKeys.saved })
    setSaving(false)
    setStep('alerts')
  }

  // Step 2: how to hear about them.
  const push = usePushNotifications()
  const [prefs, setPrefs] = useState({
    push_watchlist_enabled: true,
    push_first_of_season: true,
    push_notable_enabled: false,
    alert_digest_email_enabled: false
  })
  const rows: { field: keyof typeof prefs; label: string }[] = [
    { field: 'push_watchlist_enabled', label: 'Birds you starred' },
    { field: 'push_first_of_season', label: 'First migrants of the season' },
    { field: 'push_notable_enabled', label: 'Rarities near you' },
    { field: 'alert_digest_email_enabled', label: 'A morning email instead' }
  ]
  const pushSupported = push.state !== 'unsupported'
  const saveAlerts = () => patch.mutate(prefs as UserPatch, { onSettled: () => setStep('lifelist') })

  // Step 3: the life list, only if they keep one.
  const [keeps, setKeeps] = useState<boolean | null>(null)
  const importer = useImportLifeListMutation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [imported, setImported] = useState<number | null>(null)
  const [liferOn, setLiferOn] = useState(false)
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) importer.mutate(await file.text(), { onSuccess: (r) => setImported(r.total) })
  }
  const done = () => finish(starred.size ? '/go' : '/')

  const dots = (
    <div className='onboard__top'>
      <span className='onboard__dots' aria-label={`Step ${steps.indexOf(step) + 1} of ${steps.length}`}>
        {steps.map(s => <span key={s} className={s === step ? 'is-on' : ''} />)}
      </span>
      <button type='button' className='onboard__skip' onClick={() => finish('/')}>Skip</button>
    </div>
  )

  return (
    <main className='onboard'>
      <section className='onboard__card'>
        {dots}

        {step === 'county' && (
          <>
            <h1 className='fredericka onboard__title'>Where do you bird?</h1>
            <div className='onboard__pick'>
              <select className='select' aria-label='State' value={pickState} onChange={(e) => { setPickState(e.target.value); setPickCounty('') }}>
                <StateOptions />
              </select>
              <select className='select' aria-label={countyLabel(pickState)} value={pickCounty} onChange={(e) => setPickCounty(e.target.value)}>
                <option value=''>{countyLabel(pickState)}</option>
                {(regions.data ?? []).map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
              </select>
            </div>
            <button type='button' className='pill-button pill-button--primary onboard__next' disabled={!pickCounty || patch.isPending}
              onClick={() => patch.mutate({ state: pickState, location: pickCounty }, { onSuccess: () => setStep('birds') })}>Next</button>
          </>
        )}

        {step === 'birds' && (
          <>
            <h1 className='fredericka onboard__title'>Tap the birds you’d love to see</h1>
            <p className='onboard__lede'>We’ll tell you when they’re around.</p>
            {fromState && tiles.length > 0 && <p className='onboard__lede'>Nothing has been reported in your {countyWord(user.state)} lately, so these are from across {stateName(user.state) ?? 'your state'}.</p>}
            {tiles.length ? (
              <ul className='onboard__tiles'>
                {tiles.map(({ code, tag, bird }) => {
                  const on = starred.has(code)
                  return (
                    <li key={code}>
                      <button type='button' className={`onboard__tile ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(code)}>
                        <img src={bird!.birdImg!} alt='' loading='lazy' />
                        {on && <span className='onboard__check' aria-hidden='true'>★</span>}
                        <span className='onboard__name'>{bird!.comName}</span>
                        {tag && <span className='onboard__tag'>{tag}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : <p className='onboard__lede'>{recent.isPending || (quiet && stateRecent.isPending && Boolean(user.state)) || (candidates.length > 0 && birds.isPending) ? 'Finding birds near you…' : 'No recent reports to show yet. You can star birds from the home page any time.'}</p>}
            <button type='button' className='pill-button pill-button--primary onboard__next onboard__next--stick' disabled={saving} onClick={() => { void saveBirds() }}>
              {saving ? 'Saving…' : starred.size ? `Next (${starred.size})` : 'Next'}
            </button>
          </>
        )}

        {step === 'alerts' && (
          <>
            <h1 className='fredericka onboard__title'>How should we tell you?</h1>
            {/* On iPhone, Safari only offers notifications once the app is on the Home Screen, so say that before anything else. */}
            {isIOS() && !isStandalone()
              ? <p className='onboard__note'>To get notifications on iPhone, add Bird Alert! to your Home Screen first (Share → Add to Home Screen).</p>
              : pushSupported && (push.state === 'on'
                  ? <p className='onboard__ok'>✓ Notifications are on for this device</p>
                  : <button type='button' className='pill-button onboard__push' onClick={() => { void push.enable() }} disabled={push.state === 'busy' || push.state === 'denied'}>
                      🔔 {push.state === 'denied' ? 'Notifications are blocked in your browser' : push.state === 'busy' ? 'Turning on…' : 'Turn on notifications'}
                    </button>)}
            <ul className='onboard__rows'>
              {rows.map(({ field, label }) => (
                <li key={field}>
                  <label>
                    <input className='switch switch--small' type='checkbox' checked={prefs[field]} onChange={(e) => setPrefs(p => ({ ...p, [field]: e.target.checked }))} />
                    {label}
                  </label>
                </li>
              ))}
            </ul>
            <button type='button' className='pill-button pill-button--primary onboard__next' disabled={patch.isPending} onClick={saveAlerts}>Next</button>
          </>
        )}

        {step === 'lifelist' && (
          <>
            <h1 className='fredericka onboard__title'>Do you keep an eBird life list?</h1>
            {keeps === null && (
              <div className='onboard__yesno'>
                <button type='button' className='pill-button pill-button--primary' onClick={() => setKeeps(true)}>Yes</button>
                <button type='button' className='pill-button' onClick={done}>No</button>
              </div>
            )}
            {keeps && imported === null && (
              <>
                <p className='onboard__lede'>On eBird: My eBird → Life List → Download (CSV). Then choose the file.</p>
                <input ref={fileRef} type='file' accept='.csv,text/csv' className='visually-hidden' onChange={(e) => { void onFile(e) }} />
                <button type='button' className='pill-button pill-button--primary onboard__next' disabled={importer.isPending} onClick={() => fileRef.current?.click()}>{importer.isPending ? 'Importing…' : 'Choose file'}</button>
                {importer.isError && <p className='onboard__error' role='alert'>{errorMessage(importer.error)}</p>}
                <button type='button' className='onboard__later' onClick={done}>I’ll do it later</button>
              </>
            )}
            {keeps && imported !== null && (
              <>
                <p className='onboard__ok'>✓ {imported} {imported === 1 ? 'bird' : 'birds'} on your life list</p>
                {imported >= 10 && (
                  liferOn
                    ? <p className='onboard__ok'>✓ We’ll tell you when a possible lifer is nearby</p>
                    : <p className='onboard__lifer'>Want a heads-up when a possible lifer is nearby?
                        <button type='button' className='pill-button' onClick={() => patch.mutate({ push_lifer_enabled: true }, { onSuccess: () => setLiferOn(true) })}>Turn on</button>
                      </p>
                )}
                <button type='button' className='pill-button pill-button--primary onboard__next' onClick={done}>Done</button>
              </>
            )}
          </>
        )}
      </section>
    </main>
  )
}

export default Onboarding
