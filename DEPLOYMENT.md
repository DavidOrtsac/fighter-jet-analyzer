# Deployment Checklist

Complete guide for deploying the Fighter Jet Analyzer to production.

## Pre-Deployment Checklist

### 1. Verify Local Setup ✅

- [ ] Application runs locally without errors (`npm run dev`)
- [ ] Pipeline successfully scrapes and analyzes data
- [ ] All API endpoints return expected responses
- [ ] UI displays data correctly with proper styling
- [ ] No console errors in browser
- [ ] `.env.local` has all required keys

### 2. Code Quality ✅

- [ ] No linting errors (`npm run lint`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] All files committed to git

### 3. Documentation ✅

- [ ] README.md completed with all questions answered
- [ ] Screenshots captured and saved to `screenshots/` folder
- [ ] API keys documented (but not committed!)

---

## Deployment Steps

### Step 1: Initialize Git Repository

```bash
cd /Users/davidcastro/Dropbox/Mac/Desktop/Projects/apify-analyzer

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Fighter Jet Analyzer complete

- Implemented Apify Reddit scraper integration
- Added OpenAI sentiment analysis pipeline
- Built Next.js UI with real-time data display
- Created health monitoring endpoint
- Added comprehensive error handling and retry logic"
```

### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `apify-analyzer` or `fighter-jet-analyzer`
3. Description: "AI-powered sentiment analysis of fighter jet discussions from Reddit"
4. **Public** repository (required for submission)
5. Don't initialize with README (we already have one)
6. Click "Create repository"

### Step 3: Push to GitHub

```bash
# Add remote
git remote add origin https://github.com/YOUR-USERNAME/apify-analyzer.git

# Push code
git branch -M main
git push -u origin main
```

### Step 4: Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repo
4. **Configure Project:**
   - Framework Preset: Next.js (auto-detected)
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. **Add Environment Variables:**

```bash
APIFY_API_TOKEN=your_apify_token
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
```

6. Click "Deploy"
7. Wait 2-3 minutes for build

#### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts, then add env vars in dashboard
```

### Step 5: Update Environment Variables

After first deployment, update `NEXT_PUBLIC_BASE_URL`:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Edit `NEXT_PUBLIC_BASE_URL`
3. Set to: `https://your-actual-app-name.vercel.app`
4. Redeploy: Dashboard → Deployments → ⋯ → Redeploy

### Step 6: Test Production Deployment

```bash
# Visit your deployed URL
open https://your-app.vercel.app

# Test health endpoint
curl https://your-app.vercel.app/api/health

# Test pipeline (via UI button)
# Should work identically to local
```

### Step 7: Take Production Screenshots

Now that it's deployed:

1. Run the pipeline on production
2. Wait for analysis to complete
3. Take screenshots:
   - **UI:** Full page showing analyzed posts
   - **Supabase:** Table view with data
   - **Health endpoint:** Browser showing JSON response

Save to `screenshots/` folder and commit:

```bash
git add screenshots/
git commit -m "Add production screenshots"
git push
```

---

## Post-Deployment Verification

### Functional Tests

- [ ] Visit production URL - page loads
- [ ] Click "Run Data Pipeline" - completes successfully
- [ ] Data appears in UI with correct formatting
- [ ] Sentiment badges display with proper colors
- [ ] Status badges show correct states
- [ ] "Refresh" button works
- [ ] Health endpoint returns valid JSON
- [ ] Mobile responsive (test on phone)

### Performance Tests

- [ ] First load < 3 seconds
- [ ] Pipeline completes in < 60 seconds
- [ ] No 500 errors in browser console
- [ ] API routes respond in < 5 seconds

### Edge Cases

- [ ] Empty state displays when no data
- [ ] Error messages appear for failures
- [ ] Retry button appears when failures exist
- [ ] Loading states work correctly

---

## Submission Package

### Required Deliverables

1. **✅ Hosted Application URL**
   - `https://your-app.vercel.app`

2. **✅ Public GitHub Repository**
   - `https://github.com/YOUR-USERNAME/apify-analyzer`

3. **✅ Supabase Screenshots**
   - Table view showing data + analysis
   - Located in `screenshots/` folder in repo

4. **✅ Completed README.md**
   - All 5 required questions answered
   - Setup instructions included
   - Architecture decisions explained

### Optional (Impressive)

5. **📹 Loom Video** (2-3 minutes)
   - Quick walkthrough of the app
   - Explain one interesting technical decision
   - Demo the retry feature

---

## Submission Template

Use this when submitting:

```markdown
# Fighter Jet Analyzer Submission

**Name:** [Your Name]
**Date:** [Submission Date]

## Links

- **Live Demo:** https://your-app.vercel.app
- **GitHub Repo:** https://github.com/YOUR-USERNAME/apify-analyzer
- **Video Walkthrough:** [Optional Loom link]

## Overview

Built a full-stack SaaS application that scrapes fighter jet discussions from Reddit (r/FighterJets, r/aviation, r/WarplanePorn), analyzes sentiment using OpenAI GPT-3.5, and displays results in a modern web interface.

## Technical Highlights

1. **Status-Based State Machine:** Prevents race conditions and enables retry logic
2. **Batch Processing:** Handles 10 concurrent OpenAI analyses
3. **Production Monitoring:** Health endpoint for system observability
4. **Error Resilience:** Individual record failures don't block the pipeline
5. **User Experience:** Real-time toast notifications and loading states

## Data Pipeline

Apify (Reddit scraper) → Supabase (PostgreSQL) → OpenAI (Sentiment analysis) → Next.js UI

## Screenshots

All screenshots available in `/screenshots` folder in the repository:
- Supabase table with analyzed data
- Production UI with sentiment analysis
- Health monitoring endpoint

## Time Taken

~3 hours (within challenge timeframe)

## Questions Answered

All required questions answered comprehensively in README.md:
- Schema reasoning
- Workflow explanation
- Scaling considerations
- Failure handling strategy
- System health monitoring

Thank you for the opportunity!
```

---

## Troubleshooting Deployment Issues

### Build Fails

**Error:** "Module not found"
```bash
# Solution: Ensure all dependencies are in package.json
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Environment Variables Not Working

**Error:** API calls fail in production
```bash
# Solution: Check Vercel dashboard
# Settings → Environment Variables
# Ensure all keys are added
# Redeploy after adding
```

### API Routes Timeout

**Error:** 504 Gateway Timeout
```bash
# Solution: Vercel serverless functions have 10s limit on Hobby plan
# Reduce batch size in analyze endpoint:
# Change .limit(10) to .limit(5)
```

### Database Connection Fails

**Error:** "Failed to fetch records"
```bash
# Solution: Check Supabase URL and key
# Ensure CORS is enabled (should be by default)
# Verify Supabase project is not paused
```

---

## Success Metrics

After deployment, you should see:

✅ **Vercel Dashboard:** Build successful, 0 errors  
✅ **GitHub:** All files committed and pushed  
✅ **Production URL:** Application loads and works  
✅ **Supabase:** Records being created and analyzed  
✅ **Health Check:** Returns 200 status with metrics  

---

## Next Steps After Submission

If you want to enhance the project:

1. **Add authentication** (Supabase Auth)
2. **Add real-time updates** (Supabase Realtime)
3. **Add data visualization** (Chart.js, Recharts)
4. **Add export functionality** (CSV/JSON download)
5. **Add filtering** (by sentiment, date range, subreddit)
6. **Add pagination** (infinite scroll)
7. **Add caching** (Redis for API responses)

Good luck! 🚀

