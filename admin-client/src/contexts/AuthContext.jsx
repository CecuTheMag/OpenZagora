/**
 * Authentication Context
 * 
 * Manages admin authentication state across the application
 * Handles login, logout, and token management
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// API base URL - use relative path to go through Vite proxy
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors by clearing auth state
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      // Don't redirect here - let components handle it
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('adminToken');
      
      if (token) {
        try {
          // Verify token validity
          const response = await api.get('/api/auth/verify');
          
          if (response.data.success) {
            const userData = localStorage.getItem('adminUser');
            if (userData) {
              setUser(JSON.parse(userData));
              setIsAuthenticated(true);
            }
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (err) {
          console.error('Token verification failed:', err);
          // Clear storage on any error
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Login function
  const login = useCallback(async (username, password) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/login', {
        username,
        password
      });

      if (response.data.success) {
        const { token, user: userData } = response.data.data;
        
        // Store token and user data
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminUser', JSON.stringify(userData));
        
        // Update state synchronously
        setUser(userData);
        setIsAuthenticated(true);
        setIsLoading(false);
        
        return { success: true };
      } else {
        // Handle case where response doesn't have success flag
        const errorMessage = response.data.message || 'Login failed. Please try again.';
        setError(errorMessage);
        setIsLoading(false);
        return { success: false, error: errorMessage };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
      
      return { success: false, error: errorMessage };
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      // Call logout endpoint (optional, for audit logging)
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear local storage
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      
      // Reset state
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get fresh user data
  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/me');
      
      if (response.data.success) {
        const userData = response.data.data.user;
        localStorage.setItem('adminUser', JSON.stringify(userData));
        setUser(userData);
        return userData;
      }
    } catch (err) {
      console.error('Failed to refresh user data:', err);
    }
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    clearError,
    refreshUser,
    api
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
