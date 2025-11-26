import { publicApi } from '../api/client'

export async function loginRequest(payload) {
  const { data } = await publicApi.post('/auth/login', payload)
  return data
}

export async function signupRequest(payload) {
  const { data } = await publicApi.post('/auth/signup', payload)
  return data
}

export async function getCurrentUser(api) {
  const { data } = await api.get('/auth/me')
  return data
}

