import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';

const VideoRecorder = forwardRef(({ user, api, onUploadComplete, onUploadError }, ref) => {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const shouldUploadRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    startRecording: async () => {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          // Only upload if explicitly told to (session completed normally)
          if (!shouldUploadRef.current) {
            console.log('Recording stopped without upload flag - discarding.');
            stream.getTracks().forEach(track => track.stop());
            if (onUploadComplete) onUploadComplete();
            return;
          }
          if (chunks.length < 2) {
            console.log('Recording too short, skipping upload.');
            stream.getTracks().forEach(track => track.stop());
            if (onUploadComplete) onUploadComplete(); // Still notify to clear loading states
            return;
          }
          const blob = new Blob(chunks, { type: 'video/mp4' });
          if (blob.size < 1000) { // Less than 1KB
            console.log('Video blob too small, likely empty. Skipping upload.');
            stream.getTracks().forEach(track => track.stop());
            if (onUploadComplete) onUploadComplete();
            return;
          }
          await uploadVideo(blob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
        console.log('Video recording started');
      } catch (err) {
        setError('Unable to access camera: ' + err.message);
        console.error(err);
      }
    },
    stopRecording: (shouldUpload = false) => {
      shouldUploadRef.current = shouldUpload;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        console.log(`Video recording stopped (upload: ${shouldUpload})`);
      }
    }
  }));

  const uploadVideo = async (videoBlob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('video', videoBlob, 'survey_recording.mp4');
      formData.append('video_type', 'survey_session');

      await api.post('/videos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('Video uploaded successfully');
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Upload failed: ' + err.message);
      if (onUploadError) onUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="video-recorder-minimized" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      background: 'rgba(0,0,0,0.8)',
      padding: '10px',
      borderRadius: '8px',
      color: 'white',
      textAlign: 'center'
    }}>
      {error && <div className="error-message" style={{ color: 'red', fontSize: '10px' }}>{error}</div>}
      <div className="video-preview">
        <video
          ref={videoRef}
          autoPlay
          muted
          width="160"
          height="120"
          style={{ borderRadius: '4px', display: isRecording ? 'block' : 'none' }}
        ></video>
      </div>
      <div style={{ fontSize: '12px', marginTop: '5px' }}>
        {isRecording ? '🔴 Recording...' : 'Waiting...'}
        {uploading && ' (Uploading)'}
      </div>
    </div>
  );
});

export default VideoRecorder;