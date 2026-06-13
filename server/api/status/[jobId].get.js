import fs from 'fs/promises'
import path from 'path'

export default defineEventHandler(async (event) => {
  const { jobId } = event.context.params || {}
  if (!jobId) throw createError({ statusCode: 400, statusMessage: 'jobId required' })
  const file = path.join(process.cwd(), 'jobs', `${jobId}.json`)
  try {
    const content = await fs.readFile(file, 'utf8')
    return JSON.parse(content)
  } catch (e) {
    throw createError({ statusCode: 404, statusMessage: 'job not found' })
  }
})
