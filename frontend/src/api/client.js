import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

// User-friendly error messages
export function getErrorMessage(error) {
  // Backend error with message
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  
  // Service unavailable
  if (error.response?.status === 503) {
    const serviceName = error.response.data?.serviceName || 'Hệ thống'
    return `Dịch vụ ${serviceName} tạm thời không khả dụng. Vui lòng thử lại sau.`
  }
  
  // Gateway timeout
  if (error.response?.status === 504) {
    return 'Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.'
  }
  
  // Bad gateway
  if (error.response?.status === 502) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.'
  }
  
  // Network error
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return 'Lỗi kết nối mạng. Vui lòng kiểm tra internet của bạn.'
  }
  
  // Timeout
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return 'Yêu cầu hết thời gian chờ. Vui lòng thử lại.'
  }
  
  // Generic backend error
  if (error.response?.data?.error) {
    return `Lỗi: ${error.response.data.error}`
  }
  
  // Default message
  return 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
}

export function createApiClient(getToken) {
  const api = axios.create({ 
    baseURL: API_BASE,
    timeout: 30000, // 30 seconds timeout
  })
  
  api.interceptors.request.use((config) => {
    const token = getToken?.()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  
  // Add response interceptor for better error handling
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      // Attach user-friendly message
      error.userMessage = getErrorMessage(error)
      return Promise.reject(error)
    }
  )
  
  return api
}

// Public, unauthenticated API client for open endpoints
export const publicApi = axios.create({ 
  baseURL: API_BASE,
  timeout: 30000, // 30 seconds timeout
})

// Add error interceptor to public API too
publicApi.interceptors.response.use(
  (response) => response,
  (error) => {
    error.userMessage = getErrorMessage(error)
    return Promise.reject(error)
  }
)

// Resolve a possibly relative image path returned by the API to an absolute URL
export function resolveImageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${API_BASE}${url}`
}
