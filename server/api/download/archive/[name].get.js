import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { sendStream } from 'h3'

export default defineEventHandler(async (event) => {
  const name = event.context.params?.name
  if (!name) throw createError({ statusCode: 400, statusMessage: 'name is required' })

  const archivePath = path.join(process.cwd(), 'archives', name)
  try {
    await fsPromises.access(archivePath)
  } catch (e) {
    throw createError({ statusCode: 404, statusMessage: 'archive not found' })
  }

  const res = event.node.res
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`)

  const stream = fs.createReadStream(archivePath)
  return sendStream(event, stream)
})