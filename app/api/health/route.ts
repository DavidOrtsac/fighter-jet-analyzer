import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    // Get total count
    const { count: totalCount, error: totalError } = await supabase
      .from('analyzed_data')
      .select('*', { count: 'exact', head: true })

    if (totalError) throw totalError

    // Get status breakdown
    const { data: statusData, error: statusError } = await supabase
      .from('analyzed_data')
      .select('status')

    if (statusError) throw statusError

    // Count by status
    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    }

    statusData?.forEach((record: any) => {
      if (record.status in statusCounts) {
        statusCounts[record.status as keyof typeof statusCounts]++
      }
    })

    // Get last analyzed timestamp
    const { data: lastAnalyzed, error: lastError } = await supabase
      .from('analyzed_data')
      .select('analyzed_at')
      .not('analyzed_at', 'is', null)
      .order('analyzed_at', { ascending: false })
      .limit(1)

    if (lastError) throw lastError

    const lastAnalyzedAt = lastAnalyzed?.[0]?.analyzed_at || null

    // Calculate health status
    const healthStatus = statusCounts.failed > statusCounts.completed * 0.5 ? 'degraded' :
                         statusCounts.processing > 5 ? 'processing' :
                         totalCount === 0 ? 'idle' : 'healthy'

    return NextResponse.json({
      status: healthStatus,
      timestamp: new Date().toISOString(),
      metrics: {
        total: totalCount || 0,
        byStatus: statusCounts,
        lastAnalyzedAt,
      },
      summary: {
        successRate: totalCount ? ((statusCounts.completed / (totalCount || 1)) * 100).toFixed(1) + '%' : 'N/A',
        failureRate: totalCount ? ((statusCounts.failed / (totalCount || 1)) * 100).toFixed(1) + '%' : 'N/A',
      }
    })

  } catch (error: any) {
    console.error('Health check error:', error)
    return NextResponse.json({ 
      status: 'error',
      error: error.message || 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

