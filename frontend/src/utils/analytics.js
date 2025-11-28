let sessionId
const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT

function getSessionId() {
  if (sessionId) return sessionId
  const stored = localStorage.getItem('kst_session')
  if (stored) {
    sessionId = stored
    return sessionId
  }
  const generated = crypto.randomUUID()
  localStorage.setItem('kst_session', generated)
  sessionId = generated
  return sessionId
}

export function initAnalytics() {
  const id = getSessionId()
  if (import.meta.env.DEV) {
    console.debug('[analytics] session', id)
  }
  track('app_initialized', { path: window.location.pathname })
}

export function track(event, properties = {}) {
  const payload = {
    event,
    properties,
    sessionId: getSessionId(),
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
    userAgent: navigator.userAgent,
  }

  if (import.meta.env.DEV || !endpoint) {
    console.debug('[analytics]', payload)
    return
  }

  try {
    const body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body)
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      })
    }
  } catch (err) {
    console.warn('[analytics] track failed', err)
  }
}
