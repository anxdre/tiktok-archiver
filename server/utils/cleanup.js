import fs from 'fs/promises'
import path from 'path'

const ROOT = process.cwd()
const JOBS_DIR = path.join(ROOT, 'jobs')
const DOWNLOADS_DIR = path.join(ROOT, 'downloads')
const ARCHIVES_DIR = path.join(ROOT, 'archives')
const DEFAULT_TTL_DAYS = 7
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getTtlMs() {
  const days = Number(process.env.CLEANUP_TTL_DAYS || DEFAULT_TTL_DAYS)
  return Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000
}

async function removeFile(filePath) {
  try {
    await fs.unlink(filePath)
  } catch {
    // ignore failures
  }
}

async function removePath(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true })
  } catch {
    // ignore failures
  }
}

async function listEntries(directory) {
  try {
    return await fs.readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }
}

export async function cleanupOldStorage() {
  const ttlMs = getTtlMs()
  const now = Date.now()
  const removed = {
    jobs: 0,
    downloads: 0,
    archives: 0
  }

  const jobFiles = await listEntries(JOBS_DIR)
  for (const entry of jobFiles) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const filePath = path.join(JOBS_DIR, entry.name)
    try {
      const stat = await fs.stat(filePath)
      if (now - stat.mtimeMs <= ttlMs) continue

      const jobId = entry.name.replace(/\.json$/, '')
      await removeFile(filePath)
      removed.jobs += 1
      await removePath(path.join(DOWNLOADS_DIR, jobId))
      removed.downloads += 1

      const archiveFiles = await listEntries(ARCHIVES_DIR)
      for (const archiveEntry of archiveFiles) {
        if (!archiveEntry.isFile()) continue
        if (archiveEntry.name.startsWith(jobId)) {
          await removeFile(path.join(ARCHIVES_DIR, archiveEntry.name))
          removed.archives += 1
        }
      }
    } catch {
      // ignore per-file cleanup failures
    }
  }

  return removed
}

export function startCleanupScheduler() {
  if (globalThis.tiktokCleanupSchedulerStarted) {
    return
  }
  globalThis.tiktokCleanupSchedulerStarted = true

  async function runCleanup() {
    try {
      const removed = await cleanupOldStorage()
      console.info(`[cleanup] removed ${removed.jobs} job files, ${removed.downloads} download folders, ${removed.archives} archive files`)
    } catch (error) {
      console.error('[cleanup] failed to remove old storage', error)
    }
  }

  runCleanup()
  setInterval(runCleanup, CLEANUP_INTERVAL_MS)
}
