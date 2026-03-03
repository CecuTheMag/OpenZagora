/**
 * Open Zagora Admin - Main Application Component
 * 
 * Root component for the admin interface with routing
 * COMPLETELY SEPARATE from public client
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import DatabaseManagement from './pages/DatabaseManagement'
import ProjectsPage from './pages/ProjectsPage'

function App() {
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading while auth is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main content area with page routing */}
      <Routes>
        {/* Login page - redirect to dashboard if already authenticated */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <AdminLogin />
          } 
        />
        
{/* Dashboard - protected route */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
{/* Database Management - protected route */}
        <Route 
          path="/database" 
          element={
            <ProtectedRoute>
              <DatabaseManagement />
            </ProtectedRoute>
          } 
        />
        
        {/* Projects Management - protected route */}
        <Route 
          path="/projects" 
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Default redirect based on auth status */}
        <Route 
          path="/" 
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          } 
        />
        
        {/* 404 - redirect based on auth status */}
        <Route 
          path="*" 
          element={
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          } 
        />
      </Routes>
    </div>
  )
}

export default App
