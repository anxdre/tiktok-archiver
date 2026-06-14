import { cleanupOldStorage } from '../utils/cleanup.js'
import { createError } from 'h3'

export default defineEventHandler(async () => {
  try {
    const removed = await cleanupOldStorage()
    return { removed }
  } catch (error) {
    console.error('[cleanup-old-storage]', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Cleanup failed',
      message: String(error?.message || error || 'Internal server error')
    })
  }
})
