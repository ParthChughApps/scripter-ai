# ScripterAI Setup Guide

## Prerequisites

- Node.js 18+ installed
- Firebase project created
- Anthropic API key
- HeyGen API key (optional, for video generation feature)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable **Email/Password** provider
4. Enable **Firestore Database**:
   - Go to Firestore Database
   - Create database in **Production mode** (or Test mode for development)
   - Set up security rules (see below)

### Firestore Security Rules

Add these rules to your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scripts/{scriptId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## Step 3: Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Get your Firebase config:
   - Go to Project Settings > General
   - Scroll to "Your apps" section
   - Click the web icon (</>) to add a web app
   - Copy the config values
3. Fill in `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

ANTHROPIC_API_KEY=your_anthropic_api_key

# Optional: HeyGen API for video generation
HEYGEN_API_KEY=your_heygen_api_key
```

### Getting Your HeyGen API Key

1. Sign up or log in to [HeyGen](https://www.heygen.com)
2. Navigate to **Settings > Subscriptions & API > HeyGen API**
3. Click **Generate API Token** or copy your existing token
4. Add it to `.env.local` as `HEYGEN_API_KEY=your_api_key_here`

**Note:** The HeyGen API key is optional. The video generation feature will only work if this key is configured.

## Step 4: Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Step 5: Update Claude Model (if needed)

If Claude Sonnet 4.5 becomes available, update the model name in:
- `src/app/api/generateScripts/route.ts` (line ~80)

Currently using: `claude-3-5-sonnet-20241022`

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── generateScripts/    # Claude API route
│   │   └── heygen/             # HeyGen API routes
│   │       ├── createVideo/    # Create avatar video
│   │       ├── videoStatus/    # Check video status
│   │       ├── listAvatars/   # List available avatars
│   │       └── listVoices/    # List available voices
│   ├── dashboard/              # Saved scripts page
│   ├── generate/               # Main script generator
│   ├── login/                  # Auth page
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/
│   ├── AuthProvider.tsx        # Auth context
│   ├── Navbar.tsx              # Navigation
│   ├── ScriptCard.tsx          # Script display card (with video creation)
│   └── Loader.tsx               # Loading spinner
└── lib/
    ├── firebase.ts             # Firebase config
    ├── auth.ts                 # Auth helpers
    └── api.ts                  # API client (includes HeyGen functions)
```

## Features

✅ Email/Password Authentication  
✅ Generate 3+ script variations  
✅ Auto-save to Firestore  
✅ Dashboard with pagination  
✅ Copy-to-clipboard  
✅ Delete scripts  
✅ Regenerate from dashboard  
✅ **Create AI avatar videos with HeyGen**  
✅ Dark mode support  
✅ Responsive design  

## Troubleshooting

### Firebase Auth Errors
- Ensure Email/Password is enabled in Firebase Console
- Check that environment variables are correctly set
- Verify Firebase config values match your project

### Claude API Errors
- Verify `ANTHROPIC_API_KEY` is set in `.env.local`
- Check API key has sufficient credits
- Review console logs for token usage

### HeyGen API Errors
- Verify `HEYGEN_API_KEY` is set in `.env.local` (if using video generation)
- Check that your HeyGen account has API access enabled
- Ensure you have sufficient credits/quota in your HeyGen account
- Review the API response in browser console for detailed error messages
- Note: Video generation may take 1-3 minutes to complete

### Firestore Errors
- Ensure Firestore is enabled in Firebase Console
- Check security rules allow authenticated users
- Verify collection name is `scripts`

## Next Steps

1. Customize the system prompt in `src/app/api/generateScripts/route.ts`
2. Adjust styling in `tailwind.config.ts`
3. Add additional features as needed

