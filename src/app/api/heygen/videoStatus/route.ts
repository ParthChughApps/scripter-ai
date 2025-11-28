import { NextRequest, NextResponse } from 'next/server';

// HeyGen API Base URL - V2 API
const HEYGEN_API_BASE = 'https://api.heygen.com/v2';

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

    const statusResponse = await fetch(`${HEYGEN_API_BASE}/video_status?video_id=${videoId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!statusResponse.ok) {
      const errorData = await statusResponse.json().catch(() => ({}));
      return NextResponse.json(
        { 
          error: errorData.message || `HeyGen API error: ${statusResponse.statusText}`,
          details: errorData 
        },
        { status: statusResponse.status }
      );
    }

    const statusData = await statusResponse.json();
    return NextResponse.json(statusData);
  } catch (error: any) {
    console.error('Error checking video status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check video status' },
      { status: 500 }
    );
  }
}

