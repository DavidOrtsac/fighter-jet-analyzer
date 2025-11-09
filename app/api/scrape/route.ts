import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { retryWithBackoff, isRetryableError } from '@/lib/retry'

export async function POST(request: Request) {
  try {
    console.log('Starting Reddit scrape using public JSON API...')

    // Use Reddit's free public JSON API, no authentication needed 
    const subreddits = ['FighterJets', 'aviation', 'WarplanePorn', 'hoggit']
    const allPosts: any[] = []
    const errors: string[] = []

    // Fetch from each subreddit with retry logic
    for (const subreddit of subreddits) {
      try {
        console.log(`Fetching from r/${subreddit}...`)
        
        // Retry fetch with exponential backoff
        const data = await retryWithBackoff(
          async () => {
            const response = await fetch(`https://old.reddit.com/r/${subreddit}/hot.json?limit=10`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
              }
            })

            if (!response.ok) {
              const error: any = new Error(`Reddit API returned ${response.status}`)
              error.status = response.status
              throw error
            }

            return await response.json()
          },
          {
            maxRetries: 3,
            onRetry: (attempt, error) => {
              console.log(`[r/${subreddit}] Retry attempt ${attempt}/3 after error: ${error.message}`)
            }
          }
        )

        const posts = data.data.children.map((child: any) => child.data)
        
        allPosts.push(...posts.map((post: any) => ({
          subreddit: post.subreddit_name_prefixed || `r/${subreddit}`,
          title: post.title || '',
          selftext: post.selftext || '',
          url: post.url || '',
          author: post.author || 'unknown',
          score: post.score || 0,
          num_comments: post.num_comments || 0,
        })))

        console.log(`Fetched ${posts.length} posts from r/${subreddit}`)
        
        // Be nice to Reddit - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error: any) {
        const errorMsg = `Failed to fetch r/${subreddit} after 3 retries: ${error.message}`
        console.error(errorMsg)
        errors.push(errorMsg)
        // Continue with other subreddits even if one fails
      }
    }

    console.log(`Total posts fetched: ${allPosts.length}`)

    if (allPosts.length === 0) {
      // All subreddits failed
      if (errors.length > 0) {
        return NextResponse.json({ 
          success: false,
          error: 'All subreddits failed to scrape',
          errors: errors,
          scraped: 0
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true, 
        scraped: 0,
        message: 'No posts found',
        errors: []
      })
    }

    // Transform and insert into Supabase
    const records = allPosts.map((post: any) => {
      const content = post.title + (post.selftext ? `\n\n${post.selftext}` : '')
      
      return {
        source: post.subreddit,
        content: content.trim(),
        status: 'pending',
      }
    }).filter((record: any) => record.content && record.content.length > 10) // Filter out empty content

    console.log(`Inserting ${records.length} records into Supabase`)

    const { data, error } = await supabase
      .from('analyzed_data')
      .insert(records)
      .select()

    if (error) {
      console.error('Supabase error:', error)
      throw new Error(`Supabase insertion failed: ${error.message}`)
    }

    console.log(`Successfully inserted ${data?.length} records`)

    return NextResponse.json({ 
      success: true, 
      scraped: data?.length || 0,
      records: data?.map(r => r.id),
      errors: errors.length > 0 ? errors : undefined,
      warning: errors.length > 0 ? `${errors.length} subreddit(s) failed but ${data?.length} posts scraped` : undefined
    })

  } catch (error: any) {
    console.error('Scrape error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to scrape data',
      details: error.stack,
      type: error.constructor.name
    }, { status: 500 })
  }
}

