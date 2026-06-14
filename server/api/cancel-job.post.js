import { cancelJobDownloads } from '../utils/downloadQueue.js'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const jobId = body?.jobId ? String(body.jobId) : null
  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }

  try {
    const cancelled = await cancelJobDownloads(jobId)
    return { cancelled }
  } catch (error) {
    console.error('[cancel-job]', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Unable to cancel job',
      message: error.message || 'Internal server error'
    })
  }
})