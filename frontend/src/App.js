// ============================================================================
// frontend/src/App.js
// Main React Application with Routing
// ============================================================================

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './App.css';

// Import pages
import LoginRegister from './pages/LoginRegister';
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';

// API Setup
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// JWT Interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'dummy-client-id';

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const response = await api.get('/auth/verify');
        setUser(response.data.user);
        setIsAuthenticated(true);
      }
    } catch (err) {
      localStorage.removeItem('access_token');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password });
      localStorage.setItem('access_token', response.data.access_token);
      setUser(response.data.user);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      return false;
    }
  };

  const handleGoogleLogin = async (credential) => {
    try {
      setError(null);
      console.log('Attempting Google Login with backend:', API_BASE_URL);
      const response = await api.post('/auth/google', { token: credential });
      localStorage.setItem('access_token', response.data.access_token);
      setUser(response.data.user);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      console.error('Google Login Full Error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Google Login failed';
      setError(errorMessage);
      return false;
    }
  };

  const handleRegister = async (formData) => {
    try {
      setError(null);
      const response = await api.post('/auth/register', formData);
      setUser(response.data.user);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="app">
          <Routes>
            {!isAuthenticated ? (
              <>
                <Route
                  path="/"
                  element={
                    <LoginRegister
                      onLogin={handleLogin}
                      onRegister={handleRegister}
                      onGoogleLogin={handleGoogleLogin}
                      error={error}
                    />
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <>
                <Route
                  path="/"
                  element={<Welcome user={user} onLogout={handleLogout} api={api} />}
                />
                <Route
                  path="/dashboard"
                  element={<Dashboard user={user} api={api} onLogout={handleLogout} />}
                />
                <Route
                  path="/admin"
                  element={<AdminDashboard user={user} api={api} onLogout={handleLogout} />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </div>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
export { api };