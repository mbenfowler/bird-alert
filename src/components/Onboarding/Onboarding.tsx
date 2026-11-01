import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { errorMessage, postSavedBird } from '../../apiCalls'
import { queryKeys, useArrivalsQuery, useBirdsQuery, useCurrentUser, useNotableThisWeekQuery, useObservationsQuery } from '../../hooks/queries'
import { useImportLifeListMutation, usePatchUserMutation } from '../../hooks/mutations'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useQueryClient } from '@tanstack/react-query'
import { countyWord, stateName, subnational1 } from '../../usStates'
import AreaPicker, { type PickedArea } from '../AreaPicker/AreaPicker'
import type { UserPatch } from '../../types'
import { isIOS, isStandalone } from '../../install'
import InstallSteps from '../InstallSteps/InstallSteps'
import { popStar } from '../Pop/pop'
import './Onboarding.css'
import { t } from '../../i18n'

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

  // Step 0, only for someone who arrived without a county: by location, by name, or by browsing.
  const [picked, setPicked] = useState<PickedArea | null>(null)

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
    { field: 'push_watchlist_enabled', label: t('onboard.rowStarred') },
    { field: 'push_first_of_season', label: t('onboard.rowFirst') },
    { field: 'push_notable_enabled', label: t('onboard.rowRare') },
    { field: 'alert_digest_email_enabled', label: t('onboard.rowEmail') }
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
      <span className='onboard__dots' aria-label={t('onboard.step', { n: steps.indexOf(step) + 1, count: steps.length })}>
        {steps.map(s => <span key={s} className={s === step ? 'is-on' : ''} />)}
      </span>
      <button type='button' className='onboard__skip' onClick={() => finish('/')}>{t('onboard.skip')}</button>
    </div>
  )

  return (
    <main className='onboard'>
      <section className='onboard__card'>
        {dots}

        {step === 'county' && (
          <>
            <h1 className='fredericka onboard__title'>{t('area.title')}</h1>
            {picked ? (
              <p className='onboard__lede onboard__picked'>
                <strong>{picked.label}</strong>{' '}
                <button type='button' className='link-button link-text' onClick={() => setPicked(null)}>{t('common.change')}</button>
              </p>
            ) : (
              <div className='onboard__pick'>
                <AreaPicker onPick={setPicked} />
              </div>
            )}
            {patch.isError && <p className='onboard__lede' role='alert'>{errorMessage(patch.error)}</p>}
            <button type='button' className='pill-button pill-button--primary onboard__next' disabled={!picked || patch.isPending}
              onClick={() => picked && patch.mutate({ state: picked.state, location: picked.location }, { onSuccess: () => setStep('birds') })}>{t('onboard.next')}</button>
          </>
        )}

        {step === 'birds' && (
          <>
            <h1 className='fredericka onboard__title'>{t('onboard.birdsTitle')}</h1>
            <p className='onboard__lede'>{t('onboard.birdsLede')}</p>
            {fromState && tiles.length > 0 && <p className='onboard__lede'>{t('onboard.fromState', { word: countyWord(user.state), state: stateName(user.state) ?? t('onboard.yourState') })}</p>}
            {tiles.length ? (
              <ul className='onboard__tiles'>
                {tiles.map(({ code, tag, bird }) => {
                  const on = starred.has(code)
                  return (
                    <li key={code}>
                      <button type='button' className={`onboard__tile ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={(e) => { popStar(e.currentTarget, !on); toggle(code) }}>
                        <img src={bird!.birdImg!} alt='' loading='lazy' />
                        {on && <span className='onboard__check' aria-hidden='true'>★</span>}
                        <span className='onboard__name'>{bird!.comName}</span>
                        {tag && <span className='onboard__tag'>{tag === 'Notable this week' ? t('onboard.tagNotable') : t('onboard.tagArriving')}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : <p className='onboard__lede'>{recent.isPending || (quiet && stateRecent.isPending && Boolean(user.state)) || (candidates.length > 0 && birds.isPending) ? t('onboard.finding') : t('onboard.noReports')}</p>}
            <button type='button' className='pill-button pill-button--primary onboard__next onboard__next--stick' disabled={saving} onClick={() => { void saveBirds() }}>
              {saving ? t('onboard.saving') : starred.size ? t('onboard.nextCount', { count: starred.size }) : t('onboard.next')}
            </button>
          </>
        )}

        {step === 'alerts' && (
          <>
            <h1 className='fredericka onboard__title'>{t('onboard.alertsTitle')}</h1>
            {/* On iPhone, Safari only offers notifications once the app is on the Home Screen, so say that before anything else. */}
            {isIOS() && !isStandalone()
              ? <InstallSteps />
              : pushSupported && (push.state === 'on'
                  ? <p className='onboard__ok'>{t('onboard.pushOn')}</p>
                  : <button type='button' className='pill-button onboard__push' onClick={() => { void push.enable() }} disabled={push.state === 'busy' || push.state === 'denied'}>
                      🔔 {push.state === 'denied' ? t('onboard.pushBlocked') : push.state === 'busy' ? t('pushAsk.turningOn') : t('onboard.pushTurnOn')}
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
            <button type='button' className='pill-button pill-button--primary onboard__next' disabled={patch.isPending} onClick={saveAlerts}>{t('onboard.next')}</button>
          </>
        )}

        {step === 'lifelist' && (
          <>
            <h1 className='fredericka onboard__title'>{t('onboard.lifeTitle')}</h1>
            {keeps === null && (
              <div className='onboard__yesno'>
                <button type='button' className='pill-button pill-button--primary' onClick={() => setKeeps(true)}>{t('common.yes')}</button>
                <button type='button' className='pill-button' onClick={done}>{t('common.no')}</button>
              </div>
            )}
            {keeps && imported === null && (
              <>
                <p className='onboard__lede'>{t('onboard.lifeHow')}</p>
                <input ref={fileRef} type='file' accept='.csv,text/csv' className='visually-hidden' onChange={(e) => { void onFile(e) }} />
                <button type='button' className='pill-button pill-button--primary onboard__next' disabled={importer.isPending} onClick={() => fileRef.current?.click()}>{importer.isPending ? t('lifeList.importing') : t('onboard.chooseFile')}</button>
                {importer.isError && <p className='onboard__error' role='alert'>{errorMessage(importer.error)}</p>}
                <button type='button' className='onboard__later' onClick={done}>{t('onboard.later')}</button>
              </>
            )}
            {keeps && imported !== null && (
              <>
                <p className='onboard__ok'>{t('onboard.imported', { count: imported })}</p>
                {imported >= 10 && (
                  liferOn
                    ? <p className='onboard__ok'>{t('onboard.liferOn')}</p>
                    : <p className='onboard__lifer'>{t('onboard.liferAsk')}
                        <button type='button' className='pill-button' onClick={() => patch.mutate({ push_lifer_enabled: true }, { onSuccess: () => setLiferOn(true) })}>{t('onboard.turnOn')}</button>
                      </p>
                )}
                <button type='button' className='pill-button pill-button--primary onboard__next' onClick={done}>{t('route.done')}</button>
              </>
            )}
          </>
        )}
      </section>
    </main>
  )
}

export default Onboarding
