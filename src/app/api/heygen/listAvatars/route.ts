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
      cache: 'no-store', // Disable caching to avoid 2MB limit issue
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
    
    // Log response metadata to check for pagination or filtering
    console.log('=== HeyGen API Response Metadata ===');
    console.log('Response keys:', Object.keys(avatarsData));
    if (avatarsData.data) {
      console.log('Data keys:', Object.keys(avatarsData.data));
      console.log('Total avatars in response:', Array.isArray(avatarsData.data.avatars) ? avatarsData.data.avatars.length : 'N/A');
      console.log('Has pagination info:', {
        total: avatarsData.data.total,
        page: avatarsData.data.page,
        has_next: avatarsData.data.has_next,
        has_prev: avatarsData.data.has_prev,
      });
    }
    console.log('===================================');
    
    // Return response with no caching
    return NextResponse.json(avatarsData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('Error fetching avatars:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch avatars' },
      { status: 500 }
    );
  }
}

