import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { onlineManager } from '@tanstack/react-query'
import App from './components/App/App'
import { queryClient, persistOptions } from './queryClient'
import { Analytics } from '@vercel/analytics/react'
import { redactPageView } from './analytics'
import { noteArrival } from './arrival'
import { resumeTallyChanges, setupTallySync } from './tallySync'
import { forgetPages } from './pageMemory'

// Where this visitor came from, noted once, sent only if they sign up.
noteArrival()
// A reload or relaunch starts every page fresh; what pages kept is for Back within this visit.
forgetPages()

// TanStack starts out assuming a network. Opened from the Home Screen with no signal, it starts
// offline instead, so the saved data shows as saved and tally changes wait rather than fail;
// the browser's online and offline events take it from there.
if (typeof navigator !== 'undefined' && navigator.onLine === false) onlineManager.setOnline(false)

// How a tally change is sent, known before the saved cache comes back, so one saved offline can be sent after a reload.
setupTallySync(queryClient)
// Once the saved cache is back: tally changes that were waiting go out (or wait for signal), and
// everything else is checked against the server.
// Not awaited: the provider waits on onSuccess before showing the app, and a change waiting for
// signal doesn't settle until it's sent.
// The saved account is shown at once, and checked with the server on every launch (it waits for
// signal if there's none), as it was before it was saved.
const restored = () => {
  void resumeTallyChanges(queryClient)
  void queryClient.resumePausedMutations()
  void queryClient.invalidateQueries({ queryKey: ['session'] })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions} onSuccess={restored}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {/* Page views (Vercel Web Analytics: no cookies, nothing personal); quiet outside production. */}
      <Analytics beforeSend={redactPageView} />
    </PersistQueryClientProvider>
  </React.StrictMode>
)

// "Alert!" in the bar is set in Bungee Spice, a colour font, only once the browser has loaded it
// AND really draws it in colour; until then, or otherwise, the stylesheet keeps the orange gradient.
// Neither support nor a load is proof: a browser that can draw colour fonts but did not get the file,
// and a Chrome that loaded the file and still drew its glyphs black, both showed "Alert!" in black.
const drawsInColour = () => {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 48
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.fillStyle = '#000'
    ctx.font = '40px "Bungee Spice"'
    ctx.fillText('A', 4, 40)
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    // Asked for black: any strongly orange pixel means the font's own colours were used.
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200 && px[i] > 150 && px[i] - px[i + 2] > 80) return true
    return false
  } catch {
    return false
  }
}
if (typeof document !== 'undefined' && 'fonts' in document) {
  document.fonts.load('1em "Bungee Spice"')
    .then((faces) => { if (faces.length && document.fonts.check('1em "Bungee Spice"') && drawsInColour()) document.documentElement.classList.add('has-colour-font') })
    .catch(() => undefined)
}

// The service worker shows push notifications and, in the production build, keeps the app's own
// files for offline use (never the API; data offline comes from the saved query cache). A new
// worker takes over in the background; the open page is never reloaded for it, and the new build
// shows on the next launch.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Ask for a fresh worker on every launch; iOS Home Screen apps otherwise hold an old one for days.
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => registration.update().catch(() => undefined))
      .catch((error) => console.error('Service worker registration failed:', error))
  })
}
