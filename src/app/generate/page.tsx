'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { Loader } from '@/components/Loader';
import { ScriptCard } from '@/components/ScriptCard';
import { generateScripts, Script, ScriptResponse, listHeyGenAvatars, HeyGenAvatar } from '@/lib/api';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Known custom avatar IDs - add your avatar IDs here as a fallback
// This ensures your avatars show up even if the API doesn't return them
const KNOWN_CUSTOM_AVATAR_IDS = [
  '32dbf2775e394a51a96c75e5aadeeb86', // Nikhil Batra
  'dd696b5968a94f08a047b2e80c86ca69', // Your second avatar
];

// Filter function to get only custom avatars
// Custom avatars have UUID-like IDs (32 hex characters, no underscores)
// Public avatars have descriptive names with underscores or "_public_" in them
function filterCustomAvatars(avatars: HeyGenAvatar[]): HeyGenAvatar[] {
  if (avatars.length === 0) return [];
  
  console.log('=== Avatar Filtering Debug ===');
  console.log(`Total avatars received: ${avatars.length}`);
  
  // Log all avatar IDs before filtering
  console.log('All avatar IDs:', avatars.map(a => ({
    id: a.avatar_id,
    name: a.avatar_name || a.name,
    matchesUUID: /^[a-f0-9]{32}$/i.test(a.avatar_id)
  })));
  
  // First, remove duplicates based on avatar_id
  const uniqueAvatars = Array.from(
    new Map(avatars.map(avatar => [avatar.avatar_id, avatar])).values()
  );
  
  console.log(`After deduplication: ${uniqueAvatars.length} unique avatars`);
  
  // Check for UUID pattern matches
  const uuidMatches = uniqueAvatars.filter(avatar => {
    const avatarId = avatar.avatar_id;
    return /^[a-f0-9]{32}$/i.test(avatarId);
  });
  
  console.log(`Avatars matching UUID pattern (32 hex chars): ${uuidMatches.length}`);
  uuidMatches.forEach(avatar => {
    console.log(`  - ${avatar.avatar_name || avatar.name || 'Unnamed'}: ${avatar.avatar_id}`);
  });
  
  // Specifically check for the user's known custom avatar IDs
  const knownCustomIds = ['32dbf2775e394a51a96c75e5aadeeb86', 'dd696b5968a94f08a047b2e80c86ca69'];
  console.log('\n=== Checking for known custom avatar IDs ===');
  knownCustomIds.forEach(targetId => {
    const found = uniqueAvatars.find(a => a.avatar_id === targetId);
    if (found) {
      console.log(`✓ Found: ${targetId} - ${found.avatar_name || found.name || 'Unnamed'}`);
    } else {
      console.log(`✗ NOT FOUND: ${targetId} - This avatar is not in the API response!`);
      // Check if there's a similar ID (case-insensitive)
      const similar = uniqueAvatars.find(a => a.avatar_id.toLowerCase() === targetId.toLowerCase());
      if (similar) {
        console.log(`  ⚠️ Found similar (case difference): ${similar.avatar_id}`);
      }
    }
  });
  console.log('============================================\n');
  
  // Check for non-UUID but potentially custom avatars
  const nonUUIDAvatars = uniqueAvatars.filter(avatar => {
    const avatarId = avatar.avatar_id;
    return !/^[a-f0-9]{32}$/i.test(avatarId) && 
           !avatarId.includes('_public_') &&
           !/^[A-Z][a-z]+_[a-z_]+$/i.test(avatarId);
  });
  
  if (nonUUIDAvatars.length > 0) {
    console.log(`Avatars with non-UUID but potentially custom IDs: ${nonUUIDAvatars.length}`);
    nonUUIDAvatars.forEach(avatar => {
      console.log(`  - ${avatar.avatar_name || avatar.name || 'Unnamed'}: ${avatar.avatar_id}`);
    });
  }
  
  // Filter to only custom avatars - STRICT UUID pattern only (32 hex characters)
  // This matches the pattern: 32dbf2775e394a51a96c75e5aadeeb86
  const customAvatars = uniqueAvatars.filter(avatar => {
    const avatarId = avatar.avatar_id;
    
    // Only keep avatars with UUID-like IDs (exactly 32 hex characters, no underscores)
    // This is the pattern for custom avatars
    const isCustomAvatar = /^[a-f0-9]{32}$/i.test(avatarId);
    
    return isCustomAvatar;
  });
  
  console.log(`Final filtered count: ${customAvatars.length} custom avatars`);
  console.log(`Removed ${avatars.length - customAvatars.length} public/duplicate avatars`);
  
  // Check if any known custom avatars are missing
  const foundKnownIds = customAvatars.map(a => a.avatar_id);
  const missingKnownIds = KNOWN_CUSTOM_AVATAR_IDS.filter(id => !foundKnownIds.includes(id));
  
  if (missingKnownIds.length > 0) {
    console.warn(`⚠️ Missing known custom avatars: ${missingKnownIds.join(', ')}`);
    console.warn('These avatars are not in the API response. They might be in draft/pending state.');
    
    // Try to find them in the original list (maybe they were filtered out)
    missingKnownIds.forEach(missingId => {
      const foundInOriginal = avatars.find(a => a.avatar_id === missingId);
      if (foundInOriginal) {
        console.log(`  Found ${missingId} in original list but it was filtered out - adding it back`);
        customAvatars.push(foundInOriginal); // Add it back
      } else {
        console.log(`  ${missingId} is not in the API response at all`);
        // Create a placeholder avatar object for known avatars that aren't in the response
        // This allows them to still be selectable even if not returned by the API
        const placeholderAvatar: HeyGenAvatar = {
          avatar_id: missingId,
          avatar_name: `Avatar ${missingId.substring(0, 8)}...`,
          name: `Avatar ${missingId.substring(0, 8)}...`,
          is_custom: true,
        };
        console.log(`  Creating placeholder for ${missingId} so it can still be used`);
        customAvatars.push(placeholderAvatar);
      }
    });
  }
  
  if (customAvatars.length > 0) {
    console.log('Custom avatars found:');
    customAvatars.forEach((avatar, index) => {
      const isUUID = /^[a-f0-9]{32}$/i.test(avatar.avatar_id);
      const isKnown = KNOWN_CUSTOM_AVATAR_IDS.includes(avatar.avatar_id);
      console.log(`  ${index + 1}. ${avatar.avatar_name || avatar.name || 'Unnamed'}`);
      console.log(`     ID: ${avatar.avatar_id} ${isUUID ? '(UUID)' : '(Non-UUID)'} ${isKnown ? '(Known)' : ''}`);
    });
  } else {
    console.warn('⚠️ No custom avatars found! Check if your avatar IDs match the UUID pattern.');
  }
  
  console.log('================================');
  
  return customAvatars;
}

function GenerateContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState('');
  const [numVariations, setNumVariations] = useState(3);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(false);

  useEffect(() => {
    const topicParam = searchParams.get('topic');
    if (topicParam) {
      setTopic(decodeURIComponent(topicParam));
    }
  }, [searchParams]);

  // Redirect to login if not authenticated - must be in useEffect to avoid render warning
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setScripts([]);
    setAvatars([]);
    setLoadingAvatars(true);

    try {
      // Fetch avatars and scripts in parallel
      const [scriptsResponse, avatarsResponse] = await Promise.allSettled([
        generateScripts(topic, numVariations),
        listHeyGenAvatars(),
      ]);

      // Handle scripts response
      if (scriptsResponse.status === 'fulfilled') {
        setScripts(scriptsResponse.value.scripts);
        // Auto-save to Firestore
        await saveToFirestore(scriptsResponse.value.scripts);
      } else {
        throw scriptsResponse.reason;
      }

      // Handle avatars response
      if (avatarsResponse.status === 'fulfilled') {
        const avatarData = avatarsResponse.value;
        let avatarList: HeyGenAvatar[] = [];
        if (avatarData.data) {
          if (Array.isArray(avatarData.data)) {
            avatarList = avatarData.data;
          } else if (avatarData.data.avatars && Array.isArray(avatarData.data.avatars)) {
            avatarList = avatarData.data.avatars;
          }
        }
        
        // Don't filter here - pass all avatars to ScriptCard so it can separate custom and public
        // The ScriptCard component will handle the separation
        console.log(`✓ Loaded ${avatarList.length} total avatars from API`);
        
        setAvatars(avatarList); // Pass all avatars, not just custom ones
      } else {
        console.error('Error fetching avatars:', avatarsResponse.reason);
        // Don't throw - avatars are optional, scripts are more important
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate scripts');
      console.error('Generation error:', err);
    } finally {
      setLoading(false);
      setLoadingAvatars(false);
    }
  };

  const saveToFirestore = async (scriptsToSave: Script[]) => {
    if (!user || !db) return;

    setSaving(true);
    try {
      await addDoc(collection(db, 'scripts'), {
        userId: user.uid,
        topic: topic,
        scripts: scriptsToSave,
        timestamp: serverTimestamp(),
      });
      console.log('Scripts saved to Firestore');
    } catch (err) {
      console.error('Error saving to Firestore:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center sm:text-left">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Generate Video Scripts
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create high-impact video scripts powered by AI
            </p>
          </div>

          {/* Form Card */}
          <form onSubmit={handleGenerate} className="mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl">
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="topic"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
                  >
                    Topic
                  </label>
                  <input
                    id="topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    placeholder="e.g., How to use ChatGPT for content creation..."
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="variations"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3"
                  >
                    Number of Variations
                  </label>
                  <select
                    id="variations"
                    value={numVariations}
                    onChange={(e) => setNumVariations(Number(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 cursor-pointer"
                  >
                    <option value={3}>3 variations</option>
                    <option value={4}>4 variations</option>
                    <option value={5}>5 variations</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading || !topic.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-semibold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl disabled:transform-none"
                >
                  {loading ? (
                    <span className="flex items-center justify-center text-white">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating scripts...
                    </span>
                  ) : (
                    <span className="text-white">✨ Generate Scripts</span>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Status Messages */}
          {saving && (
            <div className="mb-6 flex items-center justify-center space-x-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 animate-pulse">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving to dashboard...</span>
            </div>
          )}

          {error && (
            <div className="mb-8 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-xl animate-shake">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="mb-8">
              <Loader />
            </div>
          )}

          {/* Results */}
          {scripts.length > 0 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  Generated Scripts
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                  {scripts.length} {scripts.length === 1 ? 'script' : 'scripts'}
                </span>
              </div>
              <div className="space-y-6">
                {scripts.map((script, index) => (
                  <div key={script.id} className="animate-fadeIn" style={{ animationDelay: `${index * 100}ms` }}>
                    <ScriptCard script={script} avatars={avatars} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader />
        </div>
      </div>
    }>
      <GenerateContent />
    </Suspense>
  );
}

