/** iPhone and iPad Safari, where notifications only work once the app is on the Home Screen. */
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
/** Opened from the Home Screen rather than in a browser tab. */
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
