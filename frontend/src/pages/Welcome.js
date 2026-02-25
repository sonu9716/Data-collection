// ============================================================================
// frontend/src/pages/Welcome.js
// Welcome/Dashboard Navigation Page
// ============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';

function Welcome({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="welcome-container">
      <nav className="navbar">
        <h2>Data Collection Platform</h2>
        <div className="nav-right">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </nav>

      <div className="welcome-content">
        <h1>Welcome to the Research Study</h1>
        <p>Social Media Impact on Student Cognitive Intelligence</p>

        <div className="options-grid" style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '40px'
        }}>
          <div className="option-card" style={{ maxWidth: '400px', width: '100%' }}>
            <h3>📊 View Dashboard</h3>
            <p>Access the main research dashboard to complete the survey, cognitive tests, and typing task.</p>
            <p><strong>Note:</strong> Video recording will start automatically once you enter.</p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="btn-primary"
              style={{ width: '100%', marginTop: '15px' }}
            >
              Enter Dashboard & Start Session
            </button>
          </div>
        </div>

        <div className="info-section">
          <h2>About This Study</h2>
          <p>
            This research investigates the impact of social media on student cognitive intelligence,
            attention span, and problem-solving abilities. Your participation helps us understand
            these important relationships.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Welcome;