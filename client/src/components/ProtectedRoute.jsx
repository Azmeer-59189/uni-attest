import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <p role="status" className="py-24 text-center text-ink-faint">Loading…</p>
    )
  }

  // Remember the requested page so sign-in can return to it.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />

  return children
}

export default ProtectedRoute