import { readJob, syncJobStatus } from '../../utils/jobStore.js'

export default defineEventHandler(async (event) => {
  const { jobId } = event.context.params || {}
  if (!jobId) throw createError({ statusCode: 400, statusMessage: 'jobId required' })

  try {
    const job = await syncJobStatus(jobId)
    return job
  } catch (e) {
    throw createError({ statusCode: 404, statusMessage: 'job not found' })
  }
})
