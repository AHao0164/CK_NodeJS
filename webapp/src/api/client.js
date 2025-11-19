import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export function createApiClient(getToken) {
  const api = axios.create({ baseURL: API_BASE })
  api.interceptors.request.use((config) => {
    const token = getToken?.()
    if (token) config.headers.Authorization = `Bearer ${token}`
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


