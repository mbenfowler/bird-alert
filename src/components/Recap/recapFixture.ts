import type { Recap, RecapTimelineRow } from '../../types'

/**
 * A Big Day recap as the server sends it (the contract's payload), for the unit tests and the
 * end-to-end spec: the approved design's day in Cochise County, 92 species from 5:41 AM to 6:52 PM.
 */
const TIMELINE: RecapTimelineRow[] = [
  { n: 1, speciesCode: 'grhowl', comName: 'Great Horned Owl', at: '2026-11-10T12:41:00Z', stopIndex: null, place: 'Sierra Vista, before dawn', lifer: false, liferFor: null },
  { n: 2, speciesCode: 'comrav', comName: 'Common Raven', at: '2026-11-10T13:00:00Z', stopIndex: null, place: 'Sierra Vista, before dawn', lifer: false, liferFor: null },
  { n: 3, speciesCode: 'normoc', comName: 'Northern Mockingbird', at: '2026-11-10T13:20:00Z', stopIndex: null, place: 'Sierra Vista, before dawn', lifer: false, liferFor: null },
  { n: 4, speciesCode: 'mexjay', comName: 'Mexican Jay', at: '2026-11-10T13:22:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 5, speciesCode: 'acowoo', comName: 'Acorn Woodpecker', at: '2026-11-10T13:25:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 6, speciesCode: 'norcar', comName: 'Northern Cardinal', at: '2026-11-10T13:27:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 7, speciesCode: 'spotow', comName: 'Spotted Towhee', at: '2026-11-10T13:30:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 8, speciesCode: 'cantow', comName: 'Canyon Towhee', at: '2026-11-10T13:33:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 9, speciesCode: 'darjun', comName: 'Dark-eyed Junco', at: '2026-11-10T13:35:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 10, speciesCode: 'yeljun', comName: 'Yellow-eyed Junco', at: '2026-11-10T13:38:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 11, speciesCode: 'rubkin', comName: 'Ruby-crowned Kinglet', at: '2026-11-10T13:40:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 12, speciesCode: 'bushti', comName: 'Bushtit', at: '2026-11-10T13:42:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 13, speciesCode: 'whinut', comName: 'White-breasted Nuthatch', at: '2026-11-10T13:45:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 14, speciesCode: 'herthr', comName: 'Hermit Thrush', at: '2026-11-10T13:48:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 15, speciesCode: 'wesblu', comName: 'Western Bluebird', at: '2026-11-10T13:50:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 16, speciesCode: 'lesgol', comName: 'Lesser Goldfinch', at: '2026-11-10T13:52:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 17, speciesCode: 'houfin', comName: 'House Finch', at: '2026-11-10T13:55:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 18, speciesCode: 'pinsis', comName: 'Pine Siskin', at: '2026-11-10T13:57:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 19, speciesCode: 'towwar', comName: "Townsend's Warbler", at: '2026-11-10T14:00:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 20, speciesCode: 'yelwar', comName: 'Yellow-rumped Warbler', at: '2026-11-10T14:03:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 21, speciesCode: 'hutvir', comName: "Hutton's Vireo", at: '2026-11-10T14:07:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 22, speciesCode: 'arizwoo', comName: 'Arizona Woodpecker', at: '2026-11-10T14:12:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: true, liferFor: ['Kirin'] },
  { n: 23, speciesCode: 'bewwre', comName: "Bewick's Wren", at: '2026-11-10T14:13:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 24, speciesCode: 'canwre', comName: 'Canyon Wren', at: '2026-11-10T14:17:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 25, speciesCode: 'paired', comName: 'Painted Redstart', at: '2026-11-10T14:20:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 26, speciesCode: 'stejay', comName: "Steller's Jay", at: '2026-11-10T14:23:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 27, speciesCode: 'britit', comName: 'Bridled Titmouse', at: '2026-11-10T14:31:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: true, liferFor: ['Kirin'] },
  { n: 28, speciesCode: 'coohaw', comName: "Cooper's Hawk", at: '2026-11-10T14:33:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 29, speciesCode: 'redhaw', comName: 'Red-tailed Hawk', at: '2026-11-10T14:36:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 30, speciesCode: 'wiltur', comName: 'Wild Turkey', at: '2026-11-10T14:42:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 31, speciesCode: 'rufspa', comName: 'Rufous-crowned Sparrow', at: '2026-11-10T14:48:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 32, speciesCode: 'goleag', comName: 'Golden Eagle', at: '2026-11-10T14:54:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 33, speciesCode: 'redsap', comName: 'Red-naped Sapsucker', at: '2026-11-10T15:00:00Z', stopIndex: 0, place: 'Ramsey Canyon', lifer: false, liferFor: null },
  { n: 34, speciesCode: 'ladwoo', comName: 'Ladder-backed Woodpecker', at: '2026-11-10T15:30:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 35, speciesCode: 'gilwoo', comName: 'Gila Woodpecker', at: '2026-11-10T15:35:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 36, speciesCode: 'verfly', comName: 'Vermilion Flycatcher', at: '2026-11-10T15:40:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 37, speciesCode: 'rubrob', comName: 'Rufous-backed Robin', at: '2026-11-10T15:47:00Z', stopIndex: 1, place: 'San Pedro House', lifer: true, liferFor: ['Kirin', 'Matt'] },
  { n: 38, speciesCode: 'blapho', comName: 'Black Phoebe', at: '2026-11-10T15:50:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 39, speciesCode: 'saypho', comName: "Say's Phoebe", at: '2026-11-10T15:55:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 40, speciesCode: 'abetow', comName: "Abert's Towhee", at: '2026-11-10T16:00:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 41, speciesCode: 'sonspa', comName: 'Song Sparrow', at: '2026-11-10T16:08:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 42, speciesCode: 'linspa', comName: "Lincoln's Sparrow", at: '2026-11-10T16:15:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 43, speciesCode: 'gretow', comName: 'Green-tailed Towhee', at: '2026-11-10T16:22:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 44, speciesCode: 'pyrrhu', comName: 'Pyrrhuloxia', at: '2026-11-10T16:30:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 45, speciesCode: 'norhar', comName: 'Northern Harrier', at: '2026-11-10T16:45:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 46, speciesCode: 'brespa', comName: "Brewer's Sparrow", at: '2026-11-10T17:00:00Z', stopIndex: 1, place: 'San Pedro House', lifer: false, liferFor: null },
  { n: 47, speciesCode: 'sancra', comName: 'Sandhill Crane', at: '2026-11-10T17:45:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 48, speciesCode: 'snogoo', comName: 'Snow Goose', at: '2026-11-10T17:49:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 49, speciesCode: 'rosgoo', comName: "Ross's Goose", at: '2026-11-10T17:52:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 50, speciesCode: 'norpin', comName: 'Northern Pintail', at: '2026-11-10T17:56:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 51, speciesCode: 'gretea', comName: 'Green-winged Teal', at: '2026-11-10T18:00:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 52, speciesCode: 'cintea', comName: 'Cinnamon Teal', at: '2026-11-10T18:04:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 53, speciesCode: 'norsho', comName: 'Northern Shoveler', at: '2026-11-10T18:08:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 54, speciesCode: 'amewig', comName: 'American Wigeon', at: '2026-11-10T18:11:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 55, speciesCode: 'mallar', comName: 'Mallard', at: '2026-11-10T18:15:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 56, speciesCode: 'killde', comName: 'Killdeer', at: '2026-11-10T18:20:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 57, speciesCode: 'wilsni', comName: "Wilson's Snipe", at: '2026-11-10T18:25:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 58, speciesCode: 'leasan', comName: 'Least Sandpiper', at: '2026-11-10T18:30:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 59, speciesCode: 'londow', comName: 'Long-billed Dowitcher', at: '2026-11-10T18:35:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 60, speciesCode: 'greher', comName: 'Great Blue Heron', at: '2026-11-10T18:40:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 61, speciesCode: 'barowl', comName: 'Barn Owl', at: '2026-11-10T18:45:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 62, speciesCode: 'yelbla', comName: 'Yellow-headed Blackbird', at: '2026-11-10T18:55:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 63, speciesCode: 'redbla', comName: 'Red-winged Blackbird', at: '2026-11-10T19:05:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 64, speciesCode: 'savspa', comName: 'Savannah Sparrow', at: '2026-11-10T19:15:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 65, speciesCode: 'vesspa', comName: 'Vesper Sparrow', at: '2026-11-10T19:30:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 66, speciesCode: 'ferhaw', comName: 'Ferruginous Hawk', at: '2026-11-10T19:45:00Z', stopIndex: 2, place: 'Whitewater Draw', lifer: false, liferFor: null },
  { n: 67, speciesCode: 'sprpip', comName: "Sprague's Pipit", at: '2026-11-10T19:58:00Z', stopIndex: null, place: 'Sulphur Springs Valley, on the way', lifer: true, liferFor: ['Kirin', 'Matt'] },
  { n: 68, speciesCode: 'chelon', comName: 'Chestnut-collared Longspur', at: '2026-11-10T20:03:00Z', stopIndex: null, place: 'Sulphur Springs Valley, on the way', lifer: false, liferFor: null },
  { n: 69, speciesCode: 'larbun', comName: 'Lark Bunting', at: '2026-11-10T20:12:00Z', stopIndex: null, place: 'Sulphur Springs Valley, on the way', lifer: false, liferFor: null },
  { n: 70, speciesCode: 'horlar', comName: 'Horned Lark', at: '2026-11-10T20:21:00Z', stopIndex: null, place: 'Sulphur Springs Valley, on the way', lifer: false, liferFor: null },
  { n: 71, speciesCode: 'prafal', comName: 'Prairie Falcon', at: '2026-11-10T20:28:00Z', stopIndex: null, place: 'Sulphur Springs Valley, on the way', lifer: false, liferFor: null },
  { n: 72, speciesCode: 'ameavo', comName: 'American Avocet', at: '2026-11-10T20:36:00Z', stopIndex: 3, place: 'Willcox Twin Lakes', lifer: false, liferFor: null },
  { n: 73, speciesCode: 'eargre', comName: 'Eared Grebe', at: '2026-11-10T20:42:00Z', stopIndex: 3, place: 'Willcox Twin Lakes', lifer: false, liferFor: null },
  { n: 74, speciesCode: 'rudduc', comName: 'Ruddy Duck', at: '2026-11-10T20:48:00Z', stopIndex: 3, place: 'Willcox Twin Lakes', lifer: false, liferFor: null },
  { n: 75, speciesCode: 'lewwoo', comName: "Lewis's Woodpecker", at: '2026-11-10T20:52:00Z', stopIndex: 3, place: 'Willcox Twin Lakes', lifer: false, liferFor: null },
  { n: 76, speciesCode: 'buffle', comName: 'Bufflehead', at: '2026-11-10T21:00:00Z', stopIndex: 3, place: 'Willcox Twin Lakes', lifer: false, liferFor: null },
  { n: 77, speciesCode: 'amecoo', comName: 'American Coot', at: '2026-11-10T21:15:00Z', stopIndex: 3, place: 'Willcox Twin Lakes', lifer: false, liferFor: null },
  { n: 78, speciesCode: 'chirav', comName: 'Chihuahuan Raven', at: '2026-11-10T21:30:00Z', stopIndex: 3, place: 'Willcox Twin Lakes', lifer: false, liferFor: null },
  { n: 79, speciesCode: 'scaqua', comName: 'Scaled Quail', at: '2026-11-10T21:45:00Z', stopIndex: 3, place: 'Willcox Twin Lakes', lifer: false, liferFor: null },
  { n: 80, speciesCode: 'curthr', comName: 'Curve-billed Thrasher', at: '2026-11-10T22:45:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 81, speciesCode: 'blaspa', comName: 'Black-throated Sparrow', at: '2026-11-10T22:52:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 82, speciesCode: 'cacwre', comName: 'Cactus Wren', at: '2026-11-10T23:00:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 83, speciesCode: 'verdin', comName: 'Verdin', at: '2026-11-10T23:08:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 84, speciesCode: 'phaino', comName: 'Phainopepla', at: '2026-11-10T23:15:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 85, speciesCode: 'incdov', comName: 'Inca Dove', at: '2026-11-10T23:25:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 86, speciesCode: 'juntit', comName: 'Juniper Titmouse', at: '2026-11-10T23:35:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 87, speciesCode: 'greroa', comName: 'Greater Roadrunner', at: '2026-11-10T23:45:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 88, speciesCode: 'benthr', comName: "Bendire's Thrasher", at: '2026-11-11T00:08:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 89, speciesCode: 'blugem', comName: 'Blue-throated Mountain-gem', at: '2026-11-11T00:30:00Z', stopIndex: 4, place: 'Cave Creek Canyon', lifer: false, liferFor: null },
  { n: 90, speciesCode: 'wesowl', comName: 'Western Screech-Owl', at: '2026-11-11T01:15:00Z', stopIndex: 5, place: 'Portal, after dark', lifer: false, liferFor: null },
  { n: 91, speciesCode: 'compoo', comName: 'Common Poorwill', at: '2026-11-11T01:36:00Z', stopIndex: 5, place: 'Portal, after dark', lifer: false, liferFor: null },
  { n: 92, speciesCode: 'whsowl1', comName: 'Whiskered Screech-Owl', at: '2026-11-11T01:52:00Z', stopIndex: 5, place: 'Portal, after dark', lifer: true, liferFor: ['Kirin'] }
]

const STOPS: Recap['stops'] = [
  { index: 0, name: 'Ramsey Canyon', lat: 31.4459, lng: -110.3076, arrive: '2026-11-10T13:20:00Z', stayMin: 100, species: 33, added: 33 },
  { index: 1, name: 'San Pedro House', lat: 31.5462, lng: -110.1428, arrive: '2026-11-10T15:30:00Z', stayMin: 90, species: 13, added: 13 },
  { index: 2, name: 'Whitewater Draw', lat: 31.3373, lng: -109.7169, arrive: '2026-11-10T17:45:00Z', stayMin: 120, species: 20, added: 20 },
  { index: 3, name: 'Willcox Twin Lakes', lat: 32.2337, lng: -109.8457, arrive: '2026-11-10T20:30:00Z', stayMin: 75, species: 13, added: 13 },
  { index: 4, name: 'Cave Creek Canyon', lat: 31.8813, lng: -109.1808, arrive: '2026-11-10T22:45:00Z', stayMin: 105, species: 10, added: 10 },
  { index: 5, name: 'Portal, after dark', lat: 31.9137, lng: -109.1412, arrive: '2026-11-11T01:15:00Z', stayMin: 45, species: 3, added: 3 }
]

const lifer = (code: string, who: string, number: number) => {
  const row = TIMELINE.find(r => r.speciesCode === code)!
  return { speciesCode: code, comName: row.comName, at: row.at, place: row.place, who, number }
}

export const membersRecap = (over: Partial<Recap> = {}): Recap => ({
  audience: 'members',
  status: 'open',
  fixesUntil: '2026-11-13T10:00:00Z',
  shareCode: '2-k3x9qa',
  event: { id: 2, name: 'Big Day 2027', kind: 'big_day', area: 'Cochise County, AZ', startsOn: '2026-11-10', endsOn: '2026-11-10', timezone: 'America/Phoenix', lat: 31.5, lng: -110.0 },
  members: [{ id: 1, name: 'Matt', organizer: true }, { id: 2, name: 'Kirin', organizer: false }],
  totals: {
    species: 92, stops: 6, miles: 186, fieldMinutes: 860,
    firstBird: { speciesCode: 'grhowl', comName: 'Great Horned Owl', at: '2026-11-10T12:41:00Z' },
    lastBird: { speciesCode: 'whsowl1', comName: 'Whiskered Screech-Owl', at: '2026-11-11T01:52:00Z' },
    bestStop: { index: 2, name: 'Whitewater Draw', species: 20 },
    bestHour: { start: '07:00', added: 14 }
  },
  timeline: TIMELINE,
  lifers: [
    lifer('arizwoo', 'Kirin', 208), lifer('britit', 'Kirin', 209), lifer('rubrob', 'Kirin', 210), lifer('rubrob', 'Matt', 431),
    lifer('sprpip', 'Kirin', 211), lifer('sprpip', 'Matt', 432), lifer('whsowl1', 'Kirin', 212)
  ],
  highlights: {
    rarest: { speciesCode: 'rubrob', comName: 'Rufous-backed Robin', aba: 3, at: '2026-11-10T15:47:00Z', place: 'San Pedro House' },
    scoutingCalled: { speciesCode: 'lewwoo', comName: "Lewis's Woodpecker", emailedOn: '2026-11-09', at: '2026-11-10T20:52:00Z', place: 'Willcox Twin Lakes' }
  },
  targets: { total: 20, found: 14, missed: ['Montezuma Quail', "Baird's Sparrow", 'Elegant Trogon', 'Short-eared Owl', 'Crissal Thrasher', 'Rufous-winged Sparrow'] },
  stops: STOPS,
  route: { miles: 186, line: STOPS.map(s => [s.lat, s.lng] as [number, number]) },
  byMember: [
    { name: 'Matt', count: 84, only: ['Prairie Falcon', "Lewis's Woodpecker", 'Chestnut-collared Longspur', 'Lark Bunting', 'Horned Lark', 'Eared Grebe', 'Ruddy Duck', 'Bufflehead', 'American Coot', 'Scaled Quail', 'Verdin', 'Inca Dove', 'Juniper Titmouse'] },
    { name: 'Kirin', count: 79, only: ['Golden Eagle', 'Rock Wren', 'Canyon Wren', 'Wild Turkey', 'Steller\'s Jay', 'Hutton\'s Vireo', 'Pine Siskin', 'Bushtit'] }
  ],
  together: 71,
  candidates: [
    { speciesCode: 'monqua', comName: 'Montezuma Quail' }, { speciesCode: 'baispa', comName: "Baird's Sparrow" }, { speciesCode: 'eletro', comName: 'Elegant Trogon' },
    { speciesCode: 'sheowl', comName: 'Short-eared Owl' }, { speciesCode: 'critrh', comName: 'Crissal Thrasher' }, { speciesCode: 'ruwspa', comName: 'Rufous-winged Sparrow' },
    { speciesCode: 'rocwre', comName: 'Rock Wren' }, { speciesCode: 'mexchi', comName: 'Mexican Chickadee' }
  ],
  ...over
})

/** The same day by its share link: no names, and the personal spots (Sierra Vista, the valley pull-off) gone. */
export const publicRecap = (): Recap => {
  const members = membersRecap()
  const publicPlaces = new Set(STOPS.map(s => s.name))
  const place = (p: string | null) => (p && publicPlaces.has(p) ? p : null)
  return {
    ...members,
    audience: 'public',
    shareCode: undefined,
    members: undefined,
    byMember: undefined,
    together: undefined,
    candidates: undefined,
    timeline: members.timeline.map(row => ({ ...row, place: place(row.place), liferFor: null })),
    lifers: members.lifers.map(l => ({ ...l, place: place(l.place), who: null }))
  }
}
