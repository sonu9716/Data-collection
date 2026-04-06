import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';

const VideoRecorder = forwardRef(({ user, api, onUploadComplete, onUploadError }, ref) => {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mimeTypeRef = useRef('video/webm');
  const shouldUploadRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState(null);

  useImperativeHandle(ref, () => ({
    startRecording: async () => {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
          audio: true
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Detect best supported format — keep the REAL mime type so Blob is correct
        const recorderOptions = {};
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          recorderOptions.mimeType = 'video/webm;codecs=vp8';
          mimeTypeRef.current = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          recorderOptions.mimeType = 'video/webm';
          mimeTypeRef.current = 'video/webm';
        } else {
          mimeTypeRef.current = 'video/mp4';
        }
        recorderOptions.videoBitsPerSecond = 500000; // 500 kbps — ~60-70% smaller than default

        const mediaRecorder = new MediaRecorder(stream, recorderOptions);
        const chunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          // Only upload if explicitly told to (session completed normally)
          if (!shouldUploadRef.current) {
            console.log('[VideoRecorder] Stopped without upload flag — discarding.');
            stream.getTracks().forEach(t => t.stop());
            if (onUploadComplete) onUploadComplete();
            return;
          }
          if (chunks.length < 2) {
            console.log('[VideoRecorder] Recording too short — skipping upload.');
            stream.getTracks().forEach(t => t.stop());
            if (onUploadComplete) onUploadComplete();
            return;
          }

          // FIXED: use the actual recorded MIME type, not a hardcoded 'video/mp4'
          const actualMimeType = mimeTypeRef.current;
          const blob = new Blob(chunks, { type: actualMimeType });

          if (blob.size < 1000) {
            console.log('[VideoRecorder] Blob too small — skipping upload.');
            stream.getTracks().forEach(t => t.stop());
            if (onUploadComplete) onUploadComplete();
            return;
          }

          console.log(`[VideoRecorder] Uploading ${(blob.size / 1024 / 1024).toFixed(2)} MB (${actualMimeType})`);
          await uploadVideo(blob, actualMimeType);
          stream.getTracks().forEach(t => t.stop());
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(10000); // Collect data every 10 s to reduce memory pressure
        setIsRecording(true);
        console.log('[VideoRecorder] Recording started');
      } catch (err) {
        setError('Unable to access camera: ' + err.message);
        console.error('[VideoRecorder] startRecording error:', err);
      }
    },

    stopRecording: (shouldUpload = false) => {
      shouldUploadRef.current = shouldUpload;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        console.log(`[VideoRecorder] Stopped (upload=${shouldUpload})`);
      }
    }
  }));

  // Upload with up to 3 retries on network/server errors
  const uploadVideo = async (videoBlob, mimeType) => {
    setUploading(true);
    setUploadProgress(0);
    const ext = mimeType === 'video/webm' ? 'webm' : 'mp4';
    const filename = `survey_recording.${ext}`;

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const formData = new FormData();
        formData.append('video', videoBlob, filename);
        formData.append('video_type', 'survey_session');

        await api.post('/videos/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000, // 2-minute timeout for large files
          onUploadProgress: (e) => {
            if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        console.log(`[VideoRecorder] Upload successful on attempt ${attempt}`);
        setUploadProgress(100);
        if (onUploadComplete) onUploadComplete();
        return; // success — exit retry loop
      } catch (err) {
        const isLast = attempt === MAX_RETRIES;
        const isRetryable = !err.response || err.response.status >= 500 || err.code === 'ECONNABORTED';
        console.error(`[VideoRecorder] Upload attempt ${attempt} failed:`, err.message);
        if (isLast || !isRetryable) {
          setError(`Upload failed after ${attempt} attempt(s): ${err.message}`);
          if (onUploadError) onUploadError(err.message);
          break;
        }
        // Wait before retrying (exponential back-off: 2 s, 4 s)
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
    setUploading(false);
    setUploadProgress(null);
  };

  return (
    <div className="video-recorder-minimized" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      padding: '10px',
      borderRadius: '8px',
      color: 'white',
      textAlign: 'center',
      minWidth: '170px'
    }}>
      {error && <div style={{ color: '#ff6b6b', fontSize: '10px', marginBottom: '4px' }}>{error}</div>}
      <div className="video-preview">
        <video
          ref={videoRef}
          autoPlay
          muted
          width="160"
          height="120"
          style={{ borderRadius: '4px', display: isRecording ? 'block' : 'none' }}
        />
      </div>
      <div style={{ fontSize: '12px', marginTop: '5px' }}>
        {isRecording ? '🔴 Recording...' : 'Waiting...'}
        {uploading && ` (Uploading${uploadProgress !== null ? ` ${uploadProgress}%` : '...'})`}
      </div>
    </div>
  );
});

export default VideoRecorder;