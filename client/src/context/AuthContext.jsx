import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const api = useMemo(() => axios.create({ baseURL: '/api' }), [])
  const refreshPending = useRef(null)
  const generation = useRef(0)
  const clearSession = useCallback(() => {
    generation.current += 1
    for (const key of ['user', 'accessToken', 'refreshToken']) localStorage.removeItem(key)
    setUser(null)
  }, [])
  const saveSession = useCallback((data) => {
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  useEffect(() => {
    const request = api.interceptors.request.use(config => {
      const token = localStorage.getItem('accessToken')
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })
    const response = api.interceptors.response.use(res => res, async error => {
      const config = error.config
      if (error.response?.status !== 401 || !config || ['/auth/login', '/auth/register'].includes(config.url)) throw error
      if (config._retry || !localStorage.getItem('refreshToken')) { clearSession(); throw error }
      config._retry = true
      if (!refreshPending.current) {
        const current = generation.current
        refreshPending.current = axios.post('/api/auth/refresh', { refreshToken: localStorage.getItem('refreshToken') })
          .then(({ data }) => {
            if (generation.current !== current) throw new Error('Session changed')
            saveSession(data)
          })
          .catch(err => { if (generation.current === current && err.response?.status === 401) clearSession(); throw err })
          .finally(() => { refreshPending.current = null })
      }
      await refreshPending.current
      return api(config)
    })
    return () => { api.interceptors.request.eject(request); api.interceptors.response.eject(response) }
  }, [api, clearSession, saveSession])

  useEffect(() => {
    let active = true
    if (!localStorage.getItem('accessToken') && !localStorage.getItem('refreshToken')) { setLoading(false); return }
    api.get('/auth/me').then(({ data }) => {
      if (active) { setUser(data); localStorage.setItem('user', JSON.stringify(data)) }
    }).catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    generation.current += 1
    return saveSession(data)
  }
  const register = async formData => {
    const { data } = await api.post('/auth/register', formData)
    generation.current += 1
    return saveSession(data)
  }
  const logout = async () => {
    try { await api.post('/auth/logout') } finally { clearSession() }
  }
  const changePassword = async (currentPassword, newPassword) => {
    await api.post('/auth/change-password', { currentPassword, newPassword })
    clearSession()
  }
  const downloadDocument = async (id, name = 'document') => {
    const { data } = await api.get(`/files/documents/${id}`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url; link.download = name; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const value = { user, loading, api, login, register, logout, changePassword, downloadDocument,
    isStudent: () => user?.role === 'student',
    isAdmin: () => ['admin', 'super_admin'].includes(user?.role),
    isSuperAdmin: () => user?.role === 'super_admin', isLoggedIn: () => !!user }
  if (loading) return null
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export default AuthContext
