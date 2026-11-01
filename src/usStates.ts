/** US states and DC, as eBird codes them (US-XX). */
export const US_STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'],
  ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'],
  ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming']
]

/** Canada's provinces and territories, as eBird codes them (CA-XX). No code is also a US state's. */
export const CA_PROVINCES: [string, string][] = [
  ['AB', 'Alberta'], ['BC', 'British Columbia'], ['MB', 'Manitoba'], ['NB', 'New Brunswick'], ['NL', 'Newfoundland and Labrador'],
  ['NS', 'Nova Scotia'], ['NT', 'Northwest Territories'], ['NU', 'Nunavut'], ['ON', 'Ontario'], ['PE', 'Prince Edward Island'],
  ['QC', 'Quebec'], ['SK', 'Saskatchewan'], ['YT', 'Yukon']
]

/** Mexico's states, as eBird codes them (MX-XXX, three letters, so never a US or Canadian code). Mexico City is DIF. */
export const MX_STATES: [string, string][] = [
  ['AGU', 'Aguascalientes'], ['BCN', 'Baja California'], ['BCS', 'Baja California Sur'], ['CAM', 'Campeche'], ['CHP', 'Chiapas'],
  ['CHH', 'Chihuahua'], ['COA', 'Coahuila'], ['COL', 'Colima'], ['DUR', 'Durango'], ['GUA', 'Guanajuato'], ['GRO', 'Guerrero'],
  ['HID', 'Hidalgo'], ['JAL', 'Jalisco'], ['DIF', 'Mexico City'], ['MIC', 'Michoacán'], ['MOR', 'Morelos'], ['NAY', 'Nayarit'],
  ['NLE', 'Nuevo León'], ['OAX', 'Oaxaca'], ['PUE', 'Puebla'], ['QUE', 'Querétaro'], ['ROO', 'Quintana Roo'], ['SLP', 'San Luis Potosí'],
  ['SIN', 'Sinaloa'], ['SON', 'Sonora'], ['MEX', 'State of Mexico'], ['TAB', 'Tabasco'], ['TAM', 'Tamaulipas'], ['TLA', 'Tlaxcala'],
  ['VER', 'Veracruz'], ['YUC', 'Yucatán'], ['ZAC', 'Zacatecas']
]

/**
 * South Africa's provinces, as eBird codes them (KwaZulu-Natal is NL). Their letters clash with US and
 * Canadian ones (NL is also Newfoundland and Labrador, NC North Carolina), so they keep the country:
 * 'ZA-WC' is what the app stores and sends.
 */
export const ZA_PROVINCES: [string, string][] = [
  ['ZA-EC', 'Eastern Cape'], ['ZA-FS', 'Free State'], ['ZA-GT', 'Gauteng'], ['ZA-NL', 'KwaZulu-Natal'], ['ZA-LP', 'Limpopo'],
  ['ZA-MP', 'Mpumalanga'], ['ZA-NW', 'North West'], ['ZA-NC', 'Northern Cape'], ['ZA-WC', 'Western Cape']
]

const PROVINCE_CODES = new Set(CA_PROVINCES.map(([code]) => code))
const MX_CODES = new Set(MX_STATES.map(([code]) => code))
const ZA_CODES = new Set(ZA_PROVINCES.map(([code]) => code))

export type Country = 'US' | 'CA' | 'MX' | 'ZA'

/** 'CA' for a Canadian province or territory, 'MX' for a Mexican state, 'ZA' for a South African province, else 'US'. */
export const countryOf = (state: string): Country =>
  (ZA_CODES.has(state) ? 'ZA' : PROVINCE_CODES.has(state) ? 'CA' : MX_CODES.has(state) ? 'MX' : 'US')

/** eBird's code for a state or province: 'GA' -> 'US-GA', 'ON' -> 'CA-ON', 'JAL' -> 'MX-JAL'; 'ZA-WC' already is one. */
export const subnational1 = (state: string) => (ZA_CODES.has(state) ? state : `${countryOf(state)}-${state}`)

/** "Georgia", "Ontario", "Jalisco" or "Western Cape". */
export const stateName = (state: string) => ({ US: US_STATES, CA: CA_PROVINCES, MX: MX_STATES, ZA: ZA_PROVINCES })[countryOf(state)].find(([code]) => code === state)?.[1]

/** The state or province within any eBird region code, state or county level: 'US-GA-139' -> 'GA', 'ZA-WC' -> 'ZA-WC'. */
export const stateOfCode = (region: string) => {
  const [country, state] = region.split('-')
  if (!state) return ''
  return country === 'ZA' ? `ZA-${state}` : state
}

const COUNTY_REGION = /^(?:US-([A-Z]{2})-\d{3}|CA-([A-Z]{2})-[A-Z0-9]{1,5}|MX-([A-Z]{3})-\d{3}|ZA-([A-Z]{2})-\d{2})$/

/** The state or province of a county-level region ('US-GA-139' -> 'GA', 'CA-ON-TO' -> 'ON', 'MX-JAL-039' -> 'JAL', 'ZA-WC-21' -> 'ZA-WC'), or null. */
export const stateOfRegion = (region: string): string | null => {
  const m = COUNTY_REGION.exec(region)
  if (!m) return null
  if (m[2]) return PROVINCE_CODES.has(m[2]) ? m[2] : null
  if (m[3]) return MX_CODES.has(m[3]) ? m[3] : null
  if (m[4]) return ZA_CODES.has(`ZA-${m[4]}`) ? `ZA-${m[4]}` : null
  return m[1]!
}

/**
 * What the app calls a county-level region: a county in the US; in Canada eBird's are census
 * divisions ("Toronto", "Algoma"), which nobody calls counties, so there it's an area; in Mexico
 * they are municipalities ("Zapopan"; in Mexico City, its boroughs), and in South Africa local
 * municipalities ("City of Cape Town", "Stellenbosch").
 */
export const countyWord = (state: string) => ({ US: 'county', CA: 'area', MX: 'municipality', ZA: 'municipality' } as const)[countryOf(state)]

/** The same word for a label: "County", "Area" or "Municipality". */
export const countyLabel = (state: string) => { const w = countyWord(state); return w[0]!.toUpperCase() + w.slice(1) }

/** "Hall County" in the US; "Toronto" or "Zapopan" elsewhere, where the name stands alone. */
export const countyName = (name: string, state: string) => (countryOf(state) === 'US' ? `${name} County` : name)
