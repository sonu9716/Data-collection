// ============================================================================
// frontend/src/pages/Dashboard.js
// Main Dashboard with Survey, Tests, and Video
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SurveyForm from '../components/SurveyForm';
import VideoRecorder from '../components/VideoRecorder';
import CognitiveTestInterface from '../components/CognitiveTestInterface';
import TypingFrustrationTest from '../components/TypingFrustrationTest';

function Dashboard({ user, api, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('survey');

  // Session State
  const [sessionStarted, setSessionStarted] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [testsCompleted, setTestsCompleted] = useState(false);
  const [typingCompleted, setTypingCompleted] = useState(false); // New Step
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null); // New state for error handling
  const [sessionComplete, setSessionComplete] = useState(false);

  const videoRecorderRef = React.useRef(null);

  // Prevent browser back button
  React.useEffect(() => {
    // Push a new entry to history to "trap" the user
    window.history.pushState(null, null, window.location.href);

    const handlePopState = () => {
      // Upon trying to go back, push state again to stay on current page
      window.history.pushState(null, null, window.location.href);
      alert("Navigation is disabled during the active session to ensure video integrity.");
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auto-start recording when Dashboard mounts (Survey starts)
  React.useEffect(() => {
    if (videoRecorderRef.current && !sessionStarted) {
      console.log('Starting continuous recording session...');
      videoRecorderRef.current.startRecording();
      setSessionStarted(true);
    }
  }, [sessionStarted]);

  // CLEANUP: Stop recording if user leaves the component (unmount)
  React.useEffect(() => {
    return () => {
      // Only stop if we actually started and haven't completed the session normally
      if (videoRecorderRef.current) {
        console.log('Dashboard unmounting - ensuring recording stops.');
        videoRecorderRef.current.stopRecording();
      }
    };
  }, []); // Empty array ensures this ONLY runs on unmount

  // Check for full completion
  React.useEffect(() => {
    if (surveyCompleted && testsCompleted && typingCompleted && !sessionComplete) {
      finishSession();
    }
  }, [surveyCompleted, testsCompleted, typingCompleted, sessionComplete]);

  const finishSession = async () => {
    setSessionComplete(true);
    setUploading(true);
    console.log('Session complete! Stopping recording...');

    if (videoRecorderRef.current) {
      await videoRecorderRef.current.stopRecording();
      // The VideoRecorder component handles the upload and calls onUploadComplete
    }
  };

  const onVideoUploadComplete = () => {
    setUploading(false);
    setUploadError(null);
    alert('Congratulations! You have completed the entire data collection session. Thank you for your participation.');
  };

  const handleVideoUploadError = (errorMsg) => {
    setUploadError(errorMsg);
    // Don't set uploading to false yet so we can show the error in the overlay
  };

  const handleLogout = async () => {
    // Explicitly stop recording before leaving
    if (videoRecorderRef.current) {
      console.log('User logging out - stopping recording.');
      /* We use async stop if possible, but even fire-and-forget is better than nothing. 
         However, VideoRecorder.stopRecording isn't async in the current impl, 
         but accessing the ref is safe. */
      videoRecorderRef.current.stopRecording();
    }

    onLogout();
    navigate('/');
  };

  const handleTypingComplete = async (results) => {
    setUploading(true); // Show global overlay immediately
    // Submit results to backend
    try {
      await api.post('/tests/submit', results);
      setTypingCompleted(true);
    } catch (err) {
      console.error("Failed to submit typing test", err);
      // Still mark complete to allow finish
      setTypingCompleted(true);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Global Video Recorder - Hidden or Minimized */}
      <VideoRecorder
        ref={videoRecorderRef}
        user={user}
        api={api}
        onUploadComplete={onVideoUploadComplete}
        onUploadError={handleVideoUploadError}
      />

      {uploading && (
        <div className="upload-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', color: 'white',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <h2>{uploadError ? '❌ Upload Failed' : '🚀 Uploading Session Data...'}</h2>
          <div className={uploadError ? "error-icon" : "spinner"}></div>
          <p>{uploadError || 'Preparing your research data for submission. Please do not close this window.'}</p>
          {uploadError && (
            <button
              onClick={() => { setUploading(false); setUploadError(null); }}
              className="btn-primary"
              style={{ marginTop: '20px' }}
            >
              Back to Dashboard
            </button>
          )}
        </div>
      )}

      <nav className="navbar">
        <h2>Data Collection Platform</h2>
        <div className="nav-right">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </nav>

      <button
        className={`tab ${activeTab === 'survey' ? 'active' : ''}`}
        onClick={() => setActiveTab('survey')}
      >
        📋 Survey {surveyCompleted && '✓'}
      </button>
      <button
        className={`tab ${activeTab === 'tests' ? 'active' : ''}`}
        onClick={() => surveyCompleted && setActiveTab('tests')}
        disabled={!surveyCompleted}
      >
        🧠 Cognitive Tests {testsCompleted && '✓'}
      </button>
      <button
        className={`tab ${activeTab === 'typing' ? 'active' : ''}`}
        onClick={() => testsCompleted && setActiveTab('typing')}
        disabled={!testsCompleted}
      >
        ⌨️ Typing Task {typingCompleted && '✓'}
      </button>

      <div className="dashboard-content">


        {activeTab === 'survey' && (
          <SurveyForm
            user={user}
            api={api}
            onComplete={() => {
              setSurveyCompleted(true);
              window.scrollTo(0, 0);
              alert('Survey Completed! You can now proceed to the next section when ready.');
            }}
          />
        )}

        {activeTab === 'tests' && (
          <CognitiveTestInterface
            user={user}
            api={api}
            onComplete={() => {
              setTestsCompleted(true);
              window.scrollTo(0, 0);
              alert('Cognitive Tests Completed! You can now proceed to the final task when ready.');
            }}
          />
        )}

        {activeTab === 'typing' && (
          <TypingFrustrationTest
            user={user}
            api={api}
            onComplete={handleTypingComplete}
          />
        )}

        <div className="manual-progression" style={{ marginTop: '20px', textAlign: 'center' }}>
          {activeTab === 'survey' && surveyCompleted && (
            <button onClick={() => setActiveTab('tests')} className="btn-primary">
              Start Cognitive Tests →
            </button>
          )}
          {activeTab === 'tests' && testsCompleted && (
            <button onClick={() => setActiveTab('typing')} className="btn-primary">
              Start Typing Task →
            </button>
          )}
        </div>
      </div>

      <div className="progress-indicator">
        <h3>Session Status</h3>
        <div className="progress-items">
          <div className="progress-item">
            <span>Recording Status</span>
            {sessionStarted && !sessionComplete ? (
              <span style={{ color: 'red' }}>🔴 Recording</span>
            ) : sessionComplete ? (
              <span style={{ color: 'green' }}>✓ Saved</span>
            ) : (
              <span>Waiting...</span>
            )}
          </div>
          <div className="progress-item">
            <span>1. Survey</span>
            <span style={{ color: surveyCompleted ? 'green' : 'gray' }}>
              {surveyCompleted ? '✓ Done' : '○ Pending'}
            </span>
          </div>
          <div className="progress-item">
            <span>2. Cognitive Tests</span>
            <span style={{ color: testsCompleted ? 'green' : 'gray' }}>
              {testsCompleted ? '✓ Done' : '○ Pending'}
            </span>
          </div>
          <div className="progress-item">
            <span>3. Typing Task</span>
            <span style={{ color: typingCompleted ? 'green' : 'gray' }}>
              {typingCompleted ? '✓ Done' : '○ Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;