import { NextRequest, NextResponse } from 'next/server';
import { cleanScriptForHeyGen } from '@/lib/scriptUtils';

// HeyGen API Base URL - V2 API
// Documentation: https://docs.heygen.com
const HEYGEN_API_BASE = 'https://api.heygen.com/v2';

export async function POST(request: NextRequest) {
  try {
    const { script, avatarId, voiceId, videoTitle, aspectRatio } = await request.json();

    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      return NextResponse.json(
        { error: 'Script is required' },
        { status: 400 }
      );
    }

    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HeyGen API key not configured. Please add HEYGEN_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    // Default voice if not provided
    const fallbackVoiceId = 'dc8f911974e1427d8c6b6ae5c0edf3c6'; // Your account's voice (older voice ID)
    // Default avatar ID
    const defaultAvatarIdValue = '32dbf2775e394a51a96c75e5aadeeb86'; // Nikhil Batra
    let defaultAvatarId = avatarId || defaultAvatarIdValue;
    // Use the correct voice ID for the default avatar
    let defaultVoiceId = voiceId || fallbackVoiceId;

    // Clean the script to remove brackets and special markers for HeyGen
    const cleanedScript = cleanScriptForHeyGen(script);

    // Use the provided avatar ID or the default
    if (defaultAvatarId === defaultAvatarIdValue) {
      console.log('✓ Using default avatar:', defaultAvatarId);
    } else {
      console.log('✓ Using provided avatar:', defaultAvatarId);
    }

    // Validate we have required IDs
    if (!defaultAvatarId) {
      return NextResponse.json(
        { 
          error: 'Avatar ID is required.',
          hint: 'Please provide an avatar_id.',
        },
        { status: 400 }
      );
    }

    // Both avatar and voice are now set with your account's IDs

    console.log('Creating video with:', {
      avatarId: defaultAvatarId,
      voiceId: defaultVoiceId,
      scriptLength: cleanedScript.length,
    });

    // Determine video dimensions based on aspect ratio
    const VIDEO_ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
      landscape: { width: 1920, height: 1080 }, // 16:9 - YouTube, Courses
      vertical: { width: 1080, height: 1920 }, // 9:16 - Reels, Shorts, TikTok
      square: { width: 1080, height: 1080 }, // 1:1 - Instagram Feed
      portrait: { width: 1080, height: 1350 }, // 4:5 - Stories, Ads
    };
    
    // Default to vertical if not specified
    const selectedAspectRatio = aspectRatio || 'vertical';
    const dimensions = VIDEO_ASPECT_RATIOS[selectedAspectRatio] || VIDEO_ASPECT_RATIOS.vertical;
    
    console.log(`Using aspect ratio: ${selectedAspectRatio} (${dimensions.width}x${dimensions.height})`);

    // Create video request - Using V2 API format
    // Documentation: https://docs.heygen.com/reference/create-avatar-video-v2
    const requestBody: any = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: defaultAvatarId, // Use the resolved avatar ID
          },
          voice: {
            type: 'text',
            input_text: cleanedScript,
            voice_id: defaultVoiceId, // Use the resolved voice ID
          },
        },
      ],
      dimension: {
        width: dimensions.width,
        height: dimensions.height,
      },
    };
    
    // Log the exact request being sent
    console.log('Request body being sent:', JSON.stringify({
      ...requestBody,
      video_inputs: [{
        character: { type: requestBody.video_inputs[0].character.type, avatar_id: requestBody.video_inputs[0].character.avatar_id },
        voice: { type: requestBody.video_inputs[0].voice.type, voice_id: requestBody.video_inputs[0].voice.voice_id, input_text: cleanedScript.substring(0, 50) + '...' }
      }]
    }, null, 2));

    // Add optional fields
    if (videoTitle) {
      requestBody.title = videoTitle;
    }

    // Try different possible endpoints - HeyGen API endpoint might vary
    const endpointsToTry = [
      { url: `${HEYGEN_API_BASE}/video/generate`, body: requestBody, version: 'v2' },
      { url: 'https://api.heygen.com/v1/video/generate', body: { avatar_id: defaultAvatarId, voice_id: defaultVoiceId, text: cleanedScript, ...(videoTitle && { title: videoTitle }) }, version: 'v1' },
      { url: `${HEYGEN_API_BASE}/videos/generate`, body: requestBody, version: 'v2-plural' },
    ];

    let createVideoResponse: Response | null = null;
    let usedEndpoint = '';
    let lastError: any = null;

    // Try each endpoint until one works
    for (const endpointConfig of endpointsToTry) {
      try {
        console.log(`Trying HeyGen endpoint: ${endpointConfig.url} (${endpointConfig.version})`);
        
        createVideoResponse = await fetch(endpointConfig.url, {
          method: 'POST',
          headers: {
            'X-Api-Key': process.env.HEYGEN_API_KEY!,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(endpointConfig.body),
        });

        // Log response for debugging
        if (createVideoResponse.status === 404) {
          const errorText = await createVideoResponse.text().catch(() => '');
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          
          // Check if it's an avatar/voice not found error
          const errorTextLower = errorText.toLowerCase();
          const errorDataStr = JSON.stringify(errorData).toLowerCase();
          if (errorData.error?.code === 'avatar_not_found' || 
              errorTextLower.includes('avatar') && (errorTextLower.includes('not found') || errorTextLower.includes('not_found')) ||
              errorDataStr.includes('avatar') && (errorDataStr.includes('not found') || errorDataStr.includes('not_found'))) {
            console.error(`Avatar not found error: ${errorData.error?.message || errorText}`);
            console.error(`Avatar ID used: ${defaultAvatarId}`);
            // Don't try other endpoints if it's an avatar issue - they'll all fail
            return NextResponse.json(
              { 
                error: `Avatar not found: ${defaultAvatarId}`,
                details: errorData,
                hint: `The avatar ID "${defaultAvatarId}" was not found in your HeyGen account. Please verify the avatar ID in your HeyGen dashboard or use the /api/heygen/listAvatars endpoint to get available avatars.`,
              },
              { status: 404 }
            );
          }
          
          console.log(`Endpoint ${endpointConfig.url} returned 404: ${errorText.substring(0, 100)}`);
        }

        usedEndpoint = endpointConfig.url;
        
        // If we get a non-404 response, use this endpoint (even if it's an error, we know the endpoint exists)
        if (createVideoResponse.status !== 404) {
          console.log(`✓ Endpoint ${endpointConfig.url} returned status ${createVideoResponse.status}`);
          // If it's a 400, log the error details
          if (createVideoResponse.status === 400) {
            const errorText = await createVideoResponse.text().catch(() => '');
            try {
              const errorData = JSON.parse(errorText);
              console.error('400 Bad Request details:', JSON.stringify(errorData, null, 2));
              console.error('Request body sent:', JSON.stringify(endpointConfig.body, null, 2));
            } catch {
              console.error('400 Bad Request response:', errorText);
            }
          }
          break;
        } else {
          console.log(`✗ Endpoint ${endpointConfig.url} returned 404, trying next...`);
          lastError = { status: 404, endpoint: endpointConfig.url };
        }
      } catch (error) {
        console.error(`Error trying endpoint ${endpointConfig.url}:`, error);
        lastError = error;
        continue;
      }
    }

    if (!createVideoResponse || createVideoResponse.status === 404) {
      const errorMessage = 'HeyGen API endpoint not found or video creation failed.';
      console.error('=== All HeyGen endpoints failed ===');
      console.error('Tried endpoints:', endpointsToTry.map(e => e.url));
      console.error('Last error:', lastError);
      console.error('API Key configured:', !!process.env.HEYGEN_API_KEY);
      console.error('==================================');
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: {
            triedEndpoints: endpointsToTry.map(e => e.url),
            lastError: lastError,
          },
          hint: 'This could be due to: 1) Insufficient credits in your HeyGen account, 2) Invalid API key, or 3) API endpoint changes. Please check your HeyGen dashboard for credits and verify your API key.',
        },
        { status: 404 }
      );
    }

    if (!createVideoResponse.ok) {
      const errorText = await createVideoResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || createVideoResponse.statusText };
      }
      
      // Log detailed error information
      const errorDetails = {
        status: createVideoResponse.status,
        statusText: createVideoResponse.statusText,
        url: usedEndpoint,
        error: errorData,
        errorText: errorText,
        requestBody: {
          video_inputs: [{ character: { type: 'avatar' }, voice: { type: 'text', input_text: cleanedScript.substring(0, 50) + '...' } }]
        },
        apiKeyPrefix: process.env.HEYGEN_API_KEY?.substring(0, 15),
      };
      
      // Log to console (will show in terminal where Next.js dev server is running)
      console.error('=== HeyGen API Error ===');
      console.error('Status:', errorDetails.status);
      console.error('Status Text:', errorDetails.statusText);
      console.error('Endpoint:', usedEndpoint);
      console.error('Error Data:', JSON.stringify(errorData, null, 2));
      console.error('Error Text:', errorText);
      console.error('API Key Prefix:', errorDetails.apiKeyPrefix);
      console.error('========================');
      
      // Provide more helpful error messages based on status code
      let errorMessage = errorData.message || errorData.error || createVideoResponse.statusText;
      let hint = '';
      
      // Check for avatar not found errors (can come as 400, 404, or other status codes)
      const errorTextLower = errorText.toLowerCase();
      const errorMessageLower = (errorMessage || '').toLowerCase();
      const errorDataStr = JSON.stringify(errorData).toLowerCase();
      
      if (errorTextLower.includes('avatar') && (errorTextLower.includes('not found') || errorTextLower.includes('not_found') || 
          errorMessageLower.includes('avatar') && (errorMessageLower.includes('not found') || errorMessageLower.includes('not_found')) ||
          errorDataStr.includes('avatar') && (errorDataStr.includes('not found') || errorDataStr.includes('not_found')) ||
          errorData.error?.code === 'avatar_not_found')) {
        errorMessage = `Avatar not found: ${defaultAvatarId}`;
        hint = `The avatar ID "${defaultAvatarId}" was not found in your HeyGen account. This could mean: 1) The avatar ID is incorrect, 2) The avatar is in draft/pending state, 3) The avatar belongs to a different account/workspace. Please check available avatars using the /api/heygen/listAvatars endpoint or verify the avatar ID in your HeyGen dashboard.`;
        console.error('Avatar not found - Full error details:', JSON.stringify(errorData, null, 2));
      } 
      // Check for ElevenLabs subscription errors
      else if (errorTextLower.includes('elevenlabs') || errorMessageLower.includes('elevenlabs') || 
          errorTextLower.includes('subscription') || errorMessageLower.includes('subscription')) {
        errorMessage = 'Voice requires ElevenLabs subscription';
        hint = `The voice ID "${defaultVoiceId}" requires an active ElevenLabs subscription. Please either: 1) Activate your ElevenLabs subscription in your HeyGen account, 2) Use a different voice ID that doesn't require ElevenLabs, or 3) Check available voices using the /api/heygen/listVoices endpoint.`;
      } else if (createVideoResponse.status === 404) {
        errorMessage = 'HeyGen API endpoint not found (404). The API endpoint may have changed.';
        hint = 'Tried multiple endpoints but all returned 404. Please check HeyGen API documentation at https://docs.heygen.com for the correct endpoint.';
      } else if (createVideoResponse.status === 401 || createVideoResponse.status === 403) {
        errorMessage = 'HeyGen API authentication failed. Please check your API key.';
        hint = 'Verify your HEYGEN_API_KEY is correct and has the necessary permissions.';
      } else if (createVideoResponse.status === 400) {
        errorMessage = errorData.error?.message || errorData.message || 'Invalid request format.';
        hint = `HeyGen API validation error: ${JSON.stringify(errorData.error || errorData, null, 2)}. Check that the request body matches HeyGen API requirements.`;
        console.error('HeyGen 400 Error Details:', JSON.stringify(errorData, null, 2));
      }
      
      // Return error with full details for debugging
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorData,
          status: createVideoResponse.status,
          hint: hint || 'Please verify the API endpoint and request format in HeyGen documentation',
          endpoint: usedEndpoint,
          debug: {
            triedEndpoints: endpointsToTry.map(e => e.url),
            apiKeyConfigured: !!process.env.HEYGEN_API_KEY,
            usedEndpoint: usedEndpoint,
          }
        },
        { status: createVideoResponse.status }
      );
    }

    const videoData = await createVideoResponse.json();
    
    // Log the response structure for debugging
    console.log('HeyGen video creation response:', {
      hasData: !!videoData.data,
      videoId: videoData.data?.video_id || videoData.video_id,
      fullResponse: JSON.stringify(videoData, null, 2).substring(0, 500), // First 500 chars
    });
    
    // Return video data along with cleaned script for storage
    return NextResponse.json({
      ...videoData,
      cleanedScript, // Include cleaned script in response
    });
  } catch (error: any) {
    console.error('Error creating HeyGen video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create video' },
      { status: 500 }
    );
  }
}

