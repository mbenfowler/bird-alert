import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import App from './components/App/App'
import { queryClient, persistOptions } from './queryClient'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </React.StrictMode>
)

// "Alert!" in the bar is set in Bungee Spice, a colour font, only once the browser has actually
// loaded it; until then, or if the load fails, the stylesheet keeps the orange gradient. Checking
// support alone was not enough: a browser that can draw colour fonts but did not get the file
// showed the fallback face in plain black.
if (typeof document !== 'undefined' && 'fonts' in document) {
  document.fonts.load('1em "Bungee Spice"')
    .then((faces) => { if (faces.length && document.fonts.check('1em "Bungee Spice"')) document.documentElement.classList.add('has-colour-font') })
    .catch(() => undefined)
}

// The service worker only handles push notifications; it never intercepts fetches.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Ask for a fresh worker on every launch; iOS Home Screen apps otherwise hold an old one for days.
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => registration.update().catch(() => undefined))
      .catch((error) => console.error('Service worker registration failed:', error))
  })
}
