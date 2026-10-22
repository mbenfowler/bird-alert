/**
 * Temporary diagnostics: switches on the settings page that each disable one feature of the home
 * page by adding a class to <html>, so the feature behind dropped taps on iPhone can be found in one
 * session. Remembered per browser; nothing is on by default.
 */
export interface Experiment { key: string; label: string; hint: string }

export const EXPERIMENTS: Experiment[] = [
  { key: 'nosticky', label: 'Alerts block not sticky', hint: 'The alerts panel scrolls away with the page instead of sticking under the bar.' },
  { key: 'noscroller', label: 'No horizontal scrolling in the alerts row', hint: 'The row is clipped; cards beyond the edge are not reachable.' },
  { key: 'nomask', label: 'No edge fade on the alerts row', hint: 'Removes the mask that fades cards at the edges.' },
  { key: 'noanim', label: 'No animations in the alerts panel', hint: 'Cards appear at once; no sweep, no count pop.' },
  { key: 'navtop', label: 'Nav above everything', hint: 'Gives the top bar a higher stacking order than the alerts block.' },
  { key: 'nobmc', label: 'Hide the coffee button', hint: 'Hides the Buy Me a Coffee widget.' }
]

const STORAGE_KEY = 'bird-alert-experiments'

export const readExperiments = (): Set<string> => {
  try { return new Set(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

export const applyExperiments = (keys: Set<string>) => {
  for (const { key } of EXPERIMENTS) document.documentElement.classList.toggle(`x-${key}`, keys.has(key))
}

export const writeExperiments = (keys: Set<string>) => {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys])) } catch { /* private mode */ }
  applyExperiments(keys)
}
