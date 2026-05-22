# Deploying ARAM Archipelago

This guide explains how to deploy your app so multiple users can access it simultaneously (not just localhost).

## Quick Start: Deploy to Render.com (Free)

Render.com is the easiest free option for deploying Node.js apps with WebSocket support.

### Step 1: Set up a GitHub repository

1. Initialize git (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Create a GitHub repository and push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/lol-aram-app.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and sign up (free account)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository (select `lol-aram-app`)
4. Fill in the settings:
   - **Name**: `lol-aram-app`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run server`
   - **Plan**: Free
5. Click **Create Web Service**

Render will automatically build and deploy your app. You'll get a URL like `https://lol-aram-app-xxxxx.onrender.com` - that's your live app!

### Step 3: Share with users

Send the Render URL to your friends. Up to 5 users can join the same session and play together in real-time.

---

## Alternative Option: Railway.app (Free with $5 credit)

[Railway](https://railway.app) also offers free tier + $5/month credit for 30 days.

1. Sign up at railway.app
2. Create new project → Deploy from GitHub
3. Connect your repository
4. Set environment variable `NODE_ENV=production`
5. Railway auto-detects `package.json` and deploys

---

## Deploy Locally (for development/testing)

To test the full deployment setup locally:

```bash
npm run build
npm run server
```

Visit `http://localhost:3000` in your browser.

---

## Important Notes

- **Free tier sleep**: Render's free tier will "spin down" after 15 minutes of inactivity, then take ~30 seconds to restart. This is fine for casual gaming with friends.
- **Data persistence**: Session data is saved to the `server/data` directory on the server. It will persist between restarts.
- **WebSocket support**: Both Render and Railway fully support WebSocket connections, which this app uses for real-time updates.
- **CORS**: The app is configured for production with proper headers.

---

## Troubleshooting

### "Can't connect to session server"
- Make sure Render deployment is complete (check the logs)
- Wait for any "spin-up" period if it was dormant
- Verify the URL doesn't have typos

### "Session keeps disconnecting"
- On Render free tier, the server may restart occasionally
- Try refreshing the page and rejoining the session
- Session data is saved, so you won't lose progress

### "Port already in use" locally
- The server will use port 3000 by default
- If that's busy, set: `PORT=3001 npm run server`

---

## Production Checklist

✓ Build script works locally  
✓ WebSocket connections work  
✓ Frontend connects to backend dynamically (not hardcoded localhost)  
✓ Session data persists  
✓ CORS headers configured  
✓ Render.yaml file created  

You're ready to deploy!
