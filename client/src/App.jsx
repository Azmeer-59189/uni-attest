import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import { ForgotPassword, ResetPassword } from './pages/PasswordReset'
import StudentDashboard from './pages/student/Dashboard'
import NewApplication from './pages/student/NewApplication'
import AdminDashboard from './pages/admin/Dashboard'
import AdminManagement from './pages/admin/AdminManagement'
import VerifyDegree from './pages/VerifyDegree'
import ProtectedRoute from './components/ProtectedRoute'
import Account from './pages/Account'
import ApplicationDetail from './pages/ApplicationDetail'
import Challan from './pages/student/Challan'
import { STAFF_ROLES } from './utils/workflow'

function App() {
  return (
    <AuthProvider>
      <AppLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/account" element={<ProtectedRoute allowedRoles={['student', ...STAFF_ROLES]}><Account /></ProtectedRoute>} />
            <Route path="/verify/:hash?" element={<VerifyDegree />} />

            {/* Student routes */}
            <Route path="/student/applications/:id" element={<ProtectedRoute allowedRoles={['student']}><ApplicationDetail /></ProtectedRoute>} />
            <Route path="/student/applications/:id/challan" element={<ProtectedRoute allowedRoles={['student']}><Challan /></ProtectedRoute>} />
            <Route path="/student/dashboard" element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/student/apply" element={
              <ProtectedRoute allowedRoles={['student']}>
                <NewApplication />
              </ProtectedRoute>
            } />

            {/* Admin routes */}
            <Route path="/admin/applications/:id" element={<ProtectedRoute allowedRoles={STAFF_ROLES}><ApplicationDetail /></ProtectedRoute>} />
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={STAFF_ROLES}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* Super admin only */}
            <Route path="/admin/manage-admins" element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <AdminManagement />
              </ProtectedRoute>
            } />
          </Routes>
      </AppLayout>
    </AuthProvider>
  )
}

export default App
