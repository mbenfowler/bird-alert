import { useSessionQuery } from './hooks/queries'
import { countryOf } from './usStates'

/** Canadians read distances in kilometres; everyone else, and anyone signed out, in miles. */
export type DistanceUnit = 'mi' | 'km'

export const unitFor = (state?: string | null): DistanceUnit => (state && countryOf(state) === 'CA' ? 'km' : 'mi')

/** The viewer's unit, from their state or province. */
export const useDistanceUnit = () => unitFor(useSessionQuery().data?.state)

const KM_PER_MILE = 1.609344

/** A distance the server measured in miles, in the viewer's unit, to a tenth. */
const inUnit = (miles: number, unit: DistanceUnit) => (unit === 'km' ? Math.round(miles * KM_PER_MILE * 10) / 10 : miles)

/** "4.8 mi" or "7.7 km". */
export const shortDistance = (miles: number, unit: DistanceUnit) => `${inUnit(miles, unit)} ${unit}`

/** "4.8 miles" or "7.7 kilometres". */
export const longDistance = (miles: number, unit: DistanceUnit) => `${inUnit(miles, unit)} ${unit === 'km' ? 'kilometres' : 'miles'}`

/** "miles" or "kilometres", for prose like "within a few miles". */
export const unitWord = (unit: DistanceUnit) => (unit === 'km' ? 'kilometres' : 'miles')
