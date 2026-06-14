import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { execa } from 'execa'
import archiver from 'archiver'

const ROOT = process.cwd()

/**
 * Inject TikTok cookies if available
 */
function buildYtDlpArgs(baseArgs) {
    const cookieBrowser = process.env.TIKTOK_COOKIES_BROWSER

    if (cookieBrowser) {
        return [
            ...baseArgs,
            '--cookies-from-browser',
            cookieBrowser
        ]
    }

    return baseArgs
}

/**
 * Download and archive a TikTok profile
 * @param {string} jobId - Unique job identifier
 * @param {string} username - TikTok username to archive
 * @param {function} updateJob - Callback to update job status
 * @param {number|null} limit - Maximum number of videos to download (optional)
 */
function isValidVideoFile(name) {
    const ext = path.extname(name).toLowerCase()
    const allowed = new Set(['.mp4', '.mov', '.mkv', '.webm', '.ts', '.avi', '.flv', '.ogv', '.ogg'])
    return !name.endsWith('.part') && allowed.has(ext)
}

async function listValidVideoFiles(downloadsPath) {
    const files = await fs.readdir(downloadsPath)
    return files.filter(isValidVideoFile)
}

export async function downloadProfile(jobId, username, updateJob, limit = null) {
    const downloadsPath = path.join(ROOT, 'downloads', jobId)
    const archivesPath = path.join(ROOT, 'archives')

    await fs.mkdir(downloadsPath, { recursive: true })
    await fs.mkdir(archivesPath, { recursive: true })

    const profileUrl = `https://www.tiktok.com/@${username}`
    const videoLimit = (limit && typeof limit === 'number' && limit > 0) ? Math.floor(limit) : null
    let total = videoLimit || 0
    let stderrLog = ''
    let downloadError = null

    // Estimate total based on profile metadata and limit
    try {
        const discoveryArgs = buildYtDlpArgs([
            '--flat-playlist',
            '--dump-single-json',
            ...(videoLimit ? ['--playlist-end', String(videoLimit)] : []),
            profileUrl
        ])

        const result = await execa('yt-dlp', discoveryArgs)
        const json = JSON.parse(result.stdout)

        if (Array.isArray(json.entries)) {
            total = videoLimit ? Math.min(json.entries.length, videoLimit) : json.entries.length
        }
    } catch (err) {
        if (videoLimit) {
            total = videoLimit
        }
        stderrLog += String(err)
    }

    await updateJob({ status: 'processing', total })

    const baseArgs = [
        profileUrl,
        '-o',
        `${path.join('downloads', jobId)}/%(upload_date)s-%(id)s.%(ext)s`,
        '--ignore-errors',
        '--continue',
        '--retries', '10',
        '--fragment-retries', '10',
        '--sleep-interval', '2',
        '--max-sleep-interval', '5',
        '--user-agent', 'Mozilla/5.0',
        ...(videoLimit ? ['--playlist-end', String(videoLimit)] : [])
    ]

    const downloadArgs = buildYtDlpArgs(baseArgs)
    const child = execa('yt-dlp', downloadArgs, {
        cwd: ROOT,
        buffer: false
    })

    const countInterval = setInterval(async () => {
        try {
            const validFiles = await listValidVideoFiles(downloadsPath)
            await updateJob({ completed: validFiles.length })
        } catch (_) { }
    }, 1000)

    try {
        child.stderr?.on('data', (chunk) => {
            stderrLog += chunk.toString()
        })
        await child
    } catch (err) {
        downloadError = stderrLog || String(err)
    } finally {
        clearInterval(countInterval)
    }

    const validFiles = await listValidVideoFiles(downloadsPath)
    const completed = validFiles.length
    const finalTotal = videoLimit ? Math.min(total || completed, videoLimit) : Math.max(total, completed)

    if (completed === 0) {
        await updateJob({
            status: 'failed',
            completed: 0,
            total: finalTotal,
            error: downloadError || 'No videos were downloaded.'
        })
        return
    }

    await updateJob({ completed, total: finalTotal })
    await updateJob({ status: 'zipping' })

    const archivePath = path.join(archivesPath, `${jobId}.zip`)

    await new Promise((resolve, reject) => {
        const output = fsSync.createWriteStream(archivePath)
        const archive = archiver('zip', { zlib: { level: 9 } })

        output.on('close', async () => {
            try {
                const statusValue = downloadError ? 'finished_partial' : 'finished'
                const update = {
                    status: statusValue,
                    completed,
                    total: finalTotal,
                    archive: `archives/${jobId}.zip`
                }
                if (downloadError) {
                    update.error = downloadError || 'Some videos failed but archive created'
                }
                await updateJob(update)
                resolve()
            } catch (e) {
                reject(e)
            }
        })

        archive.on('error', async (err) => {
            await updateJob({
                status: 'failed',
                error: String(err)
            })
            reject(err)
        })

        archive.pipe(output)
        validFiles.forEach((file) => {
            archive.file(path.join(downloadsPath, file), { name: file })
        })
        archive.finalize()
    })
}

export default downloadProfile