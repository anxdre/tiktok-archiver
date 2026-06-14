import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { sendStream } from 'h3'
import { readJob, updateVideo } from '../../../utils/jobStore.js'
import { execa } from 'execa'

function extFromContentType(ct) {
  if (!ct) return '.jpg'
  const s = ct.toLowerCase()
  if (s.includes('png')) return '.png'
  if (s.includes('webp')) return '.webp'
  if (s.includes('gif')) return '.gif'
  if (s.includes('jpeg') || s.includes('jpg')) return '.jpg'
  return '.jpg'
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

export default defineEventHandler(async (event) => {
  const jobId = event.context.params?.jobId
  const videoId = event.context.params?.videoId
  if (!jobId || !videoId) throw createError({ statusCode: 400, statusMessage: 'jobId and videoId required' })

  const thumbsDir = path.join(process.cwd(), 'downloads', jobId, 'thumbs')
  await fsPromises.mkdir(thumbsDir, { recursive: true })

  // check cache first (common extensions)
  const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
  const candidates = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  for (const e of candidates) {
    const p = path.join(thumbsDir, `${videoId}${e}`)
    try {
      const st = await fsPromises.stat(p)
      const age = Date.now() - (st.mtimeMs || st.ctimeMs || 0)
      if (age > TTL_MS) {
        // stale: remove and continue to re-fetch
        try { await fsPromises.unlink(p) } catch (u) { }
        continue
      }
      const stream = fs.createReadStream(p)
      return sendStream(event, stream)
    } catch (err) {
      // not found or stat failed, continue
    }
  }

  // load job and validate
  let job
  try {
    job = await readJob(jobId)
  } catch (err) {
    throw createError({ statusCode: 404, statusMessage: 'job not found' })
  }

  if (!job.videos || !Array.isArray(job.videos)) {
    throw createError({ statusCode: 404, statusMessage: 'videos not found' })
  }

  let video = job.videos.find((v) => String(v.id) === String(videoId))
  if (!video) throw createError({ statusCode: 404, statusMessage: 'video not found' })

  // if no thumbnail in job, try to enrich via yt-dlp metadata
  if (!video.thumbnail) {
    try {
      const meta = await execa('yt-dlp', ['--skip-download', '--dump-single-json', video.url])
      const entry = JSON.parse(meta.stdout || '{}')
      if (entry && entry.thumbnail) {
        await updateVideo(jobId, video.id, { thumbnail: entry.thumbnail })
        video = { ...video, thumbnail: entry.thumbnail }
      }
    } catch (err) {
      // ignore metadata failure
    }
  }

  const remote = video.thumbnail
  if (!remote) {
    // fallback to placeholder
    const placeholder = path.join(process.cwd(), 'public', 'thumb-placeholder.svg')
    try {
      await fsPromises.access(placeholder)
      return sendStream(event, fs.createReadStream(placeholder))
    } catch (e) {
      throw createError({ statusCode: 404, statusMessage: 'thumbnail not available' })
    }
  }

  // fetch remote thumbnail with retry/backoff for transient errors
  const maxAttempts = 3
  let attempt = 0
  let res
  let lastStatus = 0
  while (attempt < maxAttempts) {
    attempt += 1
    try {
      res = await fetch(remote, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
      lastStatus = res.status
      if (res.ok) break
      // if 429 or 503, retry after backoff
      if (res.status === 429 || res.status === 503) {
        const delay = 500 * Math.pow(2, attempt)
        await sleep(delay)
        continue
      }
      // 403 likely blocked, do not retry
      break
    } catch (err) {
      // network error: retry
      const delay = 500 * Math.pow(2, attempt)
      await sleep(delay)
      continue
    }
  }

  if (!res || !res.ok) {
    // if blocked or failed, return placeholder if available
    const placeholder = path.join(process.cwd(), 'public', 'thumb-placeholder.svg')
    try {
      await fsPromises.access(placeholder)
      return sendStream(event, fs.createReadStream(placeholder))
    } catch (e) {
      throw createError({ statusCode: 502, statusMessage: `failed to fetch thumbnail (${lastStatus})` })
    }
  }

  // save to cache with proper extension
  const contentType = res.headers.get('content-type') || ''
  const ext = extFromContentType(contentType) || path.extname(new URL(remote).pathname) || '.jpg'
  const savePath = path.join(thumbsDir, `${videoId}${ext}`)

  // write response body to file (handle both web and node fetch bodies)
  try {
    const buf = Buffer.from(await res.arrayBuffer())
    await fsPromises.writeFile(savePath, buf)
  } catch (err) {
    // fallback: try streaming if possible
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(savePath)
      if (res.body && typeof res.body.pipe === 'function') {
        res.body.pipe(fileStream)
        res.body.on('error', reject)
        fileStream.on('finish', resolve)
        fileStream.on('error', reject)
      } else {
        reject(new Error('response body not streamable'))
      }
    })
  }

  // update job with cached path (store remote URL in thumbnail still)
  try { await updateVideo(jobId, video.id, { thumbnail: video.thumbnail || remote }) } catch (e) { }

  return sendStream(event, fs.createReadStream(savePath))
})
