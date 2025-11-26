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

