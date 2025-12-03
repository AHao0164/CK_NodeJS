import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token'));
  const [user, setUser] = useState(() => {
    const raw = sessionStorage.getItem('admin_user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) sessionStorage.setItem('admin_token', token); else sessionStorage.removeItem('admin_token');
    if (user) sessionStorage.setItem('admin_user', JSON.stringify(user)); else sessionStorage.removeItem('admin_user');
  }, [token, user]);

  const api = useMemo(() => {
    const instance = axios.create({ 
      baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:8080',
      timeout: 30000,
    });
    instance.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return instance;
  }, [token]);

  const login = async (email, password) => {
    const { data } = await axios.post((import.meta.env.VITE_API_BASE || 'http://localhost:8080') + '/auth/login', { email, password }, { timeout: 30000 });
    const tok = data.token;
    setToken(tok);
    const me = await axios.get((import.meta.env.VITE_API_BASE || 'http://localhost:8080') + '/auth/me', { headers: { Authorization: `Bearer ${tok}` }, timeout: 30000 });
    setUser(me.data);
  };

  const logout = () => { setToken(null); setUser(null); };

  const value = { token, user, api, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }


