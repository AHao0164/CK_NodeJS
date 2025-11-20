import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

// Generate or retrieve session ID for guest users
function getOrCreateSessionId() {
  let sessionId = localStorage.getItem('sessionId')
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('sessionId', sessionId)
  }
  return sessionId
}

export function createApiClient(getToken) {
  const api = axios.create({ baseURL: API_BASE })
  api.interceptors.request.use((config) => {
    const token = getToken?.()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else {
      // For guest users, send session ID
      config.headers['X-Session-Id'] = getOrCreateSessionId()
    }
    return config
  })
  return api
}

// Public, unauthenticated API client for open endpoints
export const publicApi = axios.create({ baseURL: API_BASE })

// Resolve a possibly relative image path returned by the API to an absolute URL
export function resolveImageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${API_BASE}${url}`
}


