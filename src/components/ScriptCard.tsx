'use client';

import { useState } from 'react';
import { Script, createHeyGenVideo, checkHeyGenVideoStatus } from '@/lib/api';

interface ScriptCardProps {
  script: Script;
  onCopy?: () => void;
}

export function ScriptCard({ script, onCopy }: ScriptCardProps) {
  const [copied, setCopied] = useState(false);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState<'idle' | 'creating' | 'processing' | 'completed' | 'error'>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script.content);
      setCopied(true);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleCreateVideo = async () => {
    setCreatingVideo(true);
    setVideoStatus('creating');
    setVideoError(null);
    setVideoUrl(null);

    try {
      // Create video
      const createResponse = await createHeyGenVideo(
        script.content,
        undefined, // Use default avatar
        undefined, // Use default voice
        `Script ${script.id} - Video`
      );

      const newVideoId = createResponse.data?.video_id;
      if (!newVideoId) {
        throw new Error('No video ID returned from HeyGen');
      }

      setVideoId(newVideoId);
      setVideoStatus('processing');

      // Poll for video status
      const pollStatus = async () => {
        const maxAttempts = 60; // 5 minutes max (5 second intervals)
        let attempts = 0;

        const poll = async () => {
          try {
            const statusResponse = await checkHeyGenVideoStatus(newVideoId);
            const status = statusResponse.data?.status;

            if (status === 'completed') {
              setVideoStatus('completed');
              setVideoUrl(statusResponse.data?.video_url || null);
              setCreatingVideo(false);
              return;
            } else if (status === 'failed') {
              setVideoStatus('error');
              setVideoError(statusResponse.data?.error || 'Video generation failed');
              setCreatingVideo(false);
              return;
            } else if (status === 'processing' || status === 'pending') {
              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(poll, 5000); // Poll every 5 seconds
              } else {
                setVideoStatus('error');
                setVideoError('Video generation is taking longer than expected. Please check back later.');
                setCreatingVideo(false);
              }
            }
          } catch (error: any) {
            setVideoStatus('error');
            setVideoError(error.message || 'Failed to check video status');
            setCreatingVideo(false);
          }
        };

        // Start polling after a short delay
        setTimeout(poll, 3000);
      };

      pollStatus();
    } catch (error: any) {
      setVideoStatus('error');
      setVideoError(error.message || 'Failed to create video');
      setCreatingVideo(false);
      console.error('Error creating video:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl hover:scale-[1.01]">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
            {script.id}
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Script Variation {script.id}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Ready to use
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleCreateVideo}
            disabled={creatingVideo || videoStatus === 'processing'}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              videoStatus === 'completed'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : videoStatus === 'error'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
            }`}
          >
            {creatingVideo || videoStatus === 'processing' ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{videoStatus === 'creating' ? 'Creating...' : 'Processing...'}</span>
              </>
            ) : videoStatus === 'completed' ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Video Ready</span>
              </>
            ) : videoStatus === 'error' ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Retry</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Create Video</span>
              </>
            )}
          </button>
          <button
            onClick={handleCopy}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md ${
              copied
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
            }`}
          >
            {copied ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      {/* Video Status Messages */}
      {videoStatus === 'processing' && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-xl">
          <div className="flex items-center space-x-2">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-medium">Your video is being generated. This may take a few minutes...</span>
          </div>
        </div>
      )}

      {videoStatus === 'completed' && videoUrl && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Video is ready!</span>
            </div>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>View Video</span>
            </a>
          </div>
        </div>
      )}

      {videoStatus === 'error' && videoError && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{videoError}</span>
          </div>
        </div>
      )}

      <div className="prose dark:prose-invert max-w-none">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-base sm:text-lg">
            {script.content}
          </p>
        </div>
      </div>
    </div>
  );
}

