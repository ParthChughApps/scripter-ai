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
  preview_url?: string;
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

// HeyGen API functions
export const createHeyGenVideo = async (
  script: string,
  avatarId?: string,
  voiceId?: string,
  videoTitle?: string
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
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create video');
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

