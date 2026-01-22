# ScripterAI - Video Script Generator

A full-stack web application for generating multiple video script variations using Claude Sonnet 4.5, built with Next.js, Firebase, and TailwindCSS.

## Features

- 🔐 Firebase Authentication (Email/Password)
- 📝 Generate 3 script variations from a topic prompt
- 💾 Save scripts to Firestore
- 📊 Dashboard to view and manage saved scripts
- 📋 Copy-to-clipboard functionality
- 🎥 **Create avatar videos with HeyGen** - Generate AI avatar videos directly from your scripts
- 🎨 Modern UI with dark mode support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
- Copy `.env.local.example` to `.env.local`
- Fill in your Firebase configuration
- Add your Anthropic API key
- Add your HeyGen API key (optional, for video generation feature)

   To get your HeyGen API key:
   1. Sign up or log in to [HeyGen](https://www.heygen.com)
   2. Navigate to **Settings > Subscriptions & API > HeyGen API**
   3. Generate and copy your API token
   4. Add it to `.env.local` as `HEYGEN_API_KEY=your_api_key_here`

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/src
  /app
    /login          # Login/Register page
    /dashboard      # Dashboard for saved scripts
    /generate       # Main script generation page
    /api
      /generateScripts  # Claude API route
  /components       # Reusable UI components
  /lib              # Firebase and utility functions
```

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Firebase** - Authentication & Firestore
- **Claude Sonnet 4.5** - AI script generation
- **HeyGen API** - AI avatar video generation

## HeyGen Integration

After generating scripts, you can create AI avatar videos directly from them:

1. Click the **"Create Video"** button on any generated script
2. The system will create a video using HeyGen's API
3. Wait for processing (usually 1-3 minutes)
4. Once complete, click **"View Video"** to open the generated video

**Note:** The HeyGen API key is optional. If not configured, the video creation feature will show an error message.

this is the change infile