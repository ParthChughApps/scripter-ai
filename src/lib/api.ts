export interface Script {
  id: number;
  content: string;
}

export interface ScriptResponse {
  scripts: Script[];
}

export interface ScriptSet {
  id?: string;
  userId: string;
  topic: string;
  scripts: Script[];
  timestamp: Date;
}

export const generateScripts = async (
  topic: string,
  numVariations: number = 3
): Promise<ScriptResponse> => {
  const response = await fetch('/api/generateScripts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ topic, numVariations }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate scripts');
  }

  return response.json();
};

// HeyGen API interfaces
export interface HeyGenAvatar {
  avatar_id: string;
  name?: string;
  avatar_name?: string;
  preview_url?: string; // Legacy field name
  preview_image_url?: string; // Actual field name from HeyGen API
  preview_video_url?: string;
  gender?: string;
  premium?: boolean;
  type?: string | null;
  tags?: string | null;
  default_voice_id?: string | null;
  // Fields that might indicate ownership/custom avatars
  owner?: string;
  owner_id?: string;
  is_custom?: boolean;
  is_public?: boolean;
  avatar_type?: string;
  created_by?: string;
  user_id?: string;
  [key: string]: any; // Allow additional fields we might discover
}

export interface HeyGenVoice {
  voice_id: string;
  name?: string;
  language?: string;
  gender?: string;
}

export interface HeyGenVideoResponse {
  data: {
    video_id: string;
    status?: string;
  };
}

export interface HeyGenVideoStatus {
  data: {
    video_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    video_url?: string;
    thumbnail_url?: string;
    error?: string;
  };
}

export interface GeneratedVideo {
  id?: string;
  userId: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  originalScript: string;
  cleanedScript: string;
  title?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

// Video aspect ratio types
export type VideoAspectRatio = 'landscape' | 'vertical' | 'square' | 'portrait';

export interface VideoDimensions {
  width: number;
  height: number;
}

export const VIDEO_ASPECT_RATIOS: Record<VideoAspectRatio, { dimensions: VideoDimensions; label: string; usage: string }> = {
  landscape: {
    dimensions: { width: 1920, height: 1080 },
    label: 'Landscape (16:9)',
    usage: 'YouTube, Courses'
  },
  vertical: {
    dimensions: { width: 1080, height: 1920 },
    label: 'Vertical (9:16)',
    usage: 'Reels, Shorts, TikTok'
  },
  square: {
    dimensions: { width: 1080, height: 1080 },
    label: 'Square (1:1)',
    usage: 'Instagram Feed'
  },
  portrait: {
    dimensions: { width: 1080, height: 1350 },
    label: 'Portrait (4:5)',
    usage: 'Stories, Ads'
  }
};

// HeyGen API functions
export const createHeyGenVideo = async (
  script: string,
  avatarId?: string,
  voiceId?: string,
  videoTitle?: string,
  aspectRatio?: VideoAspectRatio
): Promise<HeyGenVideoResponse> => {
  const response = await fetch('/api/heygen/createVideo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      script,
      avatarId,
      voiceId,
      videoTitle,
      aspectRatio,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    // Log full error details to console for debugging
    console.error('HeyGen API Error Response:', {
      status: response.status,
      statusText: response.statusText,
      error: error,
      fullResponse: error,
    });
    throw new Error(error.error || error.message || `HeyGen API error: ${response.statusText}`);
  }

  return response.json();
};

export const checkHeyGenVideoStatus = async (
  videoId: string
): Promise<HeyGenVideoStatus> => {
  const response = await fetch(`/api/heygen/videoStatus?videoId=${encodeURIComponent(videoId)}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to check video status');
  }

  return response.json();
};

export const listHeyGenAvatars = async (): Promise<{ data: HeyGenAvatar[] }> => {
  const response = await fetch('/api/heygen/listAvatars', {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch avatars');
  }

  return response.json();
};

export const listHeyGenVoices = async (): Promise<{ data: HeyGenVoice[] }> => {
  const response = await fetch('/api/heygen/listVoices', {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch voices');
  }

  return response.json();
};

