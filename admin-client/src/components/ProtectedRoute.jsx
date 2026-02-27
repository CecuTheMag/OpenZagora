/**
 * Protected Route Component
 * 
 * Guards routes that require authentication
 * Redirects to login if user is not authenticated
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, requireSuperAdmin = false }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for super admin requirement
  if (requireSuperAdmin && user?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-semibold text-danger-800">Access Denied</h2>
            </div>
            <div className="card-body">
              <p className="text-gray-600 mb-4">
                You do not have permission to access this page. Super admin privileges are required.
              </p>
              <button
                onClick={() => window.history.back()}
                className="btn-secondary w-full"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render protected content
  return children;
};

export default ProtectedRoute;
