import { readJob, updateJob, updateVideos } from '../../utils/jobStore.js'
import { downloadQueue } from '../../utils/downloadQueue.js'
import { emitProgress } from '../../utils/wsEvents.js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const jobId = body?.jobId ? String(body.jobId) : null
  const videoIds = Array.isArray(body?.videoIds) ? body.videoIds : null

  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }

  const job = await readJob(jobId)
  const candidates = (job.videos || []).filter((video) => {
    const wantsSelected = !videoIds || videoIds.length === 0 || videoIds.includes(video.id)
    return wantsSelected && ['pending', 'failed'].includes(video.status)
  })

  if (!candidates.length) {
    return { queued: 0 }
  }

  await updateVideos(jobId, candidates.map((video) => video.id), { status: 'pending', error: null })
  candidates.forEach((video) => {
    emitProgress('videoQueued', {
      jobId,
      videoId: video.id,
      status: 'pending',
      progress: 0
    })
  })

  await updateJob(jobId, { status: 'processing' })

  await Promise.all(
    candidates.map((video) =>
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

  return { queued: candidates.length }
})
