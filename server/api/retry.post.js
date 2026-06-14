import { readJob, updateJob, updateVideos } from '../utils/jobStore.js'
import { downloadQueue } from '../utils/downloadQueue.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const jobId = body?.jobId ? String(body.jobId) : null
  const videoIds = Array.isArray(body?.videoIds) ? body.videoIds : null

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }

  const job = await readJob(jobId)
  const failedVideos = (job.videos || []).filter((video) => video.status === 'failed')
  const videosToRetry = videoIds && videoIds.length
    ? failedVideos.filter((video) => videoIds.includes(video.id))
    : failedVideos

  if (videosToRetry.length === 0) {
    return { retryCount: 0 }
  }

  await updateVideos(jobId, videosToRetry.map((video) => video.id), { status: 'pending', error: null })
  await updateJob(jobId, { status: 'processing' })

  await Promise.all(
    videosToRetry.map((video) =>
      downloadQueue.add('video-download', { jobId, video }, {
        jobId: `video-${jobId}-${video.id}`,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000
        }
      })
    )
  )

  return { retryCount: videosToRetry.length }
})
