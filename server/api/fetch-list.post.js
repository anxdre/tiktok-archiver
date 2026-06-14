import { createJob } from '../utils/jobStore.js'
import { fetchVideoList, resolveProfileData } from '../utils/tiktokProfileFetcher.js'

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = (body && body.username) ? String(body.username).replace(/^@/, '') : null
  if (!username) {
    throw createError({ statusCode: 400, statusMessage: 'username is required' })
  }

  const jobId = `${Date.now().toString(36)}-${randomSuffix()}`
  const profileUrl = `https://www.tiktok.com/@${username}`

  let entries
  try {
    entries = await fetchVideoList(profileUrl)
  } catch (fetchError) {
    const message = String(fetchError?.message || fetchError || '')
    if (/404|not found|page not found|unable to extract|uploader id|user does not exist|account does not exist/i.test(message)) {
      throw createError({ statusCode: 404, statusMessage: 'TikTok account not found' })
    }
    throw fetchError
  }

  const videos = (entries || [])
    .filter((entry) => entry && (entry.id || entry.url))
    .map((entry) => {
      return {
        id: entry.id || entry.url || null,
        url: entry.url || entry.id || null,
        title: entry.title || entry.fulltitle || entry.id || 'Untitled',
        uploadDate: entry.upload_date || entry.upload_date || null,
        status: 'pending',
        thumbnail: entry.thumbnail || null
      }
    })

  const profile = await resolveProfileData(profileUrl, username).catch((error) => {
    console.warn(`[fetch-list] profile metadata failed for ${profileUrl}: ${String(error)}`)
    return {
      username,
      displayName: username,
      profileUrl,
      profileImage: null,
      description: null,
      followerCount: null,
      followingCount: null,
      likeCount: null,
      videoCount: videos.length,
      raw: {
        error: String(error)
      }
    }
  })

  const job = {
    jobId,
    username,
    status: 'idle',
    profile,
    videos,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await createJob(job)
  // asynchronously enrich thumbnails for entries missing them
  ;(async () => {
    for (const v of job.videos) {
      if (v.thumbnail) continue
      try {
        const meta = await execa('yt-dlp', ['--skip-download', '--dump-single-json', v.url])
        const entry = JSON.parse(meta.stdout)
        if (entry && entry.thumbnail) {
          await updateVideo(jobId, v.id, { thumbnail: entry.thumbnail })
        }
      } catch (e) {
        // ignore per-video metadata failures
      }
    }
  })()

  return { jobId, videos: job.videos, profile: job.profile }
})