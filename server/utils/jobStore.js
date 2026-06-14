import fs from 'fs/promises'
import path from 'path'

const ROOT = process.cwd()
const JOBS_DIR = path.join(ROOT, 'jobs')
const DOWNLOADS_DIR = path.join(ROOT, 'downloads')
const ARCHIVES_DIR = path.join(ROOT, 'archives')

async function ensureStorage() {
  await fs.mkdir(JOBS_DIR, { recursive: true })
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true })
  await fs.mkdir(ARCHIVES_DIR, { recursive: true })
}

export function getJobFilePath(jobId) {
  return path.join(JOBS_DIR, `${jobId}.json`)
}

function findTopLevelJsonEnd(text) {
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

async function repairMalformedJobContent(file, content) {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('{')) {
    throw new Error('Invalid JSON structure for job file')
  }

  const endIndex = findTopLevelJsonEnd(content)
  if (endIndex === -1) {
    throw new Error('Could not repair malformed job JSON')
  }

  const repairedContent = content.slice(0, endIndex + 1)
  const job = JSON.parse(repairedContent)
  await fs.writeFile(file, JSON.stringify(job, null, 2), 'utf8')
  return job
}

export async function readJob(jobId) {
  const file = getJobFilePath(jobId)
  const content = await fs.readFile(file, 'utf8')

  try {
    return JSON.parse(content)
  } catch (error) {
    return repairMalformedJobContent(file, content)
  }
}

export async function writeJob(job) {
  await ensureStorage()
  const file = getJobFilePath(job.jobId)
  const tempFile = `${file}.tmp`
  job.updatedAt = new Date().toISOString()
  await fs.writeFile(tempFile, JSON.stringify(job, null, 2), 'utf8')
  await fs.rename(tempFile, file)
  return job
}

export async function createJob(job) {
  await ensureStorage()
  return writeJob(job)
}

export async function updateJob(jobId, patch) {
  const job = await readJob(jobId)
  const merged = { ...job, ...patch }
  if (patch.updatedAt === undefined) {
    merged.updatedAt = new Date().toISOString()
  }
  return writeJob(merged)
}

export async function updateVideo(jobId, videoId, patch) {
  const job = await readJob(jobId)
  const index = job.videos.findIndex((video) => video.id === videoId)
  if (index === -1) {
    throw new Error('Video not found')
  }
  job.videos[index] = {
    ...job.videos[index],
    ...patch,
    updatedAt: new Date().toISOString()
  }
  return writeJob(job)
}

export async function updateVideos(jobId, videoIds, patch) {
  const job = await readJob(jobId)
  job.videos = job.videos.map((video) => {
    if (!videoIds.includes(video.id)) return video
    return {
      ...video,
      ...patch,
      updatedAt: new Date().toISOString()
    }
  })
  return writeJob(job)
}

export function normalizeJobStatus(job) {
  const videos = job.videos || []
  if (videos.length === 0) {
    return job.status || 'idle'
  }

  const anyDownloading = videos.some((video) => video.status === 'downloading')
  const allDone = videos.every((video) => video.status === 'done')
  const anyFailed = videos.some((video) => video.status === 'failed')
  const anyPending = videos.some((video) => video.status === 'pending')

  if (anyDownloading) return 'processing'
  if (allDone) return 'finished'
  if (anyFailed && !anyPending) return 'partial'
  if (job.status === 'processing') return 'processing'
  return job.status || 'idle'
}

export async function syncJobStatus(jobId) {
  const job = await readJob(jobId)
  const status = normalizeJobStatus(job)
  if (job.status !== status) {
    job.status = status
    return writeJob(job)
  }
  return job
}

export function getDownloadPath(jobId, fileName) {
  return path.join(DOWNLOADS_DIR, jobId, fileName)
}

export function getArchivePath(fileName) {
  return path.join(ARCHIVES_DIR, fileName)
}
