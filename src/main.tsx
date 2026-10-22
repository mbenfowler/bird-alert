import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import App from './components/App/App'
import { applyExperiments, readExperiments } from './experiments'
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

applyExperiments(readExperiments())

// The service worker only handles push notifications; it never intercepts fetches.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Ask for a fresh worker on every launch; iOS Home Screen apps otherwise hold an old one for days.
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => registration.update().catch(() => undefined))
      .catch((error) => console.error('Service worker registration failed:', error))
  })
}
