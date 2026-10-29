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

const PROVINCE_CODES = new Set(CA_PROVINCES.map(([code]) => code))
const MX_CODES = new Set(MX_STATES.map(([code]) => code))

export type Country = 'US' | 'CA' | 'MX'

/** 'CA' for a Canadian province or territory, 'MX' for a Mexican state, else 'US'. */
export const countryOf = (state: string): Country => (PROVINCE_CODES.has(state) ? 'CA' : MX_CODES.has(state) ? 'MX' : 'US')

/** eBird's code for a state or province: 'GA' -> 'US-GA', 'ON' -> 'CA-ON', 'JAL' -> 'MX-JAL'. */
export const subnational1 = (state: string) => `${countryOf(state)}-${state}`

/** "Georgia", "Ontario" or "Jalisco". */
export const stateName = (state: string) => ({ US: US_STATES, CA: CA_PROVINCES, MX: MX_STATES })[countryOf(state)].find(([code]) => code === state)?.[1]

const COUNTY_REGION = /^(?:US-([A-Z]{2})-\d{3}|CA-([A-Z]{2})-[A-Z0-9]{1,5}|MX-([A-Z]{3})-\d{3})$/

/** The state or province of a county-level region ('US-GA-139' -> 'GA', 'CA-ON-TO' -> 'ON', 'MX-JAL-039' -> 'JAL'), or null. */
export const stateOfRegion = (region: string): string | null => {
  const m = COUNTY_REGION.exec(region)
  if (!m) return null
  if (m[2]) return PROVINCE_CODES.has(m[2]) ? m[2] : null
  if (m[3]) return MX_CODES.has(m[3]) ? m[3] : null
  return m[1]!
}

/**
 * What the app calls a county-level region: a county in the US; in Canada eBird's are census
 * divisions ("Toronto", "Algoma"), which nobody calls counties, so there it's an area; in Mexico
 * they are municipalities ("Zapopan"; in Mexico City, its boroughs).
 */
export const countyWord = (state: string) => ({ US: 'county', CA: 'area', MX: 'municipality' } as const)[countryOf(state)]

/** The same word for a label: "County", "Area" or "Municipality". */
export const countyLabel = (state: string) => { const w = countyWord(state); return w[0]!.toUpperCase() + w.slice(1) }

/** "Hall County" in the US; "Toronto" or "Zapopan" elsewhere, where the name stands alone. */
export const countyName = (name: string, state: string) => (countryOf(state) === 'US' ? `${name} County` : name)
