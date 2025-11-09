/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    onRetry?: (attempt: number, error: any) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry
  } = options

  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      if (attempt < maxRetries - 1) {
        // Calculate exponential backoff with max limit
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
        
        console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, error.message)
        console.log(`Retrying in ${delay}ms...`)
        
        if (onRetry) {
          onRetry(attempt + 1, error)
        }
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // All retries exhausted
  console.error(`All ${maxRetries} attempts failed`)
  throw lastError
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Rate limit errors
  if (error.code === 'rate_limit_exceeded') return true
  if (error.status === 429) return true
  
  // Network errors
  if (error.code === 'ECONNRESET') return true
  if (error.code === 'ETIMEDOUT') return true
  if (error.code === 'ENOTFOUND') return true
  
  // Server errors (5xx)
  if (error.status >= 500 && error.status < 600) return true
  
  // Timeout errors
  if (error.message?.includes('timeout')) return true
  if (error.message?.includes('timed out')) return true
  
  return false
}

