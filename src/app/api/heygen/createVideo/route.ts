import { NextRequest, NextResponse } from 'next/server';

// HeyGen API Base URL - V2 API
// Documentation: https://docs.heygen.com
const HEYGEN_API_BASE = 'https://api.heygen.com/v2';

export async function POST(request: NextRequest) {
  try {
    const { script, avatarId, voiceId, videoTitle } = await request.json();

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

    // Create video request - Using V2 API format
    // Documentation: https://docs.heygen.com/reference/create-avatar-video-v2
    const requestBody: any = {
      video_inputs: [
        {
          character: {
            type: 'avatar',
            ...(avatarId && { avatar_id: avatarId }),
          },
          voice: {
            type: 'text',
            input_text: script,
            ...(voiceId && { voice_id: voiceId }),
          },
        },
      ],
      dimension: {
        width: 1280,
        height: 720,
      },
    };

    // Add optional fields
    if (videoTitle) {
      requestBody.title = videoTitle;
    }

    const createVideoResponse = await fetch(`${HEYGEN_API_BASE}/video/generate`, {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!createVideoResponse.ok) {
      const errorText = await createVideoResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || createVideoResponse.statusText };
      }
      
      console.error('HeyGen API error details:', {
        status: createVideoResponse.status,
        statusText: createVideoResponse.statusText,
        url: `${HEYGEN_API_BASE}/video/generate`,
        error: errorData,
        requestBody: {
          video_inputs: [{ character: { type: 'avatar' }, voice: { type: 'text', input_text: script.substring(0, 50) + '...' } }]
        }
      });
      
      return NextResponse.json(
        { 
          error: errorData.message || errorData.error || `HeyGen API error: ${createVideoResponse.statusText}`,
          details: errorData,
          status: createVideoResponse.status,
          hint: 'Please verify the API endpoint and request format in HeyGen documentation'
        },
        { status: createVideoResponse.status }
      );
    }

    const videoData = await createVideoResponse.json();
    return NextResponse.json(videoData);
  } catch (error: any) {
    console.error('Error creating HeyGen video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create video' },
      { status: 500 }
    );
  }
}

