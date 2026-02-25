// ============================================================================
// frontend/src/pages/AdminDashboard.js
// Admin Statistics and Data Export
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminDashboard({ user, api, onLogout }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/admin/dashboard');
      setStats(response.data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (dataType) => {
    try {
      const response = await api.get(`/admin/export/${dataType}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${dataType}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentElement.removeChild(link);
    } catch (err) {
      alert('Export failed');
      console.error(err);
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  if (loading) {
    return <div className="admin-container"><p>Loading...</p></div>;
  }

  return (
    <div className="admin-container">
      <nav className="navbar">
        <h2>Admin Dashboard</h2>
        <div className="nav-right">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </nav>

      {error && <div className="error-message">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Users</h3>
          <p className="stat-number">{stats?.total_users || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Survey Responses</h3>
          <p className="stat-number">{stats?.total_surveys || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Videos Uploaded</h3>
          <p className="stat-number">{stats?.total_videos || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Completion Rate</h3>
          <p className="stat-number">{stats?.completion_rate || '0%'}</p>
        </div>
      </div>

      <div className="export-section">
        <h2>Data Export</h2>
        <div className="export-buttons">
          <button onClick={() => handleExport('surveys')} className="btn-primary">
            📥 Export Surveys
          </button>
          <button onClick={() => handleExport('tests')} className="btn-primary">
            📥 Export Test Results
          </button>
          <button onClick={() => handleExport('videos')} className="btn-primary">
            📥 Export Video Metadata
          </button>
        </div>
      </div>

      <div className="details-section">
        <h2>Survey Statistics</h2>
        <div className="details-grid">
          <div className="detail-item">
            <span>Baseline Surveys:</span>
            <span className="detail-value">{stats?.baseline_surveys || 0}</span>
          </div>
          <div className="detail-item">
            <span>Follow-up Surveys (3-month):</span>
            <span className="detail-value">{stats?.followup_surveys || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;