import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import archiver from 'archiver'
import { readJob, getArchivePath, syncJobStatus } from '../../utils/jobStore.js'

function isDownloadedFile(name) {
  return !name.endsWith('.part') && path.extname(name).toLowerCase() === '.mp4'
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const jobId = body?.jobId ? String(body.jobId) : null
  const selectedVideoIds = Array.isArray(body?.selectedVideoIds) ? body.selectedVideoIds : []
  if (!jobId) {
    throw createError({ statusCode: 400, statusMessage: 'jobId is required' })
  }
  if (!selectedVideoIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'selectedVideoIds is required' })
  }

  const job = await readJob(jobId)
  const selectedVideos = job.videos.filter((video) => selectedVideoIds.includes(video.id) && video.status === 'done' && video.filePath)
  if (!selectedVideos.length) {
    throw createError({ statusCode: 400, statusMessage: 'No downloaded files available for selected videos' })
  }

  const zipName = `${jobId}-selected.zip`
  const zipPath = getArchivePath(zipName)
  await fs.mkdir(path.dirname(zipPath), { recursive: true })

  await new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve())
    archive.on('error', reject)

    archive.pipe(output)
    selectedVideos.forEach((video) => {
      const filePath = path.join(process.cwd(), video.filePath)
      archive.file(filePath, { name: `${video.id}.mp4` })
    })
    archive.finalize()
  })

  await syncJobStatus(jobId)
  return { archiveName: zipName }
})