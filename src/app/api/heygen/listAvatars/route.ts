import { NextRequest, NextResponse } from 'next/server';

// HeyGen API Base URL - V2 API
const HEYGEN_API_BASE = 'https://api.heygen.com/v2';

export async function GET(request: NextRequest) {
  try {
    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HeyGen API key not configured' },
        { status: 500 }
      );
    }

    const avatarsResponse = await fetch(`${HEYGEN_API_BASE}/avatars`, {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!avatarsResponse.ok) {
      const errorData = await avatarsResponse.json().catch(() => ({}));
      return NextResponse.json(
        { 
          error: errorData.message || `HeyGen API error: ${avatarsResponse.statusText}`,
          details: errorData 
        },
        { status: avatarsResponse.status }
      );
    }

    const avatarsData = await avatarsResponse.json();
    return NextResponse.json(avatarsData);
  } catch (error: any) {
    console.error('Error fetching avatars:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch avatars' },
      { status: 500 }
    );
  }
}

