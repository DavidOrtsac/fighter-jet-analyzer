# Aviation Discussions Sentiment Analysis

This is my LLM-powered sentiment analysis pipeline. The goal is to scrape information from four different fighter jet-related subreddits. I'm an aviation enthusiast, so I figured that for this challenge, I might as well scrape r/FighterJets, r/aviation, r/WarplanePorn, and r/hoggit. This pipeline uses Reddit JSON as the scraper (which is completely free). Then, it runs Supabase INSERT to store raw data, Supabase SELECT to get pending records, Supabase UPDATE to lock as processing, and then runs a batch analysis using OpenAI's affordable gpt-4o-mini model, before the dispositions (or sentiments) are sent back to Supabase, and then the UI is refreshed.

🔗 **Live Demo:** [your-vercel-url]  

---

## Setup (5 minutes)

1. Clone and install:
```bash
git clone [url]
cd aviation-sentiment-analysis
npm install
```

2. Run `scripts/setup.sql` in Supabase SQL editor

3. Add `.env.local`:
```bash
OPENAI_API_KEY=YOUR_API_KEY_HERE

SUPABASE_URL=YOUR_URL_HERE
SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE

NEXT_PUBLIC_SUPABASE_URL=YOUR_SAME_SUPABASE_URL_HERE
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SAME_ANON_KEY_HERE

NEXT_PUBLIC_BASE_URL=YOUR_URL_HERE

```

4. Run: `npm run dev`

5. Finally, open http://localhost:3000 and click "Run Pipeline"

---

## Architecture Questions

### 1. Schema Reasoning

The schema uses a single table `analyzed_data` with a `status` column that tracks the analysis state machine: `pending`, `processing`, `completed`, or `failed`. This design avoids race conditions by marking records as `processing` before the calling APIs, which prevents duplicate processing if multiple requests run concurrently. The status column also enables targeted retries by querying only failed records, rather than reprocessing everything.

The alternative would be separate tables for raw data and analysis results, normalized across posts and analyses with foreign keys. At current scale (hundreds to thousands of records per day), the join overhead isn't justified. The single table simplifies queries, reduces complexity, and performs well with proper indexing on `status` and `created_at`.

The tradeoff is denormalization: analysis results are stored as JSONB in the same row as the source content. This works well for the current use case where each post has one analysis. If we needed multiple analysis types per post, or complex querying across analysis metadata, normalization would become necessary. The schema can handle up to approximately 10,000 records per day efficiently. Beyond that, partitioning by date and potentially splitting into separate tables would be required.

### 2. Workflow Explanation

The end-to-end flow begins when a user triggers the pipeline via the UI, which calls `/api/pipeline`. This endpoint orchestrates two sequential steps: data collection and analysis.

Data collection happens in `/api/scrape`, which fetches posts from four Reddit subreddits (`FighterJets`, `aviation`, `WarplanePorn`, `hoggit`) using Reddit's public JSON API endpoints. Each subreddit fetch is wrapped in retry logic with exponential backoff, attempting up to three times with increasing delays (1s, 2s, 4s) before marking that subreddit as failed. The scraper continues processing other subreddits even if one fails, ensuring partial success. Retrieved posts are transformed into records with `source` (subreddit name), `content` (title and body combined), and `status` set to `pending`, then inserted into Supabase.

After a two-second delay to allow database writes to settle, the pipeline calls `/api/analyze`. This endpoint queries Supabase for up to 40 records with `status='pending'`, immediately updates them to `status='processing'` to prevent concurrent processing, then batches all posts into a single OpenAI API call. The batch request includes a structured prompt with sentiment guidelines and requests a JSON array response containing sentiment classification and summary for each post. The OpenAI call is wrapped in retry logic with exponential backoff (starting at 2 seconds, up to 3 attempts). Upon successful response, each record is updated with its analysis results, sentiment extracted from the JSON, `status` set to `completed`, and `analyzed_at` timestamp recorded. If the batch fails after all retries, all records are marked as `failed` with error messages stored.

The UI queries Supabase directly using the browser-safe client, displaying all records ordered by creation date. Status badges provide visual feedback, and failed records can be manually retried via a UI button that calls `/api/analyze?retry=true`, which queries for `status='failed'` records instead of `pending`.

### 3. Scaling to 100,000 Records Per Day

The primary bottleneck at scale would be the OpenAI API analysis step. Currently, the system processes 40 records per batch in a single API call, which takes approximately 2-3 seconds. At this rate, processing 100,000 records would require 2,500 batch calls, taking roughly 2 hours of sequential processing time, not accounting for rate limits or failures.

The first change one could make would be implementing a background job system using BullMQ (this is a queuing library) with Redis as the backing store. Instead of processing records synchronously in the API route, records would be inserted into a queue as individual jobs. Multiple worker processes would consume jobs from the queue, allowing parallel processing. With 10 worker processes each handling 10 concurrent OpenAI API calls, the system could process 100 analyses simultaneously, reducing total processing time from hours to minutes.

Also, if not BullMQ, there are other alternative such as AWS SQS, RabbitMQ, and Inngest.

Database scaling would require partitioning the `analyzed_data` table by date, creating monthly partitions. This improves query performance on large datasets and enables easier archival of old data. Indexes on `status` and `created_at` are already in place, but at 100K records per day, composite indexes on `(status, created_at)` would become necessary for efficient querying of pending records.

OpenAI rate limits would require a token bucket rate limiter just to comply. The system would need to track request rates and throttle workers accordingly. Additionally, implementing multiple API key rotation would distribute load across keys if available.

For the data collection step, Reddit API rate limits are less restrictive. Also, they don't cost anything. Implementing request queuing and distributed scraping across multiple instances would be necessary, though. The current sequential fetching with delays would need to be replaced with parallel fetching with proper rate limit management.

The result would be a system capable of processing 100,000 records in approximately 2-3 hours with proper worker scaling, compared to the current sequential approach that would take days.

### 4. Failure Handling

The system implements a multi-layered failure handling strategy combining automatic retries, error isolation, and manual recovery mechanisms.

For Reddit API failures, each subreddit fetch is wrapped in `retryWithBackoff` utility that attempts up to three times with exponential backoff delays (1 second, 2 seconds, 4 seconds). Network errors, timeouts, and 5xx server errors trigger automatic retries. If all retries fail for a specific subreddit, that failure is logged and the scraper continues with remaining subreddits, ensuring partial success. Failed subreddit fetches are tracked in an errors array and returned in the API response, allowing the UI to display warnings.

OpenAI API failures are handled at the batch level. The entire batch of up to 40 posts is retried up to three times with exponential backoff (starting at 2 seconds). Rate limit errors (429 status codes) trigger automatic retries with increasing delays. If the batch fails after all retries, all records in that batch are marked with `status='failed'` and the error message is stored in the `error_message` column. This approach ensures that a single API failure doesn't corrupt partial data—either all records in a batch succeed together or all fail together, maintaining data consistency.

Individual record update failures within a successful batch are handled separately. If OpenAI returns valid analysis but updating a specific record in Supabase fails, only that record is marked as failed while others remain `completed`. This granular error handling prevents one database issue from affecting the entire batch.

The system uses retry rather than queue for transient failures because retries handle temporary issues (network blips, rate limits) immediately without requiring additional infrastructure. The status column enables manual retry via UI button for persistent failures, which is simpler than implementing a full queue system for this scale. For production at 100K records per day, a queue system would become necessary, but for the current challenge scope, retry with status tracking provides the right balance of reliability and simplicity.

All errors are logged to console with detailed context (subreddit name, attempt number, error message), and failed records store error messages in the database for debugging. The UI displays failed records with error messages visible to users, and the "Retry Failed" button allows manual recovery without requiring database access.

### 5. System Health Monitoring

The `/api/health` endpoint provides comprehensive system health metrics by querying the Supabase database. It returns the total record count, a breakdown of records by status (`pending`, `processing`, `completed`, `failed`), the timestamp of the most recent successful analysis (`analyzed_at`), and calculated success and failure rates as percentages.

The health status is determined algorithmically: if failed records exceed 50% of completed records, status is `degraded`. If more than 5 records are currently processing, status is `processing`. If no records exist, status is `idle`. Otherwise, status is `healthy`.

For uptime monitoring, an external service like Uptime Robot or Datadog would ping this endpoint every 5 minutes. The monitoring service would track the `lastAnalyzedAt` timestamp and alert if no successful analyses have occurred in the past hour, indicating the pipeline has stopped working. The failure rate percentage allows setting thresholds—for example, alerting if failure rate exceeds 10% over a rolling window, indicating systemic issues with the OpenAI API or data quality.

The status breakdown enables capacity planning. A high number of pending records indicates the system is falling behind processing, suggesting the need for more workers or faster processing. A high number of processing records that remain stuck indicates worker crashes or API timeouts. The health endpoint essentially provides observability into the entire pipeline without requiring direct database access, enabling operations teams to monitor system health and respond to issues proactively before users notice degradation.

---

## Tech Stack

Next.js 15, TypeScript, Supabase (PostgreSQL), OpenAI gpt-4o-mini, Reddit JSON API, Tailwind CSS, Vercel

---

## Screenshots
![Supabase Database Table](screenshots/supabase-table.png)
*Database table showing analyzed aviation discussions with sentiment classifications and AI-generated summaries*
