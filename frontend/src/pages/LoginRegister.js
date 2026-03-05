// ============================================================================
// frontend/src/pages/LoginRegister.js
// User Authentication Page
// ============================================================================

import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import loginBg from '../login_bg.png';

function LoginRegister({ onLogin, onRegister, onGoogleLogin, error }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    age: '',
    gender: '',
    institution: '',
    socioeconomic_status: '',
    academic_discipline: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const success = await onLogin(formData.email, formData.password);
        if (success) {
          // Redirect handled by parent
        }
      } else {
        const success = await onRegister(formData);
        if (success) {
          setIsLogin(true);
          setFormData({
            email: '',
            password: '',
            age: '',
            gender: '',
            institution: '',
            socioeconomic_status: '',
            academic_discipline: ''
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      if (credentialResponse.credential) {
        await onGoogleLogin(credentialResponse.credential);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.error('Google Login Failed');
  };

  return (
    <div className="auth-container" style={{
      backgroundImage: `url(${loginBg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div className="auth-card">
        <h1>{isLogin ? 'Login' : 'Register'}</h1>

        {error && <div className="error-message">{error}</div>}

        <div className="google-auth-section" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap
            theme="filled_blue"
            shape="rectangular"
          />
        </div>

        <div className="divider" style={{
          display: 'flex',
          alignItems: 'center',
          textAlign: 'center',
          margin: '20px 0',
          color: '#888'
        }}>
          <hr style={{ flex: 1 }} />
          <span style={{ padding: '0 10px' }}>OR</span>
          <hr style={{ flex: 1 }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          {!isLogin && (
            <>
              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} disabled={loading}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Institution</label>
                <input
                  type="text"
                  name="institution"
                  value={formData.institution}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Socioeconomic Status</label>
                <select name="socioeconomic_status" value={formData.socioeconomic_status} onChange={handleInputChange} disabled={loading}>
                  <option value="">Select...</option>
                  <option value="low">Low</option>
                  <option value="middle">Middle</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group">
                <label>Academic Discipline</label>
                <input
                  type="text"
                  name="academic_discipline"
                  value={formData.academic_discipline}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <p className="toggle-auth">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="toggle-btn"
            disabled={loading}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default LoginRegister;