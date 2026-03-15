import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function restoreGitHubPagesRedirect() {
  if (typeof window === 'undefined') {
    return
  }

  const { location } = window
  if (!location.search || location.search.length < 2 || location.search[1] !== '/') {
    return
  }

  const decoded = location.search
    .slice(1)
    .split('&')
    .map((segment) => segment.replace(/~and~/g, '&'))
    .join('?')
  const normalizedPath = `${location.pathname.replace(/\/$/, '')}${decoded}${location.hash}`

  window.history.replaceState(null, '', normalizedPath)
}

function setupServiceWorker() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return
  }

  if (!('serviceWorker' in navigator)) {
    return
  }

  if (!import.meta.env.PROD) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch(() => undefined)

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => undefined)
    }

    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker registration failed:', error)
    })
  })
}

restoreGitHubPagesRedirect()
setupServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
