import fs from 'fs/promises'
import path from 'path'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = (body && body.username) || null
  if (!username) {
    throw createError({ statusCode: 400, statusMessage: 'username is required' })
  }

  // Validate and sanitize limit parameter
  let limit = (body && body.limit) || null
  if (limit && (typeof limit !== 'number' || limit < 1)) {
    limit = null
  }

  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const jobFile = path.join(process.cwd(), 'jobs', `${jobId}.json`)
  const initial = {
    status: 'pending',
    username,
    limit: limit || null,
    total: 0,
    completed: 0,
    archive: null,
  }

  await fs.mkdir(path.dirname(jobFile), { recursive: true })
  await fs.writeFile(jobFile, JSON.stringify(initial, null, 2))

  // background processing
  ;(async () => {
    const updateJob = async (patch) => {
      try {
        const content = await fs.readFile(jobFile, 'utf8')
        const data = JSON.parse(content || '{}')
        const merged = { ...data, ...patch }
        await fs.writeFile(jobFile, JSON.stringify(merged, null, 2))
      } catch (e) {
        // ignore
      }
    }

    try {
      await updateJob({ status: 'processing' })
      const mod = await import('../utils/downloadProfile.js')
      const downloader = mod.downloadProfile || mod.default
      await downloader(jobId, username, updateJob, limit)
    } catch (err) {
      await updateJob({ status: 'failed', error: String(err) })
    }
  })()

  return { jobId }
})
 