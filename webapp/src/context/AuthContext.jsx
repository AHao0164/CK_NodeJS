import React, { createContext, useContext, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const api = useMemo(() => createApiClient(() => token), [token])
  const login = (t) => { setToken(t); localStorage.setItem('token', t) }
  const logout = () => { setToken(''); localStorage.removeItem('token') }
  const value = { token, api, login, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }


