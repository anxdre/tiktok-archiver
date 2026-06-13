import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { sendStream } from 'h3'

export default defineEventHandler(async (event) => {
  const { jobId } = event.context.params || {}
  if (!jobId) throw createError({ statusCode: 400, statusMessage: 'jobId required' })

  const archivePath = path.join(process.cwd(), 'archives', `${jobId}.zip`)
  try {
    await fsPromises.access(archivePath)
  } catch (e) {
    throw createError({ statusCode: 404, statusMessage: 'archive not found' })
  }

  const res = event.node.res
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${jobId}.zip"`)

  const stream = fs.createReadStream(archivePath)
  return sendStream(event, stream)
})
