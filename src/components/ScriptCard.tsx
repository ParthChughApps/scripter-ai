'use client';

import { useState, useEffect } from 'react';
import { Script, createHeyGenVideo, checkHeyGenVideoStatus, listHeyGenAvatars, HeyGenAvatar, VideoAspectRatio, VIDEO_ASPECT_RATIOS } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { cleanScriptForHeyGen } from '@/lib/scriptUtils';

interface ScriptCardProps {
  script: Script;
  onCopy?: () => void;
  avatars?: HeyGenAvatar[];
}

export function ScriptCard({ script, onCopy, avatars: propAvatars = [] }: ScriptCardProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState<'idle' | 'creating' | 'processing' | 'completed' | 'error'>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(script.content);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>(propAvatars);
  const [loadingAvatars, setLoadingAvatars] = useState(false);
  // Default avatar ID
  const DEFAULT_AVATAR_ID = '32dbf2775e394a51a96c75e5aadeeb86';
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(DEFAULT_AVATAR_ID);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<VideoAspectRatio>('vertical');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [customAvatars, setCustomAvatars] = useState<HeyGenAvatar[]>([]);
  const [publicAvatars, setPublicAvatars] = useState<HeyGenAvatar[]>([]);

  // Helper function to safely extract error message from string or object
  const getErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred';
    if (typeof error === 'string') return error;
    if (typeof error === 'object') {
      // Handle error objects with common message fields
      return error.message || error.detail || error.error || JSON.stringify(error);
    }
    return String(error);
  };

  // Update avatars when prop changes
  useEffect(() => {
    if (propAvatars.length > 0) {
      // Remove duplicates first based on avatar_id
      const uniqueAvatars = Array.from(
        new Map(propAvatars.map(avatar => [avatar.avatar_id, avatar])).values()
      );
      
      // Separate custom and public avatars
      const customAvatarsList = uniqueAvatars.filter(avatar => {
        const avatarId = avatar.avatar_id;
        const isUUID = /^[a-f0-9]{32}$/i.test(avatarId);
        // Custom avatars are UUIDs that are not explicitly marked as public
        return isUUID && avatar.is_public !== true && !avatar.avatar_id.includes('_public_');
      });
      
      const publicAvatarsList = uniqueAvatars.filter(avatar => {
        const avatarId = avatar.avatar_id;
        const isUUID = /^[a-f0-9]{32}$/i.test(avatarId);
        // Public avatars are non-UUIDs or UUIDs explicitly marked as public
        if (isUUID) {
          return avatar.is_public === true || avatar.avatar_id.includes('_public_');
        }
        return true; // All non-UUID avatars are public
      });
      
      // Don't add placeholder avatars - only show avatars that actually exist
      setCustomAvatars(customAvatarsList);
      setPublicAvatars(publicAvatarsList);
      setAvatars(uniqueAvatars); // Keep for backward compatibility
      
      // Auto-select default avatar if available, otherwise first custom avatar
      if (customAvatarsList.length > 0) {
        const defaultAvatar = customAvatarsList.find(avatar => avatar.avatar_id === DEFAULT_AVATAR_ID);
        const currentSelectedExists = customAvatarsList.find(avatar => avatar.avatar_id === selectedAvatarId);
        
        // If default avatar is in the list, prefer it
        if (defaultAvatar) {
          setSelectedAvatarId(defaultAvatar.avatar_id);
        } 
        // If current selection doesn't exist in the list, select first custom avatar
        else if (!currentSelectedExists) {
          setSelectedAvatarId(customAvatarsList[0].avatar_id);
        }
        // Otherwise, keep the current selection
      }
    } else {
      // If no prop avatars, set empty arrays
      setCustomAvatars([]);
      setPublicAvatars([]);
    }
  }, [propAvatars, selectedAvatarId]);

  // Update editedContent when script prop changes
  useEffect(() => {
    setEditedContent(script.content);
  }, [script.content]);

  const handleCopy = async () => {
    try {
      // Copy the current content (edited or original)
      await navigator.clipboard.writeText(editedContent);
      setCopied(true);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    // The editedContent is already updated via the textarea
  };

  const handleCancelEdit = () => {
    setEditedContent(script.content); // Reset to original
    setIsEditing(false);
  };

  const handleOpenAvatarModal = async () => {
    setShowAvatarModal(true);
    setAvatarError(null);
    
    // If avatars are already loaded from props, separate them
    if (avatars.length > 0) {
      // Separate custom and public avatars
      const customAvatarsList = avatars.filter(avatar => {
        const avatarId = avatar.avatar_id;
        return /^[a-f0-9]{32}$/i.test(avatarId);
      });
      
      // Public avatars are those that don't match UUID pattern
      const publicAvatarsList = avatars.filter(avatar => {
        const avatarId = avatar.avatar_id;
        const isUUID = /^[a-f0-9]{32}$/i.test(avatarId);
        
        // If it's a UUID, it's custom (unless explicitly marked as public)
        if (isUUID) {
          return avatar.is_public === true || avatar.avatar_id.includes('_public_');
        }
        
        // Non-UUID IDs are public avatars
        return true;
      });
      
      console.log('=== Avatar Separation (from props) ===');
      console.log(`Total avatars: ${avatars.length}`);
      console.log(`Custom avatars: ${customAvatarsList.length}`);
      console.log(`Public avatars: ${publicAvatarsList.length}`);
      console.log('======================================');
      
      setCustomAvatars(customAvatarsList);
      setPublicAvatars(publicAvatarsList);
      return;
    }
    
    // Otherwise, fetch avatars
    setLoadingAvatars(true);
    try {
      const response = await listHeyGenAvatars();
      // Handle different response structures
      let avatarList: HeyGenAvatar[] = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          avatarList = response.data;
        } else {
          // Handle case where data might be an object with avatars property
          const dataAny = response.data as any;
          if (dataAny && typeof dataAny === 'object' && 'avatars' in dataAny && Array.isArray(dataAny.avatars)) {
            avatarList = dataAny.avatars;
          }
        }
      }
      
      // Remove duplicates first based on avatar_id
      const uniqueAvatars = Array.from(
        new Map(avatarList.map(avatar => [avatar.avatar_id, avatar])).values()
      );
      
      // Separate custom avatars (UUID pattern) from public avatars
      const customAvatarsList = uniqueAvatars.filter(avatar => {
        const avatarId = avatar.avatar_id;
        const isUUID = /^[a-f0-9]{32}$/i.test(avatarId);
        // Custom avatars are UUIDs that are not explicitly marked as public
        return isUUID && avatar.is_public !== true && !avatar.avatar_id.includes('_public_');
      });
      
      // Public avatars are those that don't match UUID pattern or are explicitly marked as public
      // HeyGen public avatars typically have:
      // - Non-UUID IDs (descriptive names with underscores like "chad_expressive_20240910")
      // - Or explicitly marked as public
      const publicAvatarsList = uniqueAvatars.filter(avatar => {
        const avatarId = avatar.avatar_id;
        const isUUID = /^[a-f0-9]{32}$/i.test(avatarId);
        
        // If it's a UUID, it's custom (unless explicitly marked as public)
        if (isUUID) {
          return avatar.is_public === true || avatar.avatar_id.includes('_public_');
        }
        
        // Non-UUID IDs are public avatars
        return true;
      });
      
      // Log for debugging
      console.log('=== Avatar Separation Debug ===');
      console.log(`Total avatars from API: ${avatarList.length}`);
      console.log(`Unique avatars (after deduplication): ${uniqueAvatars.length}`);
      console.log(`Custom avatars (UUID): ${customAvatarsList.length}`);
      console.log(`Public avatars (non-UUID): ${publicAvatarsList.length}`);
      console.log('Sample custom avatar IDs:', customAvatarsList.slice(0, 3).map(a => a.avatar_id));
      console.log('Sample public avatar IDs:', publicAvatarsList.slice(0, 3).map(a => a.avatar_id));
      console.log('================================');
      
      setCustomAvatars(customAvatarsList);
      setPublicAvatars(publicAvatarsList);
      setAvatars(uniqueAvatars); // Keep for backward compatibility
      
      if (customAvatarsList.length > 0) {
        // Auto-select default avatar if available, otherwise first avatar
        const defaultAvatar = customAvatarsList.find(avatar => avatar.avatar_id === DEFAULT_AVATAR_ID);
        const currentSelectedExists = customAvatarsList.find(avatar => avatar.avatar_id === selectedAvatarId);
        
        // If default avatar is in the list, prefer it
        if (defaultAvatar) {
          setSelectedAvatarId(defaultAvatar.avatar_id);
        } 
        // If current selection doesn't exist in the list, select first avatar
        else if (!currentSelectedExists) {
          setSelectedAvatarId(customAvatarsList[0].avatar_id);
        }
        // Otherwise, keep the current selection
      }
    } catch (error: any) {
      console.error('Error fetching avatars:', error);
      setAvatarError(getErrorMessage(error) || 'Failed to fetch avatars');
      // Don't add placeholder avatars on error
      setCustomAvatars([]);
      setPublicAvatars([]);
    } finally {
      setLoadingAvatars(false);
    }
  };

  const handleCloseAvatarModal = () => {
    setShowAvatarModal(false);
    setAvatarError(null);
  };

  const handleConfirmAvatar = () => {
    if (selectedAvatarId && selectedAspectRatio) {
      setShowAvatarModal(false);
      handleCreateVideo(selectedAvatarId);
    }
  };

  const handleCreateVideo = async (avatarId?: string) => {
    setCreatingVideo(true);
    setVideoStatus('creating');
    setVideoError(null);
    setVideoUrl(null);

    try {
      // Always use the current editedContent (which may be the original or edited version)
      const contentToUse = editedContent;
      
      // Clean the script for HeyGen
      const cleanedScript = cleanScriptForHeyGen(contentToUse);

      // Create video with the current content (edited or original)
      // Use provided avatar ID or default
      const avatarToUse = avatarId || '32dbf2775e394a51a96c75e5aadeeb86';
      // Use the older voice ID that doesn't require ElevenLabs
      const voiceToUse = 'dc8f911974e1427d8c6b6ae5c0edf3c6';
      const createResponse = await createHeyGenVideo(
        contentToUse,
        avatarToUse,
        voiceToUse, // Use the older voice ID
        `Script ${script.id} - Video`,
        selectedAspectRatio // Pass the selected aspect ratio
      );

      const newVideoId = createResponse.data?.video_id;
      if (!newVideoId) {
        throw new Error('No video ID returned from HeyGen');
      }

      setVideoId(newVideoId);
      setVideoStatus('processing');

      // Poll for video status
      const pollStatus = async () => {
        const maxAttempts = 12; // 1 minute max (5 second intervals) - HeyGen videos typically take 1-3 minutes
        let attempts = 0;
        let consecutive404Errors = 0;
        const max404Errors = 3; // If we get 3 consecutive 404s, stop polling

        const poll = async () => {
          try {
            const statusResponse = await checkHeyGenVideoStatus(newVideoId);
            const status = statusResponse.data?.status;

            // Increment attempts for every poll
            attempts++;

            // If status is "processing" and we got it from our fallback (all endpoints 404),
            // treat it as a 404 error
            if (status === 'processing' && !statusResponse.data?.video_url) {
              consecutive404Errors++;
            } else if (status === 'completed' || status === 'failed') {
              // Reset 404 counter on valid status
              consecutive404Errors = 0;
            }

            // Stop if we've exceeded limits
            if (attempts >= maxAttempts || consecutive404Errors >= max404Errors) {
              setVideoStatus('processing');
              setVideoError(null);
              setCreatingVideo(false);
              console.log(`Stopped polling after ${attempts} attempts. Video ID: ${newVideoId}`);
              return; // Stop polling - user can manually check status
            }

            if (status === 'completed') {
              const finalVideoUrl = statusResponse.data?.video_url || null;
              setVideoStatus('completed');
              setVideoUrl(finalVideoUrl);
              setCreatingVideo(false);

              // Save video to Firebase
              if (user && db && finalVideoUrl) {
                try {
                  await addDoc(collection(db, 'videos'), {
                    userId: user.uid,
                    videoId: newVideoId,
                    videoUrl: finalVideoUrl,
                    thumbnailUrl: statusResponse.data?.thumbnail_url || null,
                    originalScript: script.content,
                    cleanedScript: cleanedScript,
                    title: `Script ${script.id} - Video`,
                    status: 'completed',
                    createdAt: Timestamp.now(),
                    completedAt: Timestamp.now(),
                  });
                } catch (saveError) {
                  console.error('Failed to save video to Firebase:', saveError);
                  // Don't throw - video was created successfully, just saving failed
                }
              }
              return;
            } else if (status === 'failed') {
              setVideoStatus('error');
              const errorData = statusResponse.data?.error;
              setVideoError(getErrorMessage(errorData) || 'Video generation failed');
              setCreatingVideo(false);
              return;
            } else if (status === 'processing' || status === 'pending') {
              // Continue polling if we haven't hit limits
              setTimeout(poll, 5000); // Poll every 5 seconds
            } else {
              // If status is undefined or unexpected, continue polling if we haven't hit limits
              setTimeout(poll, 5000);
            }
          } catch (error: any) {
            attempts++;
            consecutive404Errors++;
            
            // Stop if we've hit max attempts OR max consecutive 404s
            if (consecutive404Errors >= max404Errors || attempts >= maxAttempts) {
              setVideoStatus('processing');
              setVideoError(null);
              setCreatingVideo(false);
              console.log(`Stopped polling due to errors (${attempts} attempts, ${consecutive404Errors} consecutive errors). Video ID: ${newVideoId}`);
              return; // Stop polling
            }
            
            setTimeout(poll, 5000);
          }
        };

        // Start polling after a short delay
        setTimeout(poll, 3000);
      };

      pollStatus();
    } catch (error: any) {
      setVideoStatus('error');
      const errorMessage = getErrorMessage(error) || 'Failed to create video';
      setVideoError(errorMessage);
      setCreatingVideo(false);
      // Log full error details
      console.error('=== Video Creation Error ===');
      console.error('Error message:', errorMessage);
      console.error('Full error object:', error);
      console.error('Error stack:', error.stack);
      console.error('===========================');
    }
  };

  const handleCheckStatus = async () => {
    if (!videoId) return;
    
    setCheckingStatus(true);
    setVideoError(null);
    
    try {
      const statusResponse = await checkHeyGenVideoStatus(videoId);
      const status = statusResponse.data?.status;
      
      if (status === 'completed') {
        const finalVideoUrl = statusResponse.data?.video_url || null;
        setVideoStatus('completed');
        setVideoUrl(finalVideoUrl);
        
        // Save video to Firebase if we have the URL
        if (finalVideoUrl && user && db) {
          try {
            await addDoc(collection(db, 'videos'), {
              userId: user.uid,
              scriptId: script.id,
              videoId: videoId,
              videoUrl: finalVideoUrl,
              status: 'completed',
              createdAt: Timestamp.now(),
            });
            console.log('Video saved to Firestore');
          } catch (error) {
            console.error('Error saving video to Firestore:', error);
          }
        }
      } else if (status === 'failed') {
        setVideoStatus('error');
        const errorData = statusResponse.data?.error;
        setVideoError(getErrorMessage(errorData) || 'Video generation failed');
      } else {
        // Still processing
        setVideoStatus('processing');
      }
    } catch (error: any) {
      console.error('Error checking video status:', error);
      setVideoError(getErrorMessage(error) || 'Failed to check video status');
    } finally {
      setCheckingStatus(false);
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
            onClick={handleOpenAvatarModal}
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
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Edit</span>
            </button>
          )}
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
          <div className="flex items-start space-x-2">
            <svg className="animate-spin w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="flex-1">
              <p className="font-medium">Your video is being generated. This may take a few minutes...</p>
              {videoId && (
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <p className="text-sm opacity-75">
                    Video ID: {videoId.substring(0, 8)}...
                  </p>
                  <button
                    onClick={handleCheckStatus}
                    disabled={checkingStatus}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    {checkingStatus ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Check Status</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
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
        {isEditing ? (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full min-h-[300px] p-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none resize-y text-base sm:text-lg leading-relaxed font-mono"
              placeholder="Edit your script here..."
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSaveEdit}
                className="flex items-center space-x-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Save Changes</span>
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center space-x-2 px-5 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-base sm:text-lg">
              {editedContent}
            </p>
          </div>
        )}
      </div>

      {/* Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Select Avatar
                </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Choose an avatar for your video
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleConfirmAvatar}
                    disabled={!selectedAvatarId || !selectedAspectRatio || loadingAvatars || creatingVideo}
                    className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                      selectedAvatarId && selectedAspectRatio
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {creatingVideo ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Creating...</span>
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
                  onClick={handleCloseAvatarModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              </div>
            </div>

            <div className="p-6">
              {loadingAvatars ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading avatars...</span>
                </div>
              ) : avatarError ? (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl">
                  <p className="font-medium">{avatarError}</p>
                </div>
              ) : (
                <>
                  {/* My Avatars Section */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      My Avatars
                    </h3>
                    {customAvatars.length === 0 && !loadingAvatars ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">No custom avatars available</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Custom avatars have UUID-like IDs (32 hex characters)</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {customAvatars.map((avatar) => (
                          <button
                            key={avatar.avatar_id}
                            onClick={() => setSelectedAvatarId(avatar.avatar_id)}
                            className={`relative p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                              selectedAvatarId === avatar.avatar_id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <div className="w-full h-32 rounded-lg mb-2 overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center relative">
                              {(avatar.preview_image_url || avatar.preview_url) && !imageErrors.has(avatar.avatar_id) ? (
                                <img
                                  src={avatar.preview_image_url || avatar.preview_url || ''}
                                  alt={avatar.name || avatar.avatar_name || 'Avatar'}
                                  className="w-full h-full object-cover"
                                  onError={() => {
                                    setImageErrors(prev => new Set(prev).add(avatar.avatar_id));
                                  }}
                                />
                              ) : (
                                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={avatar.name || avatar.avatar_name || 'Avatar'}>
                              {avatar.name || avatar.avatar_name || 'Avatar'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1" title={avatar.avatar_id}>
                              ID: {avatar.avatar_id.substring(0, 12)}...
                            </p>
                            {selectedAvatarId === avatar.avatar_id && (
                              <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Video Aspect Ratio Selection */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Video Format
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-6">
                {(Object.keys(VIDEO_ASPECT_RATIOS) as VideoAspectRatio[]).map((ratio) => {
                  const ratioInfo = VIDEO_ASPECT_RATIOS[ratio];
                  const isSelected = selectedAspectRatio === ratio;
                  
                  // Calculate aspect ratio for visual representation
                  const aspectRatio = ratioInfo.dimensions.width / ratioInfo.dimensions.height;
                  
                  // Use a larger base size and scale appropriately
                  // Landscape: 16:9 = 1.78 (wide)
                  // Vertical: 9:16 = 0.56 (tall)
                  // Square: 1:1 = 1.0
                  // Portrait: 4:5 = 0.8
                  
                  // For better visual representation, use a base width for landscape
                  // and scale others proportionally
                  const baseWidth = 160; // Base width for landscape
                  let cardWidth: number;
                  let cardHeight: number;
                  
                  if (ratio === 'landscape') {
                    cardWidth = baseWidth;
                    cardHeight = baseWidth / aspectRatio; // 160 / 1.78 ≈ 90
                  } else if (ratio === 'vertical') {
                    cardHeight = baseWidth; // Use baseWidth as height for vertical
                    cardWidth = baseWidth * aspectRatio; // 160 * 0.56 ≈ 90
                  } else if (ratio === 'square') {
                    cardWidth = baseWidth;
                    cardHeight = baseWidth; // 1:1 ratio
                  } else { // portrait
                    cardHeight = baseWidth;
                    cardWidth = baseWidth * aspectRatio; // 160 * 0.8 = 128
                  }
                  
                  return (
                    <button
                      key={ratio}
                      onClick={() => setSelectedAspectRatio(ratio)}
                      className={`relative rounded-xl border-2 transition-all duration-200 transform hover:scale-105 overflow-hidden flex-shrink-0 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg ring-2 ring-blue-300 dark:ring-blue-700'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                      }`}
                      style={{
                        width: `${cardWidth}px`,
                        height: `${cardHeight}px`,
                        minWidth: `${cardWidth}px`,
                        minHeight: `${cardHeight}px`
                      }}
                    >
                      {/* Visual representation of aspect ratio */}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center ${
                        isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-200 dark:bg-gray-600'
                      }`}>
                        <div className="text-center px-2 py-1">
                          <div className={`text-xs font-semibold mb-0.5 ${
                            isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {ratioInfo.label.split(' ')[0]}
                          </div>
                          <div className={`text-[10px] leading-tight ${
                            isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {ratioInfo.usage.split(',')[0]}
                          </div>
                          <div className={`text-[9px] mt-0.5 ${
                            isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {ratioInfo.dimensions.width}×{ratioInfo.dimensions.height}
                          </div>
                        </div>
                      </div>
                      
                      {/* Info overlay on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-70 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
                        <div className="text-white text-center px-2 py-1">
                          <div className="text-xs font-semibold">{ratioInfo.label}</div>
                          <div className="text-[10px] mt-0.5 leading-tight">{ratioInfo.usage}</div>
                          <div className="text-[10px] mt-1">{ratioInfo.dimensions.width} × {ratioInfo.dimensions.height}</div>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-1 z-10 shadow-md">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Public Avatars Section */}
            {publicAvatars.length > 0 && (
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Public Avatars
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    ({publicAvatars.length} available)
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {publicAvatars.map((avatar) => (
                    <button
                      key={avatar.avatar_id}
                      onClick={() => setSelectedAvatarId(avatar.avatar_id)}
                      className={`relative p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                        selectedAvatarId === avatar.avatar_id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="w-full h-32 rounded-lg mb-2 overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center relative">
                        {(avatar.preview_image_url || avatar.preview_url) && !imageErrors.has(avatar.avatar_id) ? (
                          <img
                            src={avatar.preview_image_url || avatar.preview_url || ''}
                            alt={avatar.name || avatar.avatar_name || 'Avatar'}
                            className="w-full h-full object-cover"
                            onError={() => {
                              setImageErrors(prev => new Set(prev).add(avatar.avatar_id));
                            }}
                          />
                        ) : (
                          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={avatar.name || avatar.avatar_name || 'Avatar'}>
                        {avatar.name || avatar.avatar_name || 'Avatar'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1" title={avatar.avatar_id}>
                        ID: {avatar.avatar_id.substring(0, 12)}...
                      </p>
                      {selectedAvatarId === avatar.avatar_id && (
                        <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                </div>
              )}

          </div>
        </div>
      )}
    </div>
  );
}

