# ScripterAI - Video Script Generator

A full-stack web application for generating multiple video script variations using Claude Sonnet 4.5, built with Next.js, Firebase, and TailwindCSS.

## Features

- 🔐 Firebase Authentication (Email/Password)
- 📝 Generate 3 script variations from a topic prompt
- 💾 Save scripts to Firestore
- 📊 Dashboard to view and manage saved scripts
- 📋 Copy-to-clipboard functionality
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

