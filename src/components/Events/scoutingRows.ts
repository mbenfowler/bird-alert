import type { EventScouting, GroupEvent, ScoutingFresh, ScoutingTarget } from '../../types'
import { daysUntil, t } from '../../i18n'

/** "this morning", "today", "yesterday", "3 days ago": when a report was made, as the morning push would say it. */
export const whenShort = (obsDt: string) => {
  const ago = -daysUntil(obsDt.slice(0, 10))
  if (ago <= 0) {
    const hour = Number(obsDt.slice(11, 13))
    return obsDt.length > 10 && Number.isFinite(hour) && hour < 12 ? t('scoutingToday.thisMorning') : t('scoutingView.today')
  }
  if (ago === 1) return t('scoutingView.yesterday')
  return t('scoutingView.daysAgo', { count: ago })
}

/** ABA codes 3-5 count as rare (1-2 are regular birds), as on the server. */
const rareCode = (aba: number | null | undefined) => (aba && aba >= 3 && aba <= 5 ? aba : 0)

/** Rarest first (ABA code 3-5, higher first); otherwise the server's order (flagged, then newest). */
export const rarestFirst = (fresh: ScoutingFresh[]) =>
  fresh.map((f, i) => ({ f, i })).sort((a, b) => rareCode(b.f.aba) - rareCode(a.f.aba) || a.i - b.i).map(({ f }) => f)

/** A target with what the page knows about it this week. `status` is null when scouting hasn't said. */
export interface TargetRow {
  code: string
  name: string
  status: ScoutingTarget['status'] | null
  lastObsDt: string | null
  lastLocName: string | null
  aba: number | null
  lifer: boolean
  /** On the day's tally already. */
  got: boolean
  target: GroupEvent['targets'][number]
}

/**
 * The event's targets with their status this week: the server's `targets` when it sends them, else
 * worked out from the reports (reported this week: around; listed as unreported: missing).
 */
export const targetRows = (event: { targets: GroupEvent['targets']; tally?: { code: string }[] }, scouting: Pick<EventScouting, 'reported' | 'unreported' | 'targets' | 'using'> | undefined, nameOf: (code: string) => string): TargetRow[] => {
  const tally = new Set((event.tally ?? []).map(entry => entry.code))
  const fromServer = new Map((scouting?.targets ?? []).map(target => [target.code, target]))
  const latest = new Map<string, EventScouting['reported'][number]>()
  const derive = !scouting?.targets && scouting?.using !== 'likely_lifers'
  if (derive) for (const r of scouting?.reported ?? []) if (!latest.has(r.code) || r.obsDt > latest.get(r.code)!.obsDt) latest.set(r.code, r)
  const missing = new Map(derive ? (scouting?.unreported ?? []).map(u => [u.code, u]) : [])
  return event.targets.map(target => {
    const known = fromServer.get(target.code)
    const report = latest.get(target.code)
    const status = known?.status ?? (report ? 'around' : missing.has(target.code) ? 'missing' : null)
    return {
      code: target.code,
      name: known?.comName ?? report?.comName ?? missing.get(target.code)?.comName ?? nameOf(target.code),
      status,
      lastObsDt: known ? (known.last_obs_dt ?? null) : (report?.obsDt ?? null),
      lastLocName: known ? (known.last_loc_name ?? null) : (report?.locName ?? null),
      aba: known?.aba ?? null,
      lifer: known?.lifer ?? Boolean(target.lifer_for_you),
      got: tally.has(target.code),
      target
    }
  })
}

const GROUP: Record<string, number> = { around: 0, quiet: 1, missing: 2 }
/** Rare (ABA 3+) or a lifer: worth seeing first within its group. */
export const isSpecial = (row: Pick<TargetRow, 'aba' | 'lifer'>) => row.lifer || (row.aba ?? 0) >= 3

/**
 * Most useful first: around this week (newest report first), then quiet, then missing, then any
 * scouting hasn't spoken for; within each, rare birds and lifers first. Otherwise the list's own order.
 */
export const sortTargets = (rows: TargetRow[]) =>
  rows.map((row, i) => ({ row, i })).sort((a, b) =>
    (GROUP[a.row.status ?? ''] ?? 3) - (GROUP[b.row.status ?? ''] ?? 3)
    || Number(isSpecial(b.row)) - Number(isSpecial(a.row))
    || (a.row.status === 'around' ? (b.row.lastObsDt ?? '').localeCompare(a.row.lastObsDt ?? '') : 0)
    || a.i - b.i
  ).map(({ row }) => row)

export type TargetFilter = 'all' | 'around' | 'missing'

export const filterTargets = (rows: TargetRow[], filter: TargetFilter, query: string) => {
  const q = fold(query.trim())
  return rows.filter(row => (filter === 'all' || row.status === filter) && (!q || fold(row.name).includes(q) || row.code.toLowerCase().includes(q)))
}

/** Lower case without accents, so "rivoli" finds "Rivoli’s" and "colibri" finds "Colibrí". */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Before the event (not on the day, not after): in the scouting window, or whenever the morning check has news. */
export const showScoutingCard = (scouting: EventScouting | undefined, { past, onDay, scouting: inWindow }: { past: boolean; onDay: boolean; scouting: boolean }) => {
  if (past || onDay) return false
  if (inWindow) return true
  return Boolean(scouting && (scouting.headline || (scouting.fresh?.length ?? 0) > 0 || scouting.bird_of_day))
}

/** "Reported Nov 3 at Ramsey Canyon": what a target's green dot says. */
export const reportedLine = (row: Pick<TargetRow, 'lastObsDt' | 'lastLocName'>, monthDay: (day: string) => string) => {
  if (!row.lastObsDt) return null
  const date = monthDay(row.lastObsDt.slice(0, 10))
  return row.lastLocName ? t('events.reportedAt', { date, place: row.lastLocName }) : t('events.reportedOn', { date })
}

/**
 * Where a scouting bird links: its sighting page in the event's county, on the report itself when
 * this week's reports carry it (same bird, same place, same time; else same bird and place). With
 * no matching report the page opens on the bird's newest report in the county.
 */
export const scoutSightingPath = (
  location: string,
  bird: { code: string; locId?: string | null; locName?: string | null; obsDt: string },
  reported: Pick<EventScouting['reported'][number], 'code' | 'locId' | 'locName' | 'obsDt' | 'subId'>[]
) => {
  const samePlace = (r: (typeof reported)[number]) => r.code === bird.code && Boolean(r.subId) &&
    ((bird.locId && r.locId === bird.locId) || (bird.locName && r.locName === bird.locName))
  const report = reported.find(r => samePlace(r) && r.obsDt === bird.obsDt) ?? reported.find(samePlace)
  return `/sighting/${encodeURIComponent(bird.code)}/${encodeURIComponent(report?.subId ?? 'latest')}?region=${encodeURIComponent(location)}`
}
