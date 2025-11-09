# Testing Guide

Quick reference for testing the Fighter Jet Analyzer application.

## Prerequisites Checklist

Before testing, ensure you've completed:

- [x] Created Supabase project
- [x] Run the schema update SQL (ALTER TABLE statements)
- [x] Created `.env.local` with all API keys
- [x] Installed dependencies (`npm install`)

## Local Testing Steps

### 1. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000

### 2. Test Data Pipeline

1. Click "Run Data Pipeline" button
2. Watch toast notifications:
   - "Starting data pipeline..."
   - "Scraping fighter jet discussions from Reddit..."
   - Success message with count
3. Page should auto-refresh with new data

**Expected:** 15-25 new records appear with status badges

### 3. Test Individual Endpoints

```bash
# Test scraping only
curl -X POST http://localhost:3000/api/scrape

# Test analysis only (requires pending records)
curl -X POST http://localhost:3000/api/analyze

# Test health endpoint
curl http://localhost:3000/api/health

# Test retry mechanism
curl -X POST http://localhost:3000/api/analyze?retry=true
```

### 4. Test UI Features

- **Refresh Button:** Manually reload data
- **Retry Failed Button:** Should appear if any failed records exist
- **Status Badges:** Check colors (blue=pending, yellow=processing, green=completed, red=failed)
- **Sentiment Badges:** Check colors (green=positive, red=negative, gray=neutral)
- **Error Messages:** Should display for failed records

### 5. Verify Database

Go to Supabase Dashboard → Table Editor → `analyzed_data`

**Check:**
- Records have `status` values
- Completed records have `sentiment` and `analysis` filled
- `analyzed_at` timestamps are populated
- Failed records have `error_message` values

## Expected Behavior

### Successful Pipeline Run

```
1. Scrape: ~20-25 posts from Reddit → status='pending'
2. Wait: 2 seconds
3. Analyze: Up to 10 records → status='completed'
4. Result: Records show with green sentiment badges
```

### Common Issues & Solutions

**Issue:** "Missing Supabase environment variables"
- **Fix:** Check `.env.local` has `SUPABASE_URL` and `SUPABASE_ANON_KEY`

**Issue:** "Apify API error"
- **Fix:** Verify `APIFY_API_TOKEN` is correct
- **Fix:** Check Apify account has free credits

**Issue:** "OpenAI rate limit exceeded"
- **Fix:** Wait 60 seconds and retry
- **Fix:** Reduce batch size in analyze endpoint

**Issue:** No data appears after pipeline runs
- **Fix:** Check browser console for errors
- **Fix:** Verify Supabase table has records
- **Fix:** Check API routes return 200 status

## Performance Benchmarks

**Expected Times:**
- Scrape: 10-30 seconds (depends on Apify)
- Analysis: 5-15 seconds for 10 records
- Full pipeline: 15-45 seconds total

**API Costs (per run):**
- Apify: Free tier (1,000 credits/month)
- OpenAI: ~$0.02 for 10 analyses (GPT-3.5)
- Supabase: Free tier (500MB, 50K rows)

## Deployment Testing

After deploying to Vercel:

1. Visit production URL
2. Run pipeline (should work identically)
3. Check health endpoint: `https://your-app.vercel.app/api/health`
4. Verify environment variables in Vercel dashboard

## Screenshots Needed

For submission, capture:

1. **Supabase table view** showing analyzed records
2. **Record detail** showing analysis JSONB content
3. **UI with data** displaying analyzed posts
4. **Health endpoint** JSON response

Save to `screenshots/` folder.

## Troubleshooting Commands

```bash
# Check build works
npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Check for linting errors
npm run lint

# View logs (Vercel)
vercel logs [your-deployment-url]
```

## Success Criteria

✅ Pipeline completes without errors  
✅ Data appears in Supabase table  
✅ Sentiment analysis shows in UI  
✅ Status badges work correctly  
✅ Retry button appears for failed records  
✅ Health endpoint returns valid JSON  
✅ No console errors in browser  
✅ Deploy to Vercel succeeds  

---

**Ready to deploy?** Push to GitHub and connect to Vercel!

