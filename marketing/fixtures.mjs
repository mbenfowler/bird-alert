// @ts-check
/**
 * The made-up world the marketing screens are rendered from. Every hotspot and species is real
 * (so the screens look like the app on a real morning), but every report, count, checklist ID,
 * person and event is invented. Rules, also in README.md:
 *  - only public eBird hotspots, never a personal location or anyone's yard;
 *  - no observer names; group members are invented first names;
 *  - checklist IDs (S9000…) and location IDs (L99…) are past any eBird has issued.
 */

/** The morning everything is rendered at: Saturday 25 April 2026, 7:12 am in Georgia. */
export const NOW = '2026-04-25T07:12:00-04:00'

const HALL = 'US-GA-139'
const COCHISE = 'US-AZ-003'
const EVENT_ID = 7

/** speciesCode -> [common name, scientific name, Wikipedia title for its photo] */
export const SPECIES = {
  // North Georgia in spring migration
  camwar: ['Cape May Warbler', 'Setophaga tigrina', 'Cape May warbler'],
  scatan: ['Scarlet Tanager', 'Piranga olivacea', 'Scarlet tanager'],
  robgro: ['Rose-breasted Grosbeak', 'Pheucticus ludovicianus', 'Rose-breasted grosbeak'],
  indbun: ['Indigo Bunting', 'Passerina cyanea', 'Indigo bunting'],
  prowar: ['Prothonotary Warbler', 'Protonotaria citrea', 'Prothonotary warbler'],
  balori: ['Baltimore Oriole', 'Icterus galbula', 'Baltimore oriole'],
  bobolink: ['Bobolink', 'Dolichonyx oryzivorus', 'Bobolink'],
  bkbwar: ['Blackburnian Warbler', 'Setophaga fusca', 'Blackburnian warbler'],
  easblu: ['Eastern Bluebird', 'Sialia sialis', 'Eastern bluebird'],
  rthhum: ['Ruby-throated Hummingbird', 'Archilochus colubris', 'Ruby-throated hummingbird'],
  woothr: ['Wood Thrush', 'Hylocichla mustelina', 'Wood thrush'],
  norpar: ['Northern Parula', 'Setophaga americana', 'Northern parula'],
  sumtan: ['Summer Tanager', 'Piranga rubra', 'Summer tanager'],
  hoowar: ['Hooded Warbler', 'Setophaga citrina', 'Hooded warbler'],
  // Cochise County, Arizona
  eletro: ['Elegant Trogon', 'Trogon elegans', 'Elegant trogon'],
  flctan: ['Flame-colored Tanager', 'Piranga bidentata', 'Flame-colored tanager'],
  earque: ['Eared Quetzal', 'Euptilotis neoxenus', 'Eared quetzal'],
  pinfly1: ['Pine Flycatcher', 'Empidonax affinis', 'Pine flycatcher'],
  monqua: ['Montezuma Quail', 'Cyrtonyx montezumae', 'Montezuma quail'],
  refwar: ['Red-faced Warbler', 'Cardellina rubrifrons', 'Red-faced warbler'],
  paired: ['Painted Redstart', 'Myioborus pictus', 'Painted redstart'],
  ariwoo: ['Arizona Woodpecker', 'Dryobates arizonae', 'Arizona woodpecker'],
  rivhum1: ['Rivoli’s Hummingbird', 'Eugenes fulgens', 'Rivoli\'s hummingbird'],
  btmhum: ['Blue-throated Mountain-gem', 'Lampornis clemenciae', 'Blue-throated mountaingem'],
  wesowl1: ['Whiskered Screech-Owl', 'Megascops trichopsis', 'Whiskered screech owl'],
  oliwar: ['Olive Warbler', 'Peucedramus taeniatus', 'Olive warbler'],
  heptan: ['Hepatic Tanager', 'Piranga flava', 'Hepatic tanager'],
  verfly: ['Vermilion Flycatcher', 'Pyrocephalus rubinus', 'Vermilion flycatcher'],
  trokin: ['Tropical Kingbird', 'Tyrannus melancholicus', 'Tropical kingbird'],
  grahaw: ['Gray Hawk', 'Buteo plagiatus', 'Gray hawk'],
  benthr: ['Bendire’s Thrasher', 'Toxostoma bendirei', 'Bendire\'s thrasher'],
  mexjay4: ['Mexican Jay', 'Aphelocoma wollweberi', 'Mexican jay'],
  britit: ['Bridled Titmouse', 'Baeolophus wollweberi', 'Bridled titmouse'],
  elfowl: ['Elf Owl', 'Micrathene whitneyi', 'Elf owl'],
  luchum: ['Lucifer Hummingbird', 'Calothorax lucifer', 'Lucifer hummingbird'],
  bubfly: ['Buff-breasted Flycatcher', 'Empidonax fulvifrons', 'Buff-breasted flycatcher'],
  mexchi: ['Mexican Chickadee', 'Poecile sclateri', 'Mexican chickadee']
}

/** Public eBird hotspots (names as eBird has them) with their rough coordinates. IDs are made up. */
const HOT = {
  // Hall County, GA
  elachee: { locId: 'L99100001', locName: 'Elachee Nature Science Center', lat: 34.2593, lng: -83.8474 },
  laurel: { locId: 'L99100002', locName: 'Laurel Park', lat: 34.3448, lng: -83.8340 },
  longwood: { locId: 'L99100003', locName: 'Lake Lanier--Longwood Park', lat: 34.3061, lng: -83.8346 },
  doncarter: { locId: 'L99100004', locName: 'Don Carter State Park', lat: 34.3887, lng: -83.7462 },
  rockcreek: { locId: 'L99100005', locName: 'Rock Creek Greenway', lat: 34.3000, lng: -83.8290 },
  wilshire: { locId: 'L99100006', locName: 'Wilshire Trails', lat: 34.3120, lng: -83.8140 },
  // Cochise County, AZ
  ramsey: { locId: 'L99200001', locName: 'Ramsey Canyon Preserve', lat: 31.4459, lng: -110.3062 },
  carr: { locId: 'L99200002', locName: 'Carr Canyon', lat: 31.4290, lng: -110.2880 },
  eop: { locId: 'L99200003', locName: 'Sierra Vista Environmental Operations Park', lat: 31.5928, lng: -110.2290 },
  sanpedro: { locId: 'L99200004', locName: 'San Pedro House', lat: 31.5476, lng: -110.1342 },
  whitewater: { locId: 'L99200005', locName: 'Whitewater Draw Wildlife Area', lat: 31.3410, lng: -109.7180 },
  cavecreek: { locId: 'L99200006', locName: 'Cave Creek Canyon--South Fork', lat: 31.8730, lng: -109.1880 },
  huachuca: { locId: 'L99200007', locName: 'Huachuca Canyon', lat: 31.5370, lng: -110.3900 }
}

/** Bird photos are served from here; render.mjs answers it from Wikipedia's lead images, cached. */
export const IMG_HOST = 'https://bird-photos.invalid'

const bird = (code) => {
  const [comName, sciName] = SPECIES[code]
  return { speciesCode: code, comName, sciName, category: 'species', birdImg: `${IMG_HOST}/${code}.jpg`, wikiURL: null, taxonOrder: null, tips: null }
}

let sub = 900000100
const nextSub = () => `S${sub++}`

const obs = (code, place, obsDt, extra = {}) => ({
  speciesCode: code, comName: SPECIES[code][0], sciName: SPECIES[code][1],
  locId: place.locId, locName: place.locName, lat: place.lat, lng: place.lng,
  obsDt, howMany: 1, obsValid: true, obsReviewed: false, locationPrivate: false, subId: nextSub(), ...extra
})

// ---------------------------------------------------------------- the person looking

export const USER = {
  id: 1, username: '', email: 'birder@example.com', location: HALL, state: 'GA', email_confirmed: true,
  alert_digest_email_enabled: true, rare_sightings_email_enabled: true, push_watchlist_enabled: true, push_notable_enabled: true,
  push_notable_batched: false, push_first_of_season: true, migration_email_enabled: false, push_quiet_start: 22, push_quiet_end: 6,
  timezone: 'America/New_York', onboarded_at: '2026-03-02T12:00:00.000Z', range_mi: 30, home_lat: null, home_lng: null,
  rare_alerts_need_proof: true, keep_home_alerts: true, activePlace: null, activeEvent: null,
  upcomingEvent: { id: EVENT_ID, name: 'Cochise County Big Day', starts_on: '2026-05-02' }, lastEvent: null,
  created_at: '2026-03-02T12:00:00.000Z', updated_at: '2026-04-20T12:00:00.000Z', hasPasskey: true
}

// ---------------------------------------------------------------- home: Hall County

const WATCH = ['camwar', 'robgro', 'bobolink', 'prowar', 'bkbwar']
const HOME_LIST = ['scatan', 'camwar', 'robgro', 'indbun', 'prowar', 'balori', 'bkbwar', 'hoowar', 'rthhum', 'woothr', 'norpar', 'sumtan', 'easblu', 'bobolink']
// The county list runs to 148 species; only the first page is ever fetched, so the rest are only counted.
const SPECIES_LIST = [...HOME_LIST, ...Array.from({ length: 148 - HOME_LIST.length }, (_, i) => `zz${i}`)]

const HALL_RECENT = [
  obs('camwar', HOT.elachee, '2026-04-25 06:58', { howMany: 2 }),
  obs('robgro', HOT.laurel, '2026-04-24 17:40', { howMany: 3 }),
  obs('bobolink', HOT.doncarter, '2026-04-24 08:15', { howMany: 14 }),
  obs('prowar', HOT.longwood, '2026-04-23 09:30'),
  obs('bkbwar', HOT.wilshire, '2026-04-23 07:50'),
  obs('scatan', HOT.elachee, '2026-04-25 06:58'),
  obs('indbun', HOT.rockcreek, '2026-04-24 10:05', { howMany: 4 })
]

// ---------------------------------------------------------------- notable: Cochise County, with ABA codes

const ev = (confirmed, media, birders) => ({ confirmed, media, birders })
export const NOTABLE = [
  obs('pinfly1', HOT.ramsey, '2026-04-25 06:31', { aba: 5, evidence: ev(false, false, 1) }),
  obs('earque', HOT.cavecreek, '2026-04-24 16:05', { aba: 4, evidence: ev(true, true, 7), obsReviewed: true }),
  obs('flctan', HOT.huachuca, '2026-04-24 08:20', { aba: 3, evidence: ev(true, true, 4), obsReviewed: true }),
  obs('eletro', HOT.cavecreek, '2026-04-25 06:40', { aba: 2, howMany: 2, evidence: ev(null, true, 5) })
]

// ---------------------------------------------------------------- where to go: Hall County watch list

const lastSeen = (day, time, daysAgo) => ({ day, time, subId: nextSub(), daysAgo })
const pb = (code, chance, band, seen) => ({ speciesCode: code, comName: SPECIES[code][0], chance, band, lastSeen: seen, note: null })
const goPlace = (h, birds, bestTime, seenToday = false) => ({
  ...h, isHotspot: true, merged: [], birds, bestTime, seenToday,
  expected: Math.round(birds.reduce((s, b) => s + b.chance, 0) / 10) / 10
})
const GO_PLACES = [
  goPlace(HOT.elachee, [pb('camwar', 64, 'High', lastSeen('2026-04-25', '06:58', 0)), pb('bkbwar', 41, 'Good', lastSeen('2026-04-24', '08:10', 1)), pb('robgro', 38, 'Good', lastSeen('2026-04-23', '07:35', 2))], '7 am to 9 am', true),
  goPlace(HOT.longwood, [pb('prowar', 57, 'Good', lastSeen('2026-04-23', '09:30', 2)), pb('camwar', 22, 'Fair', lastSeen('2026-04-21', '08:00', 4))], '8 am to 10 am'),
  goPlace(HOT.doncarter, [pb('bobolink', 46, 'Good', lastSeen('2026-04-24', '08:15', 1)), pb('prowar', 24, 'Fair', lastSeen('2026-04-20', '09:10', 5))], '7 am to 9 am'),
  goPlace(HOT.laurel, [pb('robgro', 44, 'Good', lastSeen('2026-04-24', '17:40', 1)), pb('camwar', 18, 'Long shot', lastSeen('2026-04-19', '08:45', 6))], '5 pm to 7 pm'),
  goPlace(HOT.wilshire, [pb('bkbwar', 33, 'Fair', lastSeen('2026-04-23', '07:50', 2))], '7 am to 9 am')
]
const goStop = (p) => ({ locId: p.locId, locName: p.locName, lat: p.lat, lng: p.lng, expected: p.expected, bestTime: p.bestTime, birds: p.birds })
const grade = (n, hits) => ({ n, hits, rate: hits / n, enough: true })
export const WHERE_TO_GO = {
  region: HALL, asOf: '2026-04-25',
  species: [
    { speciesCode: 'camwar', comName: 'Cape May Warbler', class: 'passage', bestTime: { label: '7 am to 9 am', source: 'reports' }, places: 3, best: { locId: HOT.elachee.locId, locName: HOT.elachee.locName, chance: 64 } },
    { speciesCode: 'robgro', comName: 'Rose-breasted Grosbeak', class: 'passage', bestTime: { label: '7 am to 9 am', source: 'reports' }, places: 2, best: { locId: HOT.laurel.locId, locName: HOT.laurel.locName, chance: 44 } },
    { speciesCode: 'bobolink', comName: 'Bobolink', class: 'passage', bestTime: { label: '7 am to 9 am', source: 'typical' }, places: 1, best: { locId: HOT.doncarter.locId, locName: HOT.doncarter.locName, chance: 46 } },
    { speciesCode: 'prowar', comName: 'Prothonotary Warbler', class: 'seasonal', bestTime: { label: '8 am to 10 am', source: 'reports' }, places: 2, best: { locId: HOT.longwood.locId, locName: HOT.longwood.locName, chance: 57 } },
    { speciesCode: 'bkbwar', comName: 'Blackburnian Warbler', class: 'passage', bestTime: { label: '7 am to 9 am', source: 'typical' }, places: 2, best: { locId: HOT.elachee.locId, locName: HOT.elachee.locName, chance: 41 } }
  ],
  places: GO_PLACES,
  grades: { High: grade(41, 33), Good: grade(88, 52), Fair: grade(73, 27), 'Long shot': grade(40, 6) },
  onFile: { checklists: 412 },
  route: { stops: [GO_PLACES[0], GO_PLACES[1], GO_PLACES[2]].map(goStop), covers: 3.4, url: null, drive: null, origin: null }
}


export const SPECIES_HOTSPOTS = {
  region: HALL, days: 30, since: '2026-03-27',
  onFile: { checklists: 412, detailed: 351, firstDay: '2026-03-02' },
  species: { code: 'camwar', comName: 'Cape May Warbler' },
  hotspots: [
    { ...hs(HOT.elachee), checklists: 38, detailed: 31, reports: 14, frequency: 14 / 31, lastSeen: { day: '2026-04-25', subId: nextSub(), howMany: 2 } },
    { ...hs(HOT.wilshire), checklists: 22, detailed: 18, reports: 6, frequency: 6 / 18, lastSeen: { day: '2026-04-24', subId: nextSub(), howMany: 1 } },
    { ...hs(HOT.rockcreek), checklists: 27, detailed: 20, reports: 5, frequency: 5 / 20, lastSeen: { day: '2026-04-22', subId: nextSub(), howMany: 1 } },
    { ...hs(HOT.laurel), checklists: 19, detailed: 15, reports: 3, frequency: 3 / 15, lastSeen: { day: '2026-04-19', subId: nextSub(), howMany: 1 } },
    { ...hs(HOT.longwood), checklists: 24, detailed: 19, reports: 3, frequency: 3 / 19, lastSeen: { day: '2026-04-21', subId: nextSub(), howMany: 2 } },
    { ...hs(HOT.doncarter), checklists: 16, detailed: 12, reports: 1, frequency: 1 / 12, lastSeen: { day: '2026-04-17', subId: nextSub(), howMany: 1 } }
  ]
}
function hs (h) { return { locId: h.locId, name: h.locName, lat: h.lat, lng: h.lng } }

// ---------------------------------------------------------------- the Big Day: Cochise County

const TARGETS = ['eletro', 'flctan', 'paired', 'ariwoo', 'rivhum1', 'btmhum', 'wesowl1', 'refwar', 'oliwar', 'monqua', 'heptan', 'verfly', 'trokin', 'grahaw', 'mexjay4', 'britit', 'elfowl', 'lucihu', 'bubfly', 'mexchi'].map(c => c === 'lucihu' ? 'luchum' : c)
const MISSING = ['luchum', 'bubfly', 'mexchi']

/** Who saw what where this week: newest first, as the server sends it. */
const scoutRows = []
const scout = (place, obsDt, codes, evidence = {}) => {
  const subId = nextSub()
  for (const code of codes) {
    const e = evidence[code] ?? {}
    scoutRows.push({ code, speciesCode: code, comName: SPECIES[code][0], locName: place.locName, locId: place.locId, lat: place.lat, lng: place.lng, obsDt, birders: e.birders ?? 1, confirmed: e.confirmed ?? null, media: e.media ?? null, subId })
  }
}
scout(HOT.ramsey, '2026-04-25 06:31', ['wesowl1', 'flctan', 'paired', 'ariwoo', 'rivhum1', 'btmhum', 'mexjay4', 'britit', 'eletro'], { flctan: { confirmed: true, media: true, birders: 3 }, eletro: { confirmed: false, birders: 1 } })
scout(HOT.cavecreek, '2026-04-24 18:50', ['elfowl', 'eletro', 'mexjay4', 'paired'], { eletro: { confirmed: true, media: true, birders: 5 } })
scout(HOT.sanpedro, '2026-04-24 07:05', ['grahaw', 'verfly', 'trokin'])
scout(HOT.carr, '2026-04-23 08:40', ['refwar', 'oliwar', 'monqua', 'heptan', 'paired'])
scout(HOT.eop, '2026-04-23 07:20', ['verfly', 'trokin'])
scout(HOT.whitewater, '2026-04-22 09:15', ['verfly'])

export const SCOUTING = {
  checked_at: '2026-04-25T11:05:00.000Z', days_to_go: 7, window: { from: '2026-04-18', to: '2026-04-25' }, using: 'targets',
  reported: scoutRows,
  unreported: MISSING.map(code => ({ code, speciesCode: code, comName: SPECIES[code][0] }))
}

export const EVENT = {
  id: EVENT_ID, name: 'Cochise County Big Day', state: 'AZ', location: COCHISE, range_mi: 0, home_lat: null, home_lng: null, place_id: null,
  starts_on: '2026-05-02', ends_on: '2026-05-02', kind: 'bigday', scout: true, scout_days: 7, scout_from: '2026-04-25',
  active: false, past: false, archived: false, role: 'organizer', display_name: 'Robin', recap: null,
  members: [
    { display_name: 'Robin', role: 'organizer', you: true },
    { display_name: 'Sam', role: 'member' },
    { display_name: 'Priya', role: 'member' }
  ],
  targets: TARGETS.map(code => ({ code, lifer_for: ['eletro', 'flctan', 'earque', 'refwar', 'elfowl', 'monqua', 'luchum'].includes(code) ? ['Sam'] : [], lifer_for_you: ['flctan', 'monqua', 'luchum', 'bubfly'].includes(code) })),
  tally: [],
  invite_url: '/events/join/fixture-invite', view_url: '/events/view/fixture-view'
}

/** The meeting point: the town, never anyone's house. */
const MEET = { name: 'Sierra Vista', lat: 31.5455, lng: -110.2773 }
const ROUTE_STOPS = [HOT.ramsey, HOT.carr, HOT.sanpedro]

export const ROUTE_PLAN = {
  start: MEET,
  stops: ROUTE_STOPS.map(h => ({ locId: h.locId, name: h.locName, lat: h.lat, lng: h.lng })),
  version: 4, updated_at: '2026-04-25T10:58:00.000Z', updated_by_name: 'Sam', updated_by_you: false
}

const speciesAt = (h) => [...new Set(scoutRows.filter(r => r.locId === h.locId).map(r => r.code))]

/** The server's suggestion, with every place's species, so the group's own route can be scored. */
export const suggestedRoute = () => {
  const covered = new Set()
  const legs = drive([MEET, ...ROUTE_STOPS]).legs
  const stops = ROUTE_STOPS.map((h, i) => {
    const fresh = speciesAt(h).filter(c => !covered.has(c))
    fresh.forEach(c => covered.add(c))
    return { n: i + 1, locId: h.locId, locName: h.locName, lat: h.lat, lng: h.lng, new_birds: fresh.map(code => ({ code, comName: SPECIES[code][0] })), leg_min: legs[i].minutes, leg_mi: legs[i].miles, species: speciesAt(h) }
  })
  const d = drive([MEET, ...ROUTE_STOPS])
  return {
    from: { lat: MEET.lat, lng: MEET.lng }, stops, extras: [{ locId: HOT.cavecreek.locId, locName: HOT.cavecreek.locName, lat: HOT.cavecreek.lat, lng: HOT.cavecreek.lng, new_birds: [{ code: 'elfowl', comName: SPECIES.elfowl[0] }], add_min: 165, add_mi: 104, species: speciesAt(HOT.cavecreek) }],
    total_min: d.minutes, total_mi: d.miles, covered: covered.size, covered_with_extras: covered.size + 1, reported: new Set(scoutRows.map(r => r.code)).size, skipped: 2,
    geometry: d.geometry, routed: true, names: Object.fromEntries(TARGETS.map(c => [c, SPECIES[c][0]]))
  }
}

// ---------------------------------------------------------------- drives

const miles = (a, b) => {
  const R = 3958.8
  const toRad = (d) => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** A plausible drive: roads run about a third longer than the crow flies, at about 42 mph with a few minutes to park. */
/** Legs of the Big Day route the crow-flies guess gets wrong: canyon roads, and the long way round the mountains. */
const KNOWN_LEGS = {
  [`${HOT.ramsey.lat},${HOT.carr.lat}`]: { minutes: 24, miles: 8.6 },
  [`${HOT.carr.lat},${HOT.sanpedro.lat}`]: { minutes: 35, miles: 21.0 },
  [`${HOT.sanpedro.lat},${HOT.whitewater.lat}`]: { minutes: 65, miles: 48.0 },
  [`${HOT.whitewater.lat},${HOT.cavecreek.lat}`]: { minutes: 105, miles: 88.0 }
}

/** Real roads for the routes the screens show, looked up once by render.mjs (OSRM) and cached. */
const ROADS = new Map()
const roadKey = (points) => points.map(p => `${Number(p.lat).toFixed(4)},${Number(p.lng).toFixed(4)}`).join(';')
/** The routes worth real roads: the morning route in Hall County and the Big Day. */
export const ROUTES = () => [WHERE_TO_GO.route.stops, [MEET, ...ROUTE_STOPS]]
export const setRoad = (points, road) => { ROADS.set(roadKey(points), road) }

export const drive = (points) => {
  const road = ROADS.get(roadKey(points))
  if (road) return road
  const legs = points.slice(1).map((p, i) => {
    const known = KNOWN_LEGS[`${points[i].lat},${p.lat}`]
    if (known) return known
    const mi = Math.round(miles(points[i], p) * 1.33 * 10) / 10
    return { minutes: Math.round(mi / 42 * 60 + 4), miles: mi }
  })
  // A gentle bend between stops, so the line reads as a road rather than a ruler.
  const geometry = []
  points.forEach((p, i) => {
    geometry.push([p.lat, p.lng])
    const q = points[i + 1]
    if (q) geometry.push([(p.lat + q.lat) / 2 + (q.lng - p.lng) * 0.08, (p.lng + q.lng) / 2 - (q.lat - p.lat) * 0.08])
  })
  return { minutes: legs.reduce((s, l) => s + l.minutes, 0), miles: Math.round(legs.reduce((s, l) => s + l.miles, 0) * 10) / 10, geometry, legs }
}

// ---------------------------------------------------------------- the API, answered

/**
 * The answer for one /api request, or undefined to fall through to an empty one.
 * @param {URL} url
 * @param {string} method
 */
export const answer = (url, method) => {
  const p = url.pathname.replace(/^\/api/, '')
  const q = (k) => url.searchParams.get(k)
  const kind = q('kind')
  if (p === '/auth/me') return USER
  if (p === '/user' && method === 'PATCH') return USER
  if (p === '/saved') {
    if (method !== 'GET') return {}
    if (!kind) return WATCH.map((code, i) => ({ ...bird(code), id: i + 1 }))
    if (kind === 'seen') return []
    if (kind === 'places') return []
    if (kind === 'events') return [EVENT]
    if (kind === 'route') return { region: q('region'), stops: null, start: null, updatedAt: null }
    if (kind === 'event-scouting') return SCOUTING
    if (kind === 'event-route') return suggestedRoute()
    if (kind === 'event-route-plan') return ROUTE_PLAN
    if (kind === 'event-suggestions') return []
    return []
  }
  if (p === '/birds') return (q('codes') ?? '').split(',').filter(c => SPECIES[c]).map(bird)
  if (p === '/ebird/regions') return q('state') === 'AZ' ? [{ code: COCHISE, name: 'Cochise' }] : [{ code: HALL, name: 'Hall' }, { code: 'US-GA-121', name: 'Fulton' }]
  if (p === '/ebird/species-list') return q('region') === COCHISE ? NOTABLE.map(o => o.speciesCode) : SPECIES_LIST
  if (p === '/ebird/observations') return q('region') === COCHISE ? NOTABLE : HALL_RECENT
  if (p === '/ebird/notable') return q('region') === COCHISE ? NOTABLE : []
  if (p === '/ebird/species-observations') {
    const code = q('species') ?? q('code')
    return [...NOTABLE, ...HALL_RECENT].filter(o => o.speciesCode === code)
  }
  if (p === '/ebird/where-to-go') return { ...WHERE_TO_GO, route: { ...WHERE_TO_GO.route, drive: drive(WHERE_TO_GO.route.stops) } }
  if (p === '/ebird/best-hotspots') return SPECIES_HOTSPOTS
  if (p === '/ebird/drive') {
    const points = (q('points') ?? '').split(';').map(s => s.split(',').map(Number)).map(([lat, lng]) => ({ lat, lng }))
    return points.length >= 2 ? drive(points) : null
  }
  if (p === '/ebird/where') return { speciesCode: q('code'), class: 'rare', halfLifeDays: 2, bestTime: { label: 'Morning', source: 'typical' }, asOf: '2026-04-25', places: [] }
  if (p === '/ebird/chase') return null
  if (p === '/ebird/arriving') return { arrivals: [], learning: false }
  if (p === '/ebird/seasonality') return { months: [] }
  if (p === '/ebird/nearby') return { hotspots: [], parks: [] }
  if (p === '/push/public-key') return { publicKey: 'BFixtureKey' }
  if (p === '/push/pending') return { push: null }
  if (p === '/push/status') return { subscribed: true, devices: 1, lastRun: { at: '2026-04-25T11:00:00.000Z', notified: 2 } }
  if (p === '/sound') return { speciesCode: q('code'), found: false }
  return undefined
}
