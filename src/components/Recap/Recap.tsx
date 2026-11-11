import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import AbaCode from '../AbaCode/AbaCode'
import Carousel from '../Carousel/Carousel'
import SightingsMap from '../SightingsMap/SightingsMap'
import { getSharedRecap } from '../../apiCalls'
import { useBirdsQuery, useSharedRecapQuery } from '../../hooks/queries'
import { duration } from '../../duration'
import { inUnit, longDistance, useDistanceUnit } from '../../distance'
import { hourLabel, nameLocale, number, t } from '../../i18n'
import { shareUrl } from '../../share'
import type { GroupEvent, Recap as RecapData, RecapScouting } from '../../types'
import FillRecap from './FillRecap'
import RecapCurve from './RecapCurve'
import { cardSafe, saveShareCard } from './shareCard'
import { crewLine, dayStrip, fixesDay, isBigDay, liferCardWho, liferTally, longDay, mergeLifers, nameList, normalizeRecap, redactForPublic, scoutChips, scoutLine, scoutMore, timeIn, zoneOf } from './recapData'
import './Recap.css'

// Soft colours behind a lifer with no photo yet, in turn.
const TINTS = ['#f6e7b0', '#d9e8d2', '#f3d3c2', '#d4e0ef', '#e7dcef']

/** A bird's shape, for a lifer card with no photo. */
const Silhouette = () => (
  <svg width='78' height='78' viewBox='0 0 64 64' aria-hidden='true'>
    <path d='M10 42c7-1 12-5 15-11 2-5 7-8 12-8 4 0 7 2 9 4l8-1-6 5c0 10-7 17-17 19l-3 7h-4l2-7c-6 0-11-3-16-8z' fill='#111111' fillOpacity='0.82' />
    <circle cx='41' cy='28' r='1.6' fill='#ffffff' />
  </svg>
)

/** The dark top: what and when, who went, the big count, and the day from sunrise to sunset. */
const Hero = ({ recap, zone }: { recap: RecapData; zone: string }) => {
  const unit = useDistanceUnit()
  const strip = isBigDay(recap) || recap.event.startsOn === recap.event.endsOn ? dayStrip(recap, zone) : null
  const when = recap.event.startsOn === recap.event.endsOn ? longDay(recap.event.startsOn) : `${longDay(recap.event.startsOn)} – ${longDay(recap.event.endsOn)}`
  const summary = [
    recap.totals.fieldMinutes ? t('recap.fieldTime', { time: duration(recap.totals.fieldMinutes) }) : null,
    recap.totals.stops ? t('recap.stopCount', { count: recap.totals.stops }) : null,
    recap.totals.miles ? longDistance(recap.totals.miles, unit) : null
  ].filter(Boolean).join(' · ')
  const first = recap.totals.firstBird?.at ?? recap.timeline[0]?.at
  const last = recap.totals.lastBird?.at ?? recap.timeline[recap.timeline.length - 1]?.at
  // Each label takes about a third of the bar; closer than that, they'd print over each other.
  const close = Boolean(strip && strip.at.first !== null && strip.at.last !== null && strip.at.last - strip.at.first < 40)
  const span = strip && strip.at.sunrise !== null && strip.at.sunset !== null ? { left: strip.at.sunrise, width: strip.at.sunset - strip.at.sunrise } : null
  return (
    <section className='recap-hero' aria-labelledby='recapTitle'>
      <div className='recap-hero__top'>
        <p className='recap-hero__kicker'>{[isBigDay(recap) ? t('recap.kickerBigDay') : t('recap.kickerTrip'), when, recap.event.area].filter(Boolean).join(' · ')}</p>
        <p className='recap-hero__crew' data-testid='recap-crew'>{crewLine(recap)}</p>
      </div>
      <div className='recap-hero__main'>
        <div className='recap-hero__name'>
          <h1 id='recapTitle'>{recap.event.name}</h1>
          {summary && <p>{summary}</p>}
        </div>
        <p className='recap-hero__count' data-testid='recap-count'>
          <span className='recap-hero__number'>{number(recap.totals.species)}</span>
          <span className='recap-hero__species'>{t('recap.speciesWord', { count: recap.totals.species })}</span>
        </p>
      </div>
      {strip && (
        <div className='recap-strip' role='img' aria-label={t('recap.stripLabel', { first: timeIn(first, zone), last: timeIn(last, zone), sunrise: timeIn(strip.sunrise, zone), sunset: timeIn(strip.sunset, zone) })}>
          <div className='recap-strip__bar' aria-hidden='true'>
            <div className='recap-strip__track' />
            {span && <div className='recap-strip__sun' style={{ left: `${span.left}%`, width: `${span.width}%` }} />}
            {strip.at.first !== null && <div className='recap-strip__mark' style={{ left: `${strip.at.first}%` }} />}
            {strip.at.last !== null && <div className='recap-strip__mark' style={{ left: `${strip.at.last}%` }} />}
            {close
              // Marks too close for two labels: one, from whichever side has the room.
              ? <div className={`recap-strip__label ${strip.at.first! > 50 ? 'recap-strip__label--end' : ''}`} data-testid='recap-bird-span'
                  style={strip.at.first! > 50 ? { right: `${100 - strip.at.last!}%` } : { left: `${strip.at.first}%` }}>
                  {t('recap.birdSpan', { first: timeIn(first, zone), last: timeIn(last, zone) })}
                </div>
              : <>
                  {strip.at.first !== null && <div className='recap-strip__label' style={{ left: `${strip.at.first}%` }}>{t('recap.firstBird', { time: timeIn(first, zone) })}</div>}
                  {strip.at.last !== null && <div className='recap-strip__label recap-strip__label--end' style={{ right: `${100 - strip.at.last}%` }}>{t('recap.lastBird', { time: timeIn(last, zone) })}</div>}
                </>}
          </div>
          <div className='recap-strip__hours' aria-hidden='true'>
            <span>{hourLabel(Math.floor(strip.start / 60) % 24)}</span>
            {strip.sunrise && <span>{t('recap.sunrise', { time: timeIn(strip.sunrise, zone) })}</span>}
            <span>{t('recap.noon')}</span>
            {strip.sunset && <span>{t('recap.sunset', { time: timeIn(strip.sunset, zone) })}</span>}
            <span>{hourLabel(Math.floor(strip.end / 60) % 24)}</span>
          </div>
        </div>
      )}
    </section>
  )
}

/** The day in numbers: stops, distance, time out, the best stop and the best hour, each only when known. */
const Stats = ({ recap, zone }: { recap: RecapData; zone: string }) => {
  const unit = useDistanceUnit()
  const { totals } = recap
  const first = totals.firstBird?.at
  const last = totals.lastBird?.at
  const best = totals.bestHour
  const bestPlace = best ? mostCommonPlace(recap, zone, best.start) : null
  const bestHourText = best ? hourSpan(best.start) : null
  const stats = [
    totals.stops ? { key: 'stops', value: number(totals.stops), label: t('recap.statStops', { count: totals.stops }), note: null } : null,
    totals.miles ? { key: 'miles', value: number(Math.round(inUnit(totals.miles, unit))), label: unit === 'km' ? t('recap.statKm') : t('recap.statMiles'), note: null } : null,
    totals.fieldMinutes ? { key: 'field', value: duration(totals.fieldMinutes), label: t('recap.statField'), note: first && last ? t('recap.statFieldNote', { from: timeIn(first, zone), to: timeIn(last, zone) }) : null } : null,
    totals.bestStop ? { key: 'bestStop', value: number(totals.bestStop.species), label: totals.bestStop.name ? t('recap.statAt', { name: totals.bestStop.name }) : t('recap.statAtPrivate'), note: t('recap.statBestStop') } : null,
    best && bestHourText ? { key: 'bestHour', value: `+${number(best.added)}`, label: t('recap.statBestHour'), note: bestPlace ? t('recap.statHourAt', { span: bestHourText, place: bestPlace }) : bestHourText } : null
  ].filter((s): s is NonNullable<typeof s> => Boolean(s))
  if (!stats.length) return null
  return (
    <section className='recap-stats' aria-label={t('recap.statsLabel')}>
      {stats.map(s => (
        <div key={s.key} className='recap-stat' data-testid={`recap-stat-${s.key}`}>
          <span className='recap-stat__value'>{s.value}</span>
          <span className='recap-stat__label'>{s.label}</span>
          {s.note && <span className='recap-stat__note'>{s.note}</span>}
        </div>
      ))}
    </section>
  )
}

/** "7 to 8 AM", for an hour starting at '07:00'. */
const hourSpan = (start: string) => {
  const h = Number(start.split(':')[0])
  return Number.isFinite(h) ? t('recap.hourSpan', { from: hourLabel(h), to: hourLabel((h + 1) % 24) }) : null
}

/** Where most of the birds of that hour were found. */
const mostCommonPlace = (recap: RecapData, zone: string, start: string) => {
  const h = Number(start.split(':')[0])
  const counts = new Map<string, number>()
  for (const row of recap.timeline) {
    const hour = Number(timeHour(row.at, zone))
    if (hour === h && row.place) counts.set(row.place, (counts.get(row.place) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}
const timeHour = (at: string, zone: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: zone }).format(new Date(at))

/** The lifers, one card per species (whose lifer it was on it), moving along on their own; the bird's photo where there is one. */
const Lifers = ({ recap, zone }: { recap: RecapData; zone: string }) => {
  const cards = useMemo(() => mergeLifers(recap.lifers), [recap.lifers])
  const codes = useMemo(() => cards.map(c => c.speciesCode).sort(), [cards])
  const birds = useBirdsQuery(codes)
  if (!cards.length) return null
  const tally = liferTally(recap)
  const photo = (code: string) => {
    const img = birds.data?.find(b => b.speciesCode === code)?.birdImg
    return img && img !== 'undefined' ? img : null
  }
  const slides = cards.map((c, i) => {
    const img = photo(c.speciesCode)
    return {
      key: c.speciesCode,
      node: (
        <article className='recap-lifer'>
          <div className='recap-lifer__picture' style={{ background: TINTS[i % TINTS.length] }}>
            {img
              ? (
                <>
                  <img className='recap-lifer__backdrop' src={img} alt='' aria-hidden='true' draggable={false} />
                  <img className='recap-lifer__photo' src={img} alt={t('card.photoAlt', { name: c.comName })} width='320' height='240' draggable={false} />
                </>
                )
              : <Silhouette />}
            <span className='recap-lifer__chip'>{t('recap.liferChip')}</span>
          </div>
          <div className='recap-lifer__text'>
            <span className='recap-lifer__bird'>{c.comName}</span>
            <span className='recap-lifer__who'>{liferCardWho(c, recap.audience)}</span>
            <span className='recap-lifer__where'>{c.place ? t('recap.liferWhere', { place: c.place, time: timeIn(c.at, zone) }) : timeIn(c.at, zone)}</span>
          </div>
        </article>
      )
    }
  })
  return (
    <section className='recap-lifers' aria-labelledby='recapLifers'>
      <div className='recap__head'>
        <h2 id='recapLifers' className='recap__h2'>{t('recap.lifers', { count: recap.lifers.length })}</h2>
        <span className='recap__aside'>{tally ? t('recap.liferNoteMembers', { tally }) : t('recap.liferNote')}</span>
      </div>
      <Carousel slides={slides} label={t('recap.liferCarousel')} testId='recap-lifers' />
    </section>
  )
}

/** "The scouting called it": the star, big, with why it matters and its story; then the rest it called, as chips. */
const Scouting = ({ scouting, audience, zone }: { scouting: RecapScouting; audience: RecapData['audience']; zone: string }) => {
  const { star, others } = scouting
  const more = scoutMore(scouting)
  return (
    <article className='recap-card recap-highlight recap-scout' data-testid='recap-scouting'>
      <div className='recap-scout__eyebrow'>
        <span className='recap__eyebrow'>{t('recap.scouting')}</span>
        {scouting.reports > 0 && <span className='recap-scout__reports'>{t('recap.scoutReports', { count: scouting.reports })}</span>}
      </div>
      {star && <>
        <span className='recap-highlight__name recap-scout__star' data-testid='recap-scout-star'>{star.comName}</span>
        <div className='recap-scout__why'>
          {scoutChips(star, audience).map(chip => chip.kind === 'aba'
            ? (chip.code >= 3 ? <AbaCode key='aba' code={chip.code} /> : <span key='aba' className='recap-scout__chip'>{t('aba.short', { code: chip.code })}</span>)
            : <span key={chip.kind} className={`recap-scout__chip${chip.kind === 'lifer' ? ' recap-scout__chip--lifer' : ''}`}>{chip.text}</span>)}
        </div>
        <p className='recap-scout__line'>{scoutLine(star, zone)}</p>
      </>}
      {others.length > 0 && (
        <div className='recap-scout__others'>
          <span className='recap-scout__also'>{star ? t('recap.scoutAlso') : t('recap.scoutFound')}</span>
          <ul className='recap-scout__chips' data-testid='recap-scout-others'>
            {others.map(o => (
              <li key={o.speciesCode} className='recap-scout__bird'>
                {o.lifer && <><span className='recap-scout__dot' aria-hidden='true' /><span className='visually-hidden'>{t('recap.scoutLiferDot')}</span></>}
                <span>{o.comName}</span>
                {o.aba && o.aba >= 2 ? <span className='recap-scout__aba'>{t('aba.short', { code: o.aba })}</span> : null}
              </li>
            ))}
            {more && <li className='recap-scout__bird recap-scout__bird--more' data-testid='recap-scout-more'>{more}</li>}
          </ul>
        </div>
      )}
    </article>
  )
}

/** The rarest bird, the bird the scouting called, and the targets ring. */
const Highlights = ({ recap, zone }: { recap: RecapData; zone: string }) => {
  const { rarest, scoutingCalled } = recap.highlights
  const { targets } = recap
  if (!rarest && !scoutingCalled && !targets.total) return null
  const rarestFor = rarest && recap.audience === 'members' ? recap.timeline.find(row => row.speciesCode === rarest.speciesCode)?.liferFor : null
  const r = 52
  const around = 2 * Math.PI * r
  const share = targets.total ? Math.min(1, targets.found / targets.total) : 0
  return (
    <section className='recap-highlights'>
      {rarest && (
        <article className='recap-card recap-highlight' data-testid='recap-rarest'>
          <span className='recap__eyebrow'>{t('recap.rarest')}</span>
          <div className='recap-highlight__bird'>
            <span className='recap-highlight__name'>{rarest.comName}</span>
            <AbaCode code={rarest.aba} explain />
          </div>
          <p>
            {rarest.place ? t('recap.atPlace', { place: rarest.place, time: timeIn(rarest.at, zone) }) : t('recap.atTime', { time: timeIn(rarest.at, zone) })}
            {rarestFor?.length ? ` ${t('recap.rarestLifer', { names: nameList(rarestFor) })}` : ''}
          </p>
        </article>
      )}
      {scoutingCalled && <Scouting scouting={scoutingCalled} audience={recap.audience} zone={zone} />}
      {targets.total > 0 && (
        <article className='recap-card recap-highlight recap-targets' data-testid='recap-targets'>
          <svg width='120' height='120' viewBox='0 0 120 120' role='img' aria-label={t('recap.targetsRing', { found: targets.found, total: targets.total })}>
            <circle cx='60' cy='60' r={r} fill='none' stroke='#e8e8e8' strokeWidth='14' />
            <circle cx='60' cy='60' r={r} fill='none' stroke='#111111' strokeWidth='14' strokeDasharray={`${(around * share).toFixed(1)} ${around.toFixed(1)}`} transform='rotate(-90 60 60)' />
            <text x='60' y='58' textAnchor='middle' className='recap-targets__found'>{targets.found}</text>
            <text x='60' y='80' textAnchor='middle' className='recap-targets__of'>{t('recap.ofTotal', { total: targets.total })}</text>
          </svg>
          <div className='recap-targets__text'>
            <span className='recap__eyebrow'>{t('recap.targets')}</span>
            {targets.missed.length
              ? <><span className='recap-targets__next'>{t('recap.nextTime')}</span><span className='recap-targets__missed'>{targets.missed.join(', ')}</span></>
              : <span className='recap-targets__next'>{t('recap.allTargets')}</span>}
          </div>
        </article>
      )}
    </section>
  )
}

/** The route on the app's own map, and each stop with when, how long, and what it added. */
const Route = ({ recap, zone }: { recap: RecapData; zone: string }) => {
  const unit = useDistanceUnit()
  if (!recap.stops.length) return null
  const sunset = dayStrip(recap, zone)?.sunset ?? null
  const path = recap.route.line ?? recap.stops.map(s => [s.lat, s.lng] as [number, number])
  const miles = recap.route.miles ?? recap.totals.miles
  return (
    <section className='recap-route'>
      <figure className='recap-card recap-route__map'>
        <SightingsMap points={[]} height={320} ariaLabel={t('recap.routeLabel', { count: recap.stops.length })}
          route={{ path, stops: recap.stops.map((s, i) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}. ${s.name}` })) }} />
        <figcaption>{[miles ? `${longDistance(miles, unit)}.` : null, recap.audience === 'public' ? t('recap.routePublic') : null].filter(Boolean).join(' ')}</figcaption>
      </figure>
      <ol className='recap-route__stops' aria-label={t('recap.stopsLabel')} data-testid='recap-stops'>
        {recap.stops.map((s, i) => {
          const best = recap.totals.bestStop?.index === s.index
          const night = Boolean(s.arrive && sunset && Date.parse(s.arrive) > sunset.getTime())
          const when = [s.arrive ? timeIn(s.arrive, zone) : null, s.stayMin ? duration(s.stayMin) : null].filter(Boolean).join(' · ')
          return (
            <li key={s.index} className='recap-stop'>
              <span className={`recap-stop__pin ${best ? 'is-best' : night ? 'is-night' : ''}`} aria-hidden='true'>{i + 1}</span>
              <div className='recap-stop__what'>
                <span className='recap-stop__name'>{s.name}</span>
                {when && <span className='recap-stop__when'>{when}</span>}
              </div>
              <div className='recap-stop__count'>
                {/* One number: the tally keeps each bird at its first stop, so what a stop found is what it added. */}
                <span className='recap-stop__species'>+{number(s.added)}</span>
                <span className='recap-stop__added'>{[t('recap.stopNew'), best ? t('recap.stopBest') : null].filter(Boolean).join(' · ')}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Who found what (members only): each person's count, and the birds only they saw. */
const WhoFound = ({ recap }: { recap: RecapData }) => {
  // With one person (or nobody ticking) there's nothing to compare.
  const people = recap.byMember ?? []
  if (recap.audience !== 'members' || people.length < 2) return null
  const top = Math.max(recap.totals.species, ...people.map(m => m.count), 1)
  return (
    <section className='recap-card recap-who' aria-labelledby='recapWho' data-testid='recap-who'>
      <div className='recap__head recap__head--start'>
        <h2 id='recapWho' className='recap__h2'>{t('recap.whoFound')}</h2>
        <span className='recap-who__badge'>{t('recap.membersOnly')}</span>
      </div>
      <div className='recap-who__people'>
        {people.map(m => (
          <div key={m.name} className='recap-who__person'>
            <div className='recap-who__line'><span>{m.name}</span><span>{number(m.count)}</span></div>
            <div className='recap-who__bar'><div style={{ width: `${((m.count / top) * 100).toFixed(1)}%` }} /></div>
            {m.only.length > 0 && (
              <span className='recap-who__only'>{t('recap.onlyThem', {
                name: m.name, count: m.only.length,
                birds: nameList(m.only.length > 4 ? [...m.only.slice(0, 3), t('recap.more', { count: m.only.length - 3 })] : m.only)
              })}</span>
            )}
          </div>
        ))}
      </div>
      {typeof recap.together === 'number' && recap.together > 0 && <p>{t('recap.together', { count: recap.together })}</p>}
    </section>
  )
}

interface RecapProps {
  recap: RecapData
  /** On the event's own page: the event, for filling in the tally while fixes are open. */
  event?: GroupEvent
}

/**
 * An event's recap: the dark hero with the count and the sun's hours, the day in numbers, the
 * lifers, the highlights, the Big Day curve, the route, who found what (members only), and the
 * share bar. The same page on /recap/<code> shows the public view; a member can preview it here.
 */
const Recap = ({ recap, event }: RecapProps) => {
  const queryClient = useQueryClient()
  const unit = useDistanceUnit()
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const members = recap.audience === 'members'
  const shared = useSharedRecapQuery(recap.shareCode, members && preview)
  // A member's preview shows exactly what the link does when it can be fetched; with no signal, the same without names.
  const shown = members && preview ? (shared.data ?? redactForPublic(recap)) : recap
  const zone = zoneOf(recap)
  const link = recap.shareCode ? `${window.location.origin}/recap/${encodeURIComponent(recap.shareCode)}` : window.location.href
  const copy = () => void shareUrl(link, t('recap.shareTitle', { name: recap.event.name }))
  const save = async () => {
    setSaving(true)
    try {
      let card = recap
      if (members && recap.shareCode) {
        const code = recap.shareCode
        const answer = await queryClient.fetchQuery({ queryKey: ['event-recap-shared', code, nameLocale()] as const, queryFn: () => getSharedRecap(code), staleTime: 5 * 60 * 1000 }).catch(() => null)
        card = answer ? normalizeRecap(answer) : redactForPublic(recap)
      }
      await saveShareCard(cardSafe(card), zone, unit)
    } catch {
      toast.error(t('recap.cardFailed'), { position: 'bottom-center' })
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className='recap' data-testid='recap' data-audience={shown.audience}>
      <Hero recap={shown} zone={zone} />
      <Stats recap={shown} zone={zone} />
      {event && members && !preview && recap.status === 'open' && <FillRecap event={event} recap={recap} />}
      <Lifers recap={shown} zone={zone} />
      <Highlights recap={shown} zone={zone} />
      <RecapCurve recap={shown} zone={zone} />
      <Route recap={shown} zone={zone} />
      <WhoFound recap={shown} />
      <section id='share' className='recap-share' aria-labelledby='recapShare'>
        <div className='recap-share__text'>
          <h2 id='recapShare' className='recap__h2'>{t('recap.shareHeading')}</h2>
          <p>{members && !preview ? t('recap.shareNoteMembers') : t('recap.shareNotePublic')}</p>
        </div>
        <div className='recap-share__buttons'>
          {members && recap.shareCode && (
            <button type='button' className='recap-share__button' aria-pressed={preview} data-testid='recap-preview' onClick={() => setPreview(p => !p)}>
              {preview ? t('recap.backMembers') : t('recap.seeLink')}
            </button>
          )}
          <button type='button' className='recap-share__button recap-share__button--ink' data-testid='recap-copy' onClick={copy}>{t('recap.copyLink')}</button>
          <button type='button' className='recap-share__button' data-testid='recap-card' disabled={saving} onClick={() => void save()}>{saving ? t('recap.savingCard') : t('recap.saveCard')}</button>
        </div>
      </section>
      <p className='recap__final'>{recap.status === 'open' && recap.fixesUntil ? t('recap.fixesOpen', { date: fixesDay(recap.fixesUntil, recap.event.timezone) }) : t('recap.sealed')}</p>
    </div>
  )
}

export default Recap
