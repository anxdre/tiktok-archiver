import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { sendStream } from 'h3'
import { readJob, updateVideo } from '../../../utils/jobStore.js'
import { execa } from 'execa'

function extFromContentType(ct) {
  if (!ct) return '.jpg'
  if (ct.includes('png')) return '.png'
  if (ct.includes('webp')) return '.webp'
  if (ct.includes('gif')) return '.gif'
  return '.jpg'
}

export default defineEventHandler(async (event) => {
  const jobId = event.context.params?.jobId
  const videoId = event.context.params?.videoId
  if (!jobId || !videoId) throw createError({ statusCode: 400, statusMessage: 'jobId and videoId required' })

  const thumbsDir = path.join(process.cwd(), 'downloads', jobId, 'thumbs')
  await fsPromises.mkdir(thumbsDir, { recursive: true })

  // try to find existing file by common extensions
  const candidates = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  for (const e of candidates) {
    const p = path.join(thumbsDir, `${videoId}${e}`)
    try {
      await fsPromises.access(p)
      const stream = fs.createReadStream(p)
      return sendStream(event, stream)
    } catch (e) {
      // not found, continue
    }
  }

  // need to fetch remote thumbnail and cache
  let job
  try {
    job = await readJob(jobId)
  } catch (e) {
    throw createError({ statusCode: 404, statusMessage: 'job not found' })
  }

  let video = (job.videos || []).find((v) => String(v.id) === String(videoId))
  if (!video) throw createError({ statusCode: 404, statusMessage: 'video not found' })

  // if thumbnail missing, try to fetch per-video metadata and update job
  if (!video.thumbnail) {
    try {
      const meta = await execa('yt-dlp', ['--skip-download', '--dump-single-json', video.url])
      const entry = JSON.parse(meta.stdout)
      if (entry && entry.thumbnail) {
        await updateVideo(jobId, video.id, { thumbnail: entry.thumbnail })
        video = { ...video, thumbnail: entry.thumbnail }
      }
    } catch (err) {
      // continue and attempt to fetch remote from whatever thumbnail exists
    }
  }

  const remote = video.thumbnail
  if (!remote) {
    throw createError({ statusCode: 404, statusMessage: 'thumbnail not available' })
  }
  let res
  try {
    res = await fetch(remote)
  } catch (err) {
    throw createError({ statusCode: 502, statusMessage: 'failed to fetch thumbnail' })
  }
  if (!res.ok || !res.body) {
    throw createError({ statusCode: 502, statusMessage: 'failed to fetch thumbnail' })
  }

  const contentType = res.headers.get('content-type') || ''
  const ext = extFromContentType(contentType) || path.extname(new URL(remote).pathname) || '.jpg'
  const savePath = path.join(thumbsDir, `${videoId}${ext}`)

  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(savePath)
    res.body.pipe(fileStream)
    res.body.on('error', reject)
    fileStream.on('finish', resolve)
    fileStream.on('error', reject)
  })

  const stream = fs.createReadStream(savePath)
  return sendStream(event, stream)
})
