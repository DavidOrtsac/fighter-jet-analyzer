import { ApifyClient } from 'apify-client'

const apifyToken = process.env.APIFY_API_TOKEN!

if (!apifyToken) {
  throw new Error('Missing APIFY_API_TOKEN environment variable')
}

export const apifyClient = new ApifyClient({
  token: apifyToken,
})

