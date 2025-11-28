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

    const voicesResponse = await fetch(`${HEYGEN_API_BASE}/voices`, {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!voicesResponse.ok) {
      const errorData = await voicesResponse.json().catch(() => ({}));
      return NextResponse.json(
        { 
          error: errorData.message || `HeyGen API error: ${voicesResponse.statusText}`,
          details: errorData 
        },
        { status: voicesResponse.status }
      );
    }

    const voicesData = await voicesResponse.json();
    return NextResponse.json(voicesData);
  } catch (error: any) {
    console.error('Error fetching voices:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch voices' },
      { status: 500 }
    );
  }
}

