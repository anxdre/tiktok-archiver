import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { execa } from 'execa'
import archiver from 'archiver'

const ROOT = process.cwd()

async function writeJob(jobId, data) {
  const file = path.join(ROOT, 'jobs', `${jobId}.json`)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2))
}

export async function downloadProfile(jobId, username, updateJob) {
  const jobsPath = path.join(ROOT, 'jobs')
  const downloadsPath = path.join(ROOT, 'downloads', jobId)
  const archivesPath = path.join(ROOT, 'archives')
  await fs.mkdir(downloadsPath, { recursive: true })
  await fs.mkdir(archivesPath, { recursive: true })

  const profileUrl = `https://www.tiktok.com/@${username}`

  // Try to discover total videos first (best-effort)
  let total = 0
  try {
    const list = await execa('yt-dlp', ['--flat-playlist', '--dump-single-json', profileUrl])
    try {
      const json = JSON.parse(list.stdout)
      if (Array.isArray(json.entries)) total = json.entries.length
    } catch (e) {
      // ignore parse errors
    }
    await updateJob({ total })
  } catch (e) {
    // best-effort; continue
  }

  // Start the download process
  await updateJob({ status: 'processing' })

  const child = execa('yt-dlp', [profileUrl, '-o', `${path.join('downloads', jobId)}/%(id)s.%(ext)s`, '--newline'], {
    buffer: false,
    cwd: ROOT,
  })

  // Periodically count completed files
  let stopped = false
  const countInterval = setInterval(async () => {
    try {
      const files = await fs.readdir(downloadsPath)
      const valid = files.filter(f => !f.endsWith('.part'))
      await updateJob({ completed: valid.length })
    } catch (e) {
      // ignore
    }
  }, 1000)

  try {
    child.stdout?.on('data', (chunk) => {
      // Could parse stdout for more granular progress; for now we rely on file counts.
      // Keep a light-weight log inside job file if desired.
    })

    child.stderr?.on('data', (chunk) => {
      // ignore or log
    })

    await child
  } catch (err) {
    clearInterval(countInterval)
    stopped = true
    await updateJob({ status: 'failed', error: String(err) })
    throw err
  }

  clearInterval(countInterval)
  // final count
  try {
    const files = await fs.readdir(downloadsPath)
    const valid = files.filter(f => !f.endsWith('.part'))
    await updateJob({ completed: valid.length, total: total || valid.length })
  } catch (e) {
    // ignore
  }

  // Create ZIP
  await updateJob({ status: 'zipping' })
  const archivePath = path.join(archivesPath, `${jobId}.zip`)

  await new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(archivePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', async () => {
      try {
        await updateJob({ status: 'finished', archive: `archives/${jobId}.zip` })
        resolve()
      } catch (e) {
        reject(e)
      }
    })

    archive.on('error', async (err) => {
      await updateJob({ status: 'failed', error: String(err) })
      reject(err)
    })

    archive.pipe(output)
    archive.directory(downloadsPath, false)
    archive.finalize()
  })
}

export default downloadProfile
