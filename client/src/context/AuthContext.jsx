import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Axios base URL ──
  const api = axios.create({ baseURL: '/api' })

  // Attach token to every request automatically
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  // ── On mount: restore session from localStorage ──
  useEffect(() => {
    const storedUser  = localStorage.getItem('user')
    const accessToken = localStorage.getItem('accessToken')
    if (storedUser && accessToken) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  // ── REGISTER ──
  const register = async (formData) => {
    const res = await api.post('/auth/register', formData)
    const { user, accessToken, refreshToken } = res.data
    localStorage.setItem('user',         JSON.stringify(user))
    localStorage.setItem('accessToken',  accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    setUser(user)
    return user
  }

  // ── LOGIN ──
  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { user, accessToken, refreshToken } = res.data
    localStorage.setItem('user',         JSON.stringify(user))
    localStorage.setItem('accessToken',  accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    setUser(user)
    return user
  }

  // ── LOGOUT ──
  const logout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
  }

  // ── HELPERS ──
  const isStudent    = () => user?.role === 'student'
  const isAdmin      = () => user?.role === 'admin' || user?.role === 'super_admin'
  const isSuperAdmin = () => user?.role === 'super_admin'
  const isLoggedIn   = () => !!user

  const value = {
    user,
    loading,
    api,
    register,
    login,
    logout,
    isStudent,
    isAdmin,
    isSuperAdmin,
    isLoggedIn,
  }

  if (loading) return null

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext