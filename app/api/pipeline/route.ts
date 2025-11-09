import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    let baseUrl = process.env.BASE_URL
    
    if (!baseUrl) {
      const host = request.headers.get('host') || 'localhost:3000'
      const protocol = host.includes('localhost') ? 'http' : 'https'
      baseUrl = `${protocol}://${host}`
    }
    
    console.log('Starting data pipeline with base URL:', baseUrl)

    // Step 1: Scrape data from Reddit
    console.log('Step 1: Scraping data from Reddit...')
    const scrapeRes = await fetch(`${baseUrl}/api/scrape`, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!scrapeRes.ok) {
      const errorData = await scrapeRes.json()
      throw new Error(`Scrape failed: ${errorData.error || 'Unknown error'}`)
    }

    const scrapeData = await scrapeRes.json()
    console.log('Scrape complete:', scrapeData)

    // Check for partial failures in scraping
    if (scrapeData.warning) {
      console.warn('Scrape warning:', scrapeData.warning)
    }

    // Wait a bit for data to settle in the database
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 2: Analyze data with OpenAI
    console.log('Step 2: Analyzing data with OpenAI...')
    const analyzeRes = await fetch(`${baseUrl}/api/analyze`, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!analyzeRes.ok) {
      const errorData = await analyzeRes.json()
      throw new Error(`Analysis failed: ${errorData.error || 'Unknown error'}`)
    }

    const analyzeData = await analyzeRes.json()
    console.log('Analysis complete:', analyzeData)

    return NextResponse.json({
      success: true,
      pipeline: 'completed',
      steps: {
        scrape: {
          success: true,
          count: scrapeData.scraped || 0,
          warning: scrapeData.warning,
          errors: scrapeData.errors
        },
        analyze: {
          success: true,
          analyzed: analyzeData.analyzed || 0,
          failed: analyzeData.failed || 0
        }
      },
      summary: `Scraped ${scrapeData.scraped || 0} posts, analyzed ${analyzeData.analyzed || 0} successfully`,
      warnings: scrapeData.warning ? [scrapeData.warning] : []
    })

  } catch (error: any) {
    console.error('Pipeline error:', error)
    
    // Determine which step failed
    const failedStep = error.message.includes('Scrape') ? 'scrape' : 
                       error.message.includes('Analysis') ? 'analyze' : 
                       'unknown'

    return NextResponse.json({ 
      error: error.message || 'Pipeline failed',
      failedStep,
      details: error.stack,
      type: error.constructor.name
    }, { status: 500 })
  }
}

