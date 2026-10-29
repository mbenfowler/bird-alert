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

const PROVINCE_CODES = new Set(CA_PROVINCES.map(([code]) => code))

/** 'CA' for a Canadian province or territory, else 'US'. */
export const countryOf = (state: string): 'US' | 'CA' => (PROVINCE_CODES.has(state) ? 'CA' : 'US')

/** eBird's code for a state or province: 'GA' -> 'US-GA', 'ON' -> 'CA-ON'. */
export const subnational1 = (state: string) => `${countryOf(state)}-${state}`

/** "Georgia" or "Ontario". */
export const stateName = (state: string) => (countryOf(state) === 'CA' ? CA_PROVINCES : US_STATES).find(([code]) => code === state)?.[1]

const COUNTY_REGION = /^(?:US-([A-Z]{2})-\d{3}|CA-([A-Z]{2})-[A-Z0-9]{1,5})$/

/** The state or province of a county-level region ('US-GA-139' -> 'GA', 'CA-ON-TO' -> 'ON'), or null. */
export const stateOfRegion = (region: string): string | null => {
  const m = COUNTY_REGION.exec(region)
  if (!m) return null
  if (m[2]) return PROVINCE_CODES.has(m[2]) ? m[2] : null
  return m[1]!
}

/**
 * What the app calls a county-level region: a county in the US; in Canada eBird's are census
 * divisions ("Toronto", "Algoma"), which nobody calls counties, so there it's an area.
 */
export const countyWord = (state: string) => (countryOf(state) === 'CA' ? 'area' : 'county')

/** "Hall County" in the US; "Toronto" in Canada, where the name stands alone. */
export const countyName = (name: string, state: string) => (countryOf(state) === 'CA' ? name : `${name} County`)
