# Deploying RideTrack to Production

## Quick Start

### 1. Set Up Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Realtime Database** 
3. Enable **Authentication** → Google provider
4. Copy `database.rules.json` to Firebase Console > Realtime Database > Rules

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Firebase credentials:

```bash
cp .env.example .env
# Edit .env with your Firebase config
```

For the static HTML files, update the fallback values directly in `firebase-config.js`.

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (from project root)
vercel

# For production
vercel --prod
```

### 4. Set Vercel Environment Variables

In Vercel dashboard, add:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`

### 5. Add Custom Domain

1. In Vercel: Settings > Domains > Add
2. Configure DNS at your registrar

## Files Created for Production

| File | Purpose |
|------|---------|
| `vercel.json` | Deployment config + security headers |
| `database.rules.json` | Firebase security rules |
| `.env.example` | Environment variable template |
| `privacy.html` | Privacy policy page |
| `terms.html` | Terms of service page |
