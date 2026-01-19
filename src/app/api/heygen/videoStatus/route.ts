import { NextRequest, NextResponse } from 'next/server';

// HeyGen API Base URL - V2 API
const HEYGEN_API_BASE = 'https://api.heygen.com/v2';

// Mark this route as dynamic (not statically generated)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HeyGen API key not configured' },
        { status: 500 }
      );
    }

    // Try multiple possible endpoints for video status
    // HeyGen API might use query parameters or different formats
    const endpointsToTry = [
      { url: `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, method: 'GET' },  // V1 status endpoint (from docs)
      { url: `${HEYGEN_API_BASE}/video/${videoId}`, method: 'GET' },  // V2 format
      { url: `${HEYGEN_API_BASE}/video/query?video_id=${videoId}`, method: 'GET' },  // Query parameter format
      { url: `${HEYGEN_API_BASE}/video/status/${videoId}`, method: 'GET' },  // Alternative format
      { url: `${HEYGEN_API_BASE}/videos/${videoId}`, method: 'GET' },  // Plural format
      { url: `${HEYGEN_API_BASE}/video/query`, method: 'POST', body: { video_id: videoId } },  // POST with body
      { url: `https://api.heygen.com/v1/video/${videoId}`, method: 'GET' },  // V1 format
    ];

    let statusResponse: Response | null = null;
    let usedEndpoint = '';
    let lastError: any = null;

    // Try each endpoint until one works
    // Only log first attempt to reduce spam
    let isFirstAttempt = true;
    for (const endpointConfig of endpointsToTry) {
      try {
        if (isFirstAttempt) {
          console.log(`Checking HeyGen video status for: ${videoId.substring(0, 8)}...`);
          isFirstAttempt = false;
        }
        
        const fetchOptions: RequestInit = {
          method: endpointConfig.method,
          headers: {
            'X-Api-Key': process.env.HEYGEN_API_KEY!,
            'Accept': 'application/json',
            ...(endpointConfig.method === 'POST' && { 'Content-Type': 'application/json' }),
          },
        };

        if (endpointConfig.method === 'POST' && endpointConfig.body) {
          fetchOptions.body = JSON.stringify(endpointConfig.body);
        }
        
        statusResponse = await fetch(endpointConfig.url, fetchOptions);

        usedEndpoint = endpointConfig.url;
        
        // If we get a non-404 response, use this endpoint
        if (statusResponse.status !== 404) {
          console.log(`✓ Status endpoint found: ${endpointConfig.url} (status: ${statusResponse.status})`);
          break;
        } else {
          lastError = { status: 404, endpoint: endpointConfig.url };
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (!statusResponse || statusResponse.status === 404) {
      // If all endpoints return 404, the video might still be processing
      // Return a "processing" status instead of an error to allow retries
      // Log only occasionally to reduce spam (every 10th request)
      const shouldLog = Math.random() < 0.1; // 10% chance to log
      if (shouldLog) {
        console.warn(`HeyGen status endpoint not available for video ${videoId.substring(0, 8)}... (likely still processing)`);
      }
      
      // Return a processing status instead of error - allows frontend to retry
      return NextResponse.json({
        data: {
          video_id: videoId,
          status: 'processing',
          message: 'Video is being generated. Status endpoint not available yet. Please check again in a few moments.',
        },
        hint: 'HeyGen videos typically take 1-3 minutes. The status endpoint may not be immediately available after creation.',
      });
    }

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || statusResponse.statusText };
      }
      
      console.error('HeyGen status API error:', {
        status: statusResponse.status,
        statusText: statusResponse.statusText,
        endpoint: usedEndpoint,
        videoId: videoId,
        error: errorData,
      });
      
      return NextResponse.json(
        { 
          error: errorData.message || `HeyGen API error: ${statusResponse.statusText}`,
          details: errorData,
          endpoint: usedEndpoint,
        },
        { status: statusResponse.status }
      );
    }

    const statusData = await statusResponse.json();
    console.log('Video status retrieved successfully:', {
      videoId: videoId,
      status: statusData.data?.status,
      endpoint: usedEndpoint,
    });
    
    return NextResponse.json(statusData);
  } catch (error: any) {
    console.error('Error checking video status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check video status' },
      { status: 500 }
    );
  }
}

