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

// Shipping addresses (multi-address management)
export async function getAddresses(api) {
  const { data } = await api.get('/auth/addresses')
  return data
}

export async function createAddress(api, payload) {
  const { data } = await api.post('/auth/addresses', payload)
  return data
}

export async function updateAddress(api, id, payload) {
  const { data } = await api.patch(`/auth/addresses/${id}`, payload)
  return data
}

export async function deleteAddress(api, id) {
  const { data } = await api.delete(`/auth/addresses/${id}`)
  return data
}

export async function setDefaultAddress(api, id) {
  const { data } = await api.patch(`/auth/addresses/${id}/default`)
  return data
}

