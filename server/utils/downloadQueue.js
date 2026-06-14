import fs from 'fs/promises'
import path from 'path'
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { execa } from 'execa'
import { readJob, updateJob, updateVideo, updateVideos, syncJobStatus, getDownloadPath } from './jobStore.js'
import { emitProgress } from './wsEvents.js'

const ROOT = process.cwd()
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
const QUEUE_NAME = 'tiktok-video-download'

const activeDownloads = new Map()
const cancelledDownloads = new Set()

function downloadKey(jobId, videoId) {
  return `${jobId}:${videoId}`
}

function registerActiveDownload(jobId, videoId, child) {
  const key = downloadKey(jobId, videoId)
  activeDownloads.set(key, { child, cancelRequested: false })
  const cleanup = () => {
    activeDownloads.delete(key)
    cancelledDownloads.delete(key)
  }
  child.on('exit', cleanup)
  child.on('error', cleanup)
  return key
}

export async function cancelJobDownloads(jobId) {
  const job = await readJob(jobId)
  const pendingOrDownloading = (job.videos || []).filter((video) => ['pending', 'downloading'].includes(video.status))
  const cancelledIds = []

  await Promise.all(pendingOrDownloading.map(async (video) => {
    const key = downloadKey(jobId, video.id)
    const active = activeDownloads.get(key)
    if (active) {
      active.cancelRequested = true
      cancelledDownloads.add(key)
      if (active.child && !active.child.killed) {
        active.child.kill('SIGTERM')
      }
      cancelledIds.push(video.id)
      return
    }

    const queueJobId = `video-${jobId}-${video.id}`
    const queueJob = await downloadQueue.getJob(queueJobId)
    if (queueJob) {
      try {
        await queueJob.remove()
        cancelledIds.push(video.id)
      } catch (removeError) {
        console.warn(`[downloadQueue] failed to remove queued job ${queueJobId}:`, removeError)
      }
    }
  }))

  if (!cancelledIds.length) {
    return 0
  }

  await updateVideos(jobId, cancelledIds, { status: 'pending', error: 'Cancelled by user' })
  await updateJob(jobId, { status: 'cancelled' })

  cancelledIds.forEach((videoId) => {
    emitProgress('videoCancelled', {
      jobId,
      videoId,
      status: 'pending',
      progress: 0,
      error: 'Cancelled by user'
    })
  })

  return cancelledIds.length
}

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    return Math.min(times * 50, 2000)
  }
})
export const downloadQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000
    }
  }
})

async function downloadSingleVideo(jobId, video) {
  await emitProgress('videoDownloading', {
    jobId,
    videoId: video.id,
    status: 'downloading',
    progress: 0
  })

  await updateVideo(jobId, video.id, { status: 'downloading', error: null })
  await updateJob(jobId, { status: 'processing' })

  const downloadsPath = path.dirname(getDownloadPath(jobId, `${video.id}.mp4`))
  await fs.mkdir(downloadsPath, { recursive: true })

  const outputPath = getDownloadPath(jobId, `${video.id}.mp4`)
  const args = [
    video.url,
    '--no-playlist',
    '-o',
    outputPath,
    '--continue',
    '--retries',
    '5',
    '--fragment-retries',
    '5',
    '--sleep-interval',
    '2',
    '--max-sleep-interval',
    '5',
    '--user-agent',
    'Mozilla/5.0'
  ]

  const processChild = execa('yt-dlp', args, {
    cwd: ROOT
  })
  const key = registerActiveDownload(jobId, video.id, processChild)

  try {
    await processChild
  } catch (error) {
    const cancelled = cancelledDownloads.has(key)
    if (cancelled) {
      await updateVideo(jobId, video.id, {
        status: 'pending',
        error: 'Cancelled by user'
      })
      await emitProgress('videoCancelled', {
        jobId,
        videoId: video.id,
        status: 'pending',
        progress: 0,
        error: 'Cancelled by user'
      })
      return
    }
    throw error
  }

  await updateVideo(jobId, video.id, {
    status: 'done',
    filePath: path.relative(ROOT, outputPath),
    error: null
  })

  await emitProgress('videoCompleted', {
    jobId,
    videoId: video.id,
    status: 'done',
    progress: 100,
    filePath: path.relative(ROOT, outputPath)
  })
}

export function startDownloadWorker() {
  if (globalThis.tiktokVideoDownloadWorkerStarted) {
    return
  }

  globalThis.tiktokVideoDownloadWorkerStarted = true

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { jobId, video } = job.data
      await downloadSingleVideo(jobId, video)
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 600000
    },
  )

  worker.on('completed', async (job) => {
    if (!job?.data) return
    await syncJobStatus(job.data.jobId)
  })

  worker.on('failed', async (job, err) => {
    if (!job?.data) return
    const key = downloadKey(job.data.jobId, job.data.video.id)
    if (cancelledDownloads.has(key)) {
      cancelledDownloads.delete(key)
      await syncJobStatus(job.data.jobId)
      return
    }

    const attempts = job.attemptsMade || 0
    const maxAttempts = job.opts.attempts ?? 1
    if (attempts >= maxAttempts) {
      await updateVideo(job.data.jobId, job.data.video.id, {
        status: 'failed',
        error: String(err ?? 'Download failed')
      })
      await emitProgress('videoFailed', {
        jobId: job.data.jobId,
        videoId: job.data.video.id,
        status: 'failed',
        progress: 0,
        error: String(err ?? 'Download failed')
      })
      await syncJobStatus(job.data.jobId)
    }
  })

  worker.on('error', (err) => {
    console.error('[downloadQueue] worker error:', err)
  })

  return worker
}
