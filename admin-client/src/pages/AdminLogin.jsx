/**
 * Admin Login Page
 * 
 * Secure login interface for admin users
 * Enterprise-grade with proper error handling and loading states
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Lock, User, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Clear errors when inputs change
  useEffect(() => {
    if (error) clearError();
    if (localError) setLocalError('');
  }, [username, password, error, clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!username.trim() || !password.trim()) {
      setLocalError('Please enter both username and password');
      return;
    }

    setIsSubmitting(true);
    setLocalError('');

    const result = await login(username.trim(), password);

    if (result.success) {
      // Navigate to dashboard using React Router
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } else {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-lg flex items-center justify-center shadow-lg">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Open Zagora Admin
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enterprise-grade municipal transparency dashboard
          </p>
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-danger-100 text-danger-800">
            <Lock className="h-3 w-3 mr-1" />
            Secure Admin Access
          </div>
        </div>

        {/* Login Form */}
        <div className="card mt-8">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              Administrator Sign In
            </h3>
          </div>
          
          <div className="card-body">
            {displayError && (
              <div className="alert-error mb-4 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{displayError}</span>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="form-label flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-400" />
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input"
                  placeholder="Enter your username"
                  disabled={isSubmitting}
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="form-label flex items-center">
                  <Lock className="h-4 w-4 mr-2 text-gray-400" />
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input pr-10"
                    placeholder="Enter your password"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex">
                <Shield className="h-5 w-5 text-primary-500 mr-3 flex-shrink-0" />
                <div className="text-xs text-gray-600">
                  <p className="font-medium text-gray-900 mb-1">Security Notice</p>
                  <p>
                    This is a secure administrative interface. All login attempts are logged and monitored.
                    Unauthorized access attempts will be reported.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>© 2024 Open Zagora. All rights reserved.</p>
          <p className="mt-1">Enterprise Municipal Transparency Platform</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
