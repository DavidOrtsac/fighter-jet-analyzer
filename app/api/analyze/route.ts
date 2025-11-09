import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { retryWithBackoff } from '@/lib/retry'

export async function POST(request: Request) {
  try {
    // Check if this is a retry request
    const { searchParams } = new URL(request.url)
    const isRetry = searchParams.get('retry') === 'true'

    const targetStatus = isRetry ? 'failed' : 'pending'
    console.log(`Analyzing records with status: ${targetStatus}`)

    // Get records that need analysis
    // Increased to 40 to handle all posts from 4 subreddits!
    const { data: records, error: fetchError } = await supabase
      .from('analyzed_data')
      .select('*')
      .eq('status', targetStatus)
      .limit(40)

    if (fetchError) {
      throw new Error(`Failed to fetch records: ${fetchError.message}`)
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ 
        success: true,
        analyzed: 0,
        message: `No ${targetStatus} records to analyze` 
      })
    }

    console.log(`Found ${records.length} records to analyze`)

    // Mark all as processing
    await supabase
      .from('analyzed_data')
      .update({ status: 'processing' })
      .in('id', records.map(r => r.id))

    try {
      // BATCH PROCESSING: Combine all posts into one API call!
      const postsForAnalysis = records.map((record, index) => ({
        id: index,
        content: record.content.substring(0, 1000) // Limit to 1000 chars each
      }))

      const batchPrompt = postsForAnalysis.map((post, i) => 
        `Post ${i + 1}:\n${post.content}\n---`
      ).join('\n\n')

      console.log('Sending BATCH request to OpenAI for all posts...')

      // ONE API CALL FOR ALL POSTS with retry logic
      const completion = await retryWithBackoff(
        async () => {
          return await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
          {
            role: 'system',
            content: `You are analyzing discussions about military aviation and fighter jets.

I will provide you with ${records.length} posts. For EACH post, analyze sentiment and provide a summary.

SENTIMENT GUIDELINES:

NEGATIVE examples:
- Crashes, accidents, deaths, injuries (e.g., "Ka-226 crash in dagestan, Russia. 5 dead, several injured")
- Criticism, complaints, disappointments
- Moderator actions calling out rule violations (e.g., "submission of low quality & substandard media continues")
- Problems, failures, controversies
- Concerns about safety, costs, delays

POSITIVE examples:
- Expressions of enthusiasm, love, appreciation (e.g., "Gotta love fast prop-planes")
- Compliments about aircraft or photos (e.g., "Nice view", "Amazing display")
- Successful milestones, achievements
- Excitement about capabilities or performances
- Appreciation posts with words like "nice", "love", "amazing", "beautiful"

NEUTRAL examples:
- Factual reporting without emotion (e.g., "A pair of Royal Malaysian Airforce Su-30MKMs in formation")
- Technical specifications, data
- Simple announcements or informational posts
- Questions seeking information
- Objective descriptions

Return a JSON array with exactly ${records.length} objects in the same order, each containing:
{
  "sentiment": "positive" | "negative" | "neutral",
  "summary": "one-sentence summary"
}

Example format:
{
  "analyses": [
    {"sentiment": "positive", "summary": "..."},
    {"sentiment": "neutral", "summary": "..."},
    ...
  ]
}`
          },
          {
            role: 'user',
            content: batchPrompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
          })
        },
        {
          maxRetries: 3,
          initialDelay: 2000, // Start with 2s delay for OpenAI
          onRetry: (attempt, error) => {
            console.log(`[OpenAI Batch] Retry attempt ${attempt}/3 after error: ${error.message}`)
          }
        }
      )

      const responseText = completion.choices[0].message.content || '{}'
      const batchResult = JSON.parse(responseText)
      const analyses = batchResult.analyses || []

      console.log(`Received ${analyses.length} analyses from OpenAI`)

      // Update each record with its analysis
      const updatePromises = records.map(async (record, index) => {
        try {
          const analysis = analyses[index] || { 
            sentiment: 'neutral', 
            summary: 'Analysis unavailable' 
          }

          const { error: updateError } = await supabase
            .from('analyzed_data')
            .update({
              analysis,
              sentiment: analysis.sentiment || 'neutral',
              status: 'completed',
              analyzed_at: new Date().toISOString(),
              error_message: null
            })
            .eq('id', record.id)

          if (updateError) throw updateError

          return { id: record.id, success: true }
        } catch (error: any) {
          console.error(`Error updating record ${record.id}:`, error)

          await supabase
            .from('analyzed_data')
            .update({ 
              status: 'failed',
              error_message: error.message || 'Update failed'
            })
            .eq('id', record.id)

          return { id: record.id, success: false, error: error.message }
        }
      })

      const results = await Promise.all(updatePromises)
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      console.log(`Batch analysis complete: ${successful} successful, ${failed} failed`)

      return NextResponse.json({ 
        success: true, 
        analyzed: successful,
        failed: failed,
        total: records.length
      })

    } catch (error: any) {
      const errorMsg = `OpenAI batch analysis failed after 3 retries: ${error.message}`
      console.error(errorMsg)

      // Mark all as failed
      await supabase
        .from('analyzed_data')
        .update({ 
          status: 'failed',
          error_message: `Batch failed after 3 retries: ${error.message}`
        })
        .in('id', records.map(r => r.id))

      return NextResponse.json({ 
        success: false,
        analyzed: 0,
        failed: records.length,
        error: errorMsg,
        details: error.code || error.status || 'Unknown error type'
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to analyze data',
      details: error.stack,
      type: error.constructor.name
    }, { status: 500 })
  }
}

