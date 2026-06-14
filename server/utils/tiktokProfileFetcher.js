import { execa } from 'execa'

const MAX_RETRIES = 5
const BACKOFF_BASE_MS = 1000
const PROXY_LIST = (process.env.TIKTOK_PROXY_LIST || process.env.PROXY_LIST || '')
  .split(',')
  .map((proxy) => proxy.trim())
  .filter(Boolean)
const SINGLE_PROXY = process.env.TIKTOK_PROXY_URL || process.env.PROXY_URL || ''
const PROXIES = [...PROXY_LIST, ...(SINGLE_PROXY ? [SINGLE_PROXY] : [])]

function chooseProxy(exclude = []) {
  const candidates = PROXIES.filter((proxy) => !exclude.includes(proxy))
  if (!candidates.length) {
    return null
  }
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function isRateLimitError(text) {
  return /429|too many requests|rate limit|quota exceeded/i.test(text)
}

function parseJsonOutput(output) {
  if (!output || typeof output !== 'string') {
    throw new Error('No JSON output received from yt-dlp')
  }

  const trimmed = output.trim()
  try {
    return JSON.parse(trimmed)
  } catch (error) {
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(lines[i])
      } catch (e) {
        continue
      }
    }
    throw new Error('Failed to parse yt-dlp JSON output')
  }
}

function buildYtDlpBaseArgs() {
  return [
    '--sleep-interval', '2',
    '--max-sleep-interval', '6',
    '--retries', '10',
    '--fragment-retries', '10',
    '--ignore-errors',
    '--continue',
    '--user-agent', 'Mozilla/5.0'
  ]
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runYtDlpJson(args) {
  let triedProxies = []
  let lastError = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const proxy = chooseProxy(triedProxies)
    const argsWithProxy = [...args]

    if (proxy) {
      argsWithProxy.unshift('--proxy', proxy)
    }

    try {
      const { stdout } = await execa('yt-dlp', argsWithProxy)
      return parseJsonOutput(stdout)
    } catch (error) {
      const errorText = [error.stdout, error.stderr, error.message].filter(Boolean).join(' ')
      lastError = errorText || String(error)

      if (isRateLimitError(errorText)) {
        if (proxy) {
          triedProxies.push(proxy)
        }
        const delay = BACKOFF_BASE_MS * 2 ** attempt
        console.warn(`[tiktokProfileFetcher] 429 detected; retrying in ${delay}ms${proxy ? ` with next proxy (failed proxy: ${proxy})` : ''}`)
        await sleep(delay)
        continue
      }

      throw new Error(`yt-dlp failed: ${errorText}`)
    }
  }

  throw new Error(`yt-dlp retry limit exceeded: ${lastError}`)
}

function extractMetaImage(html) {
  if (!html || typeof html !== 'string') {
    return null
  }

  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  const metaMatches = [...html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]*>/gi)]
  for (const match of metaMatches) {
    const url = match[1].trim()
    if (/https?:\/\//i.test(url) && /avatar|profile|image|logo/i.test(url)) {
      return url
    }
  }

  return null
}

async function fetchHtml(url) {
  if (typeof fetch !== 'function') {
    return null
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    })
    if (!response.ok) {
      return null
    }
    return await response.text()
  } catch (error) {
    return null
  }
}

function normalizeInteger(value) {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const parsed = Number(String(value).replace(/[^0-9]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function pickProfileImage(metadata) {
  const candidates = []
  if (metadata.thumbnail) candidates.push({ url: metadata.thumbnail, source: 'yt-dlp' })
  if (metadata.uploader_thumbnail) candidates.push({ url: metadata.uploader_thumbnail, source: 'yt-dlp' })
  if (metadata.channel_thumbnail) candidates.push({ url: metadata.channel_thumbnail, source: 'yt-dlp' })
  return candidates.find((candidate) => candidate.url) || null
}

function buildProfileObject(metadata, username, profileUrl, html) {
  const profileImageCandidate = pickProfileImage(metadata)
  let profileImage = profileImageCandidate?.url || null
  let profileImageSource = profileImageCandidate?.source || null

  if (!profileImage && html) {
    const htmlImage = extractMetaImage(html)
    if (htmlImage) {
      profileImage = htmlImage
      profileImageSource = 'html-meta'
    }
  }

  if (!profileImage) {
    console.warn(`[fetch-list] missing profileImage for ${profileUrl}`)
  }

  return {
    username: metadata.uploader_id || metadata.uploader || username,
    displayName: metadata.uploader || metadata.creator || metadata.fullname || username,
    profileUrl: metadata.uploader_url || metadata.webpage_url || profileUrl,
    profileImage,
    description: metadata.description || metadata.summary || null,
    followerCount: normalizeInteger(metadata.channel_follower_count ?? metadata.subscriber_count ?? metadata.follower_count),
    followingCount: normalizeInteger(metadata.channel_following_count ?? metadata.following_count),
    likeCount: normalizeInteger(metadata.channel_like_count ?? metadata.like_count),
    videoCount: normalizeInteger(metadata.channel_videos_count ?? metadata.playlist_count ?? metadata.n_entries ?? metadata.video_count),
    raw: {
      uploader: metadata.uploader,
      uploader_id: metadata.uploader_id,
      profileUrl: metadata.uploader_url || metadata.webpage_url,
      description: metadata.description || metadata.summary,
      thumbnail: metadata.thumbnail,
      uploader_thumbnail: metadata.uploader_thumbnail,
      channel_thumbnail: metadata.channel_thumbnail,
      followerCountSource: metadata.channel_follower_count ? 'channel_follower_count' : metadata.subscriber_count ? 'subscriber_count' : metadata.follower_count ? 'follower_count' : null,
      profileImageSource: profileImageSource || (profileImage ? 'unknown' : null)
    }
  }
}

export async function fetchVideoList(profileUrl) {
  const args = [
    '--flat-playlist',
    '--dump-single-json',
    ...buildYtDlpBaseArgs(),
    profileUrl
  ]
  const metadata = await runYtDlpJson(args)
  if (!metadata || !Array.isArray(metadata.entries)) {
    throw new Error('Unexpected yt-dlp playlist output')
  }
  return metadata.entries
}

export async function fetchProfileMetadata(profileUrl) {
  const args = [
    '--skip-download',
    '--dump-single-json',
    ...buildYtDlpBaseArgs(),
    profileUrl
  ]
  return runYtDlpJson(args)
}

export async function resolveProfileData(profileUrl, username) {
  const metadata = await fetchProfileMetadata(profileUrl)
  const html = await fetchHtml(profileUrl)
  return buildProfileObject(metadata || {}, username, profileUrl, html)
}

export async function resolveVideoThumbnail(url) {
  const args = [
    '--skip-download',
    '--dump-single-json',
    ...buildYtDlpBaseArgs(),
    url
  ]
  const metadata = await runYtDlpJson(args)
  return metadata && metadata.thumbnail ? String(metadata.thumbnail) : null
}
