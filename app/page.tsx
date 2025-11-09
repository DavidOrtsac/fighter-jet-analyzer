'use client'

import { useEffect, useState } from 'react'
import { supabaseClient } from '@/lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'

type Record = {
  id: string
  source: string
  content: string
  sentiment: string | null
  analysis: any
  status: string
  analyzed_at: string | null
  error_message: string | null
  created_at: string
}

export default function Home() {
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [failedCount, setFailedCount] = useState(0)

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseClient
        .from('analyzed_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      
      setRecords(data || [])
      
      // Count failed records
      const failed = data?.filter(r => r.status === 'failed').length || 0
      setFailedCount(failed)
    } catch (error: any) {
      toast.error(`Failed to load data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const runPipeline = async () => {
    setRunning(true)
    const loadingToast = toast.loading('Starting data pipeline...')
    
    try {
      toast.loading('Scraping fighter jet discussions from Reddit...', { id: loadingToast })
      
      const response = await fetch('/api/pipeline', { method: 'POST' })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Pipeline failed')
      }
      
      // Show success with any warnings
      if (data.warnings && data.warnings.length > 0) {
        toast.success(`${data.summary}\nWarning: ${data.warnings.join(', ')}`, { 
          id: loadingToast,
          duration: 5000 
        })
      } else {
        toast.success(data.summary || 'Pipeline completed successfully!', { id: loadingToast })
      }
      
      // Refresh data
      await fetchRecords()
    } catch (error: any) {
      toast.error(`Pipeline failed: ${error.message}`, { 
        id: loadingToast,
        duration: 6000 
      })
    } finally {
      setRunning(false)
    }
  }

  const retryFailed = async () => {
    setRetrying(true)
    const loadingToast = toast.loading('Retrying failed analyses...')
    
    try {
      const response = await fetch('/api/analyze?retry=true', { method: 'POST' })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Retry failed')
      }
      
      toast.success(`Analyzed ${data.analyzed} records!`, { id: loadingToast })
      
      // Refresh data
      await fetchRecords()
    } catch (error: any) {
      toast.error(`Retry failed: ${error.message}`, { id: loadingToast })
    } finally {
      setRetrying(false)
    }
  }

  const clearDatabase = async () => {
    if (!confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
      return
    }

    setClearing(true)
    const loadingToast = toast.loading('Clearing all data...')
    
    try {
      const response = await fetch('/api/clear', { method: 'DELETE' })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Clear failed')
      }
      
      toast.success('All data cleared!', { id: loadingToast })
      
      // Refresh to show empty state
      setRecords([])
    } catch (error: any) {
      toast.error(`Clear failed: ${error.message}`, { id: loadingToast })
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800 border-green-300'
      case 'negative': return 'bg-red-100 text-red-800 border-red-300'
      case 'neutral': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-gray-100 text-gray-600 border-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700 border-green-200'
      case 'pending': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'processing': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'failed': return 'bg-red-50 text-red-700 border-red-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Toaster position="top-right" />
      
      <div className="max-w-6xl mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Aviation Discussions Sentiment Analysis
          </h1>
          <p className="text-gray-600 mb-2">
          This is my LLM-powered sentiment analysis pipeline. The goal is to scrape information from four different fighter jet-related subreddits. I'm an aviation enthusiast, so I figured that for this challenge, I might as well scrape r/FighterJets, r/aviation, r/WarplanePorn, and r/hoggit. This pipeline uses Reddit JSON as the scraper (which is completely free). Then, it runs Supabase INSERT to store raw data, Supabase SELECT to get pending records, Supabase UPDATE to lock as processing, and then runs a batch analysis using OpenAI's affordable gpt-4o-mini model, before the dispositions (or sentiments) are sent back to Supabase, and then the UI is refreshed.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            by <span className="font-semibold text-gray-700">David Alfonso Castro</span>
          </p>
          
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={runPipeline}
              disabled={running}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              {running ? 'Running Pipeline...' : 'Run Data Pipeline'}
            </button>
            
            {failedCount > 0 && (
              <button
                onClick={retryFailed}
                disabled={retrying}
                className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                {retrying ? 'Retrying...' : `Retry Failed (${failedCount})`}
              </button>
            )}
            
            <button
              onClick={fetchRecords}
              disabled={loading}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>

            <button
              onClick={clearDatabase}
              disabled={clearing}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              {clearing ? 'Clearing...' : 'Clear All Data'}
            </button>
          </div>
        </header>

        {loading && records.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin text-6xl mb-4">Loading...</div>
            <p className="text-gray-600">Loading data...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <div className="text-6xl mb-4">No Data</div>
            <p className="text-gray-600 text-lg mb-4">No data yet</p>
            <p className="text-gray-500">Click "Run Data Pipeline" to start scraping and analyzing fighter jet discussions!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Showing {records.length} records
            </div>
            
            {records.map((record) => (
              <div key={record.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">
                      {record.source}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                  </div>
                  
                  {record.sentiment && record.status === 'completed' && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(record.sentiment)}`}>
                      {record.sentiment.toUpperCase()}
                    </span>
                  )}
                </div>
                
                <p className="text-gray-800 mb-3 leading-relaxed">
                  {truncateText(record.content)}
                </p>
                
                {record.status === 'completed' && record.analysis && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-900">
                      <strong className="font-semibold">AI Analysis:</strong>{' '}
                      {record.analysis.summary || JSON.stringify(record.analysis)}
                    </p>
                  </div>
                )}
                
                {record.status === 'failed' && record.error_message && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm text-red-900">
                      <strong className="font-semibold">Error:</strong>{' '}
                      {record.error_message}
                    </p>
                  </div>
                )}
                
                <div className="mt-3 text-xs text-gray-500">
                  Created: {new Date(record.created_at).toLocaleString()}
                  {record.analyzed_at && ` • Analyzed: ${new Date(record.analyzed_at).toLocaleString()}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
