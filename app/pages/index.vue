<template>
  <div class="app-container">
    <div class="content-wrapper">
      <div v-if="overlayVisible" class="download-overlay">
        <div class="download-dialog">
          <h2>{{ overlayTitle }}</h2>
          <p>{{ overlayDescription }}</p>
          <div class="download-dialog-stats">
            <div class="download-stat-item">
              <span class="stat-number">{{ doneVideos.length }}</span>
              <span class="stat-label"> Downloaded</span>
            </div>
            <div class="download-stat-item">
              <span class="stat-number">{{ downloadingCount }}</span>
              <span class="stat-label"> Downloading</span>
            </div>
            <div class="download-stat-item">
              <span class="stat-number">{{ pendingVideos.length }}</span>
              <span class="stat-label"> Pending</span>
            </div>
            <div class="download-stat-item">
              <span class="stat-number">{{ failedVideos.length }}</span>
              <span class="stat-label"> Failed</span>
            </div>
          </div>
          <div class="progress-bar-container overlay">
            <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <p class="overlay-subtitle">{{ downloadProgressSummary }}</p>
          <div class="overlay-actions">
            <button v-if="selectedSubsetCompleted" class="action-button" @click="overlayDismissed = true">OK</button>
            <button v-else class="cancel-button overlay-cancel-button" @click="cancelActiveJob" :disabled="cancelling">
              {{ cancelling ? 'Cancelling downloads...' : 'Cancel downloads' }}
            </button>
          </div>
        </div>
      </div>
      <div class="header-section">
        <h1 class="header-title">TikTok Video Archiver</h1>
        <p class="header-subtitle">Backup and archive your tiktok profile.</p>
      </div>

      <div class="input-section">
        <div class="input-row">
          <input
              v-model="username"
              class="username-input"
              placeholder="Enter TikTok username (e.g. cristiano)"
              @keyup.enter="fetchList"
          />
          <button @click="fetchList" class="archive-button" :disabled="loading || !username || cancelling">
            <span v-if="loading" class="spinner"></span>
            <span>{{ loading ?  'Loading...' : 'Fetch Videos' }}</span>
          </button>
          <button v-if="loading" type="button" class="cancel-button" @click="cancelFetch" :disabled="cancelling">
            {{ cancelling ? 'Cancelling...' : 'Cancel' }}
          </button>
        </div>
        <span style="color: #666; font-size: 0.7em;">
          make sure to make your username public for the archiver to work properly.
        </span>
        <p v-if="loading" class="loading-message">{{ loadingMessage }}</p>
        <div v-if="errorMessage" class="alert error-alert">{{ errorMessage }}</div>
      </div>

      <div v-if="jobId" class="job-card">
        <div class="job-header">
          <div>
            <h2>@{{ username }}</h2>
            <p class="job-id">Job ID: {{ jobId }}</p>
          </div>
          <div :class="['status-badge', `status-${displayStatus}`]">{{ displayStatus }}</div>
        </div>

        <div class="profile-summary">
          <div class="profile-card">
            <div class="profile-card-avatar">
              <div v-if="profile.profileImage" class="profile-avatar-frame">
                <img :src="profile.profileImage" alt="Profile avatar" class="profile-avatar"/>
              </div>
              <div v-else class="profile-avatar-fallback">{{ profileInitials }}</div>
            </div>
            <div class="profile-card-details">
              <div class="profile-title-row">
                <div>
                  <div class="profile-name">{{ profile.displayName || username }}</div>
                  <div class="profile-username">@{{ profile.username || username }}</div>
                </div>
                <div class="profile-pill-row">
                  <div class="profile-status-pill" :class="profile.isPrivate ? 'private' : 'public'">
                    {{ profile.isPrivate ? 'Private' : 'Public' }}
                  </div>
                  <div v-if="profile.isVerified" class="profile-verified-pill">Verified</div>
                </div>
              </div>
              <p class="profile-description" v-if="profile.description">{{ profile.description }}</p>
              <div class="profile-stats-row">
                <div class="profile-stat">
                  <span class="stat-value">{{ formatCount(profile.videoCount) }}</span>
                  <span class="stat-label">Videos</span>
                </div>
                <div class="profile-stat">
                  <span class="stat-value">{{ formatCount(profile.followerCount) }}</span>
                  <span class="stat-label">Followers</span>
                </div>
                <div class="profile-stat">
                  <span class="stat-value">{{ formatCount(profile.followingCount) }}</span>
                  <span class="stat-label">Following</span>
                </div>
                <div class="profile-stat">
                  <span class="stat-value">{{ formatCount(profile.likeCount) }}</span>
                  <span class="stat-label">Likes</span>
                </div>
                <div v-if="profile.viewCount !== null" class="profile-stat">
                  <span class="stat-value">{{ formatCount(profile.viewCount) }}</span>
                  <span class="stat-label">Views</span>
                </div>
                <div v-if="profile.commentCount !== null" class="profile-stat">
                  <span class="stat-value">{{ formatCount(profile.commentCount) }}</span>
                  <span class="stat-label">Comments</span>
                </div>
                <div v-if="profile.shareCount !== null" class="profile-stat">
                  <span class="stat-value">{{ formatCount(profile.shareCount) }}</span>
                  <span class="stat-label">Shares</span>
                </div>
                <div v-if="profile.repostCount !== null" class="profile-stat">
                  <span class="stat-value">{{ formatCount(profile.repostCount) }}</span>
                  <span class="stat-label">Reposts</span>
                </div>
              </div>
              <div class="profile-hidden-row">
                <span v-if="profile.raw?.channel_id"><strong>Channel:</strong> {{ profile.raw.channel_id }}</span>
                <span v-if="profile.raw?.uploader_id"><strong>Uploader ID:</strong> {{ profile.raw.uploader_id }}</span>
                <span v-if="profile.profileUrl"><strong>URL:</strong> <a :href="profile.profileUrl" target="_blank"
                                                                         rel="noreferrer">Open</a></span>
                <span v-if="profile.raw?.country"><strong>Country:</strong> {{ profile.raw.country }}</span>
                <span v-if="profile.raw?.age_limit !== undefined"><strong>Age Limit:</strong> {{
                    profile.raw.age_limit
                  }}</span>
              </div>
              <button class="raw-toggle-button" @click="toggleProfileRaw">
                {{ showProfileRaw ? 'Hide' : 'Show' }} raw profile metadata
              </button>
              <pre v-if="showProfileRaw" class="profile-raw-json">{{ JSON.stringify(profile.raw, null, 2) }}</pre>
            </div>
          </div>
        </div>

        <div class="actions-row">
          <button @click="toggleSelectAll" class="action-button">
            {{ allSelected ? 'Deselect All' : 'Select All' }}
          </button>
          <button @click="downloadSelectedVideos" class="action-button" :disabled="selectedVideoIds.length === 0">
            Download Selected
          </button>
          <button @click="retryFailed" class="action-button" :disabled="(selectedVideoIds.length > 0 ? selectedFailedCount === 0 : failedVideos.length === 0)">Retry Failed</button>
          <button @click="downloadSelectedZip" class="action-button" :disabled="doneVideos.length === 0 || selectedVideoIds.length === 0">Download
            Selected ZIP
          </button>
          <button @click="downloadAllZip" class="action-button" :disabled="doneVideos.length === 0">Download All ZIP
          </button>
        </div>

        <div class="progress-row">
          <span v-if="selectedVideoIds.length">
            {{ selectedDoneCount }} / {{ selectedVideoIds.length }} selected downloaded
          </span>
          <span v-else>
            {{ doneVideos.length }} / {{ videos.length }} downloaded
          </span>
          <span>{{ selectedVideoIds.length }} selected</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>

        <div class="video-grid">
          <div @click="selectVideo(video)" v-for="video in videos" :key="video.id" class="video-card"
               :class="{ selected: selectedVideoIds.includes(video.id) }">
            <div class="video-top">
              <div class="thumb-wrapper">
                <div v-if="thumbLoading[video.id]" class="thumb-placeholder"></div>
                <img v-if="video.thumbnail || jobId" :src="thumbnailUrl(video)" class="video-thumb"
                     @load="onThumbLoad(video.id)" @error="onThumbError(video.id)" v-show="!thumbLoading[video.id]"
                     alt="Video thumbnail"/>
              </div>
              <div class="video-meta">
                <div class="video-id">{{ video.id }}</div>
                <div class="video-title">{{ video.title }}</div>
                <div class="video-date">{{ video.uploadDate || 'Unknown date' }}</div>
                <div :class="['status-badge', `status-${video.status}`]">{{ video.status }}</div>
              </div>
            </div>
            <button v-if="video.status === 'failed'" @click="retryVideo(video)" class="retry-button">Retry</button>
          </div>
        </div>

        <div class="last-updated">Last updated: {{ lastUpdated }}</div>
      </div>

      <div v-else class="empty-state">
        <p>Fetch a TikTok profile to begin.</p>
      </div>
    </div>
     <footer style="text-align: center; padding: 20px; color: var(--text-secondary); font-size: 12px;">
      &copy; {{ new Date().getFullYear() }} created by <a href="https://www.instagram.com/silentreactive" target="_blank" style="color: var(--accent); text-decoration: underline;">Silentreactive</a> with ❤️ in Surabaya.
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useWebSocket} from "~~/composables/useWebSocket.js";

const username = ref('')
const profile = ref({})
const showProfileRaw = ref(false)
const jobId = ref(null)
const videos = ref([])
const status = ref('idle')
const loading = ref(false)
const loadingMessage = ref('')
const errorMessage = ref('')
const cancelling = ref(false)
const fetchController = ref(null)
const overlayDismissed = ref(false)
const lastUpdated = ref('')
const selectedVideoIds = ref([])
const thumbLoading = reactive({})
const selectionDownloadTriggered = ref(false)

const { connected: socketConnected, connect, send, close } = useWebSocket()
let reconnectTimer = null

const profileInitials = computed(() => {
  const name = profile.value.displayName || profile.value.username || username.value || ''
  return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((token) => token[0]?.toUpperCase())
      .join('') || '?'
})

const doneVideos = computed(() => videos.value.filter((video) => video.status === 'done'))
const failedVideos = computed(() => videos.value.filter((video) => video.status === 'failed'))
const pendingVideos = computed(() => videos.value.filter((video) => video.status === 'pending'))
const selectedVideos = computed(() => videos.value.filter((video) => selectedVideoIds.value.includes(video.id)))
const activeVideos = computed(() => selectedVideoIds.value.length ? selectedVideos.value : videos.value)
const selectedDoneCount = computed(() => selectedVideos.value.filter((video) => video.status === 'done').length)
const selectedFailedCount = computed(() => selectedVideos.value.filter((video) => video.status === 'failed').length)
const allSelected = computed(() => videos.value.length > 0 && selectedVideoIds.value.length === videos.value.length)
const downloadingCount = computed(() => videos.value.filter((video) => video.status === 'downloading').length)
const progressPercent = computed(() => (activeVideos.value.length ? Math.round((activeVideos.value.filter((video) => video.status === 'done').length / activeVideos.value.length) * 100) : 0))
const isDownloadActive = computed(() => downloadingCount.value > 0)
const selectedSubsetCompleted = computed(() => selectedVideoIds.value.length > 0 && selectedDoneCount.value === selectedVideoIds.value.length)
const overlayVisible = computed(() => (isDownloadActive.value || (selectedSubsetCompleted.value && selectionDownloadTriggered.value)) && !(selectedSubsetCompleted.value && overlayDismissed.value))
const overlayTitle = computed(() => selectedSubsetCompleted.value ? 'Selected videos complete' : 'Downloading videos')
const overlayDescription = computed(() => selectedSubsetCompleted.value ? 'Your selected videos have finished downloading. You can close this notice when ready.' : 'Video downloads are in progress. Keep this page open while the current job finishes.')
const displayStatus = computed(() => {
  if (selectedSubsetCompleted.value) {
    return 'finished'
  }
  return status.value
})
const downloadProgressSummary = computed(() => {
  if (!activeVideos.value.length) {
    return 'Preparing downloads...'
  }
  const doneCount = activeVideos.value.filter((video) => video.status === 'done').length
  const downloadingCount = activeVideos.value.filter((video) => video.status === 'downloading').length
  const pendingCount = activeVideos.value.filter((video) => video.status === 'pending').length
  const failedCount = activeVideos.value.filter((video) => video.status === 'failed').length
  const label = selectedVideoIds.value.length ? 'selected videos' : 'videos'

  return `${doneCount} of ${activeVideos.value.length} ${label} downloaded · ${downloadingCount} downloading · ${pendingCount} pending · ${failedCount} failed`
})

function updateLastUpdated() {
  lastUpdated.value = new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', second: '2-digit'})
}
function updateJobData(job) {
  status.value = job.status || 'idle'
  videos.value = job.videos || []
  profile.value = job.profile || profile.value || {}
  videos.value.forEach((v) => {
    if (thumbLoading[v.id] === undefined) thumbLoading[v.id] = true
  })
  updateLastUpdated()
}

function applyVideoEvent(data) {
  if (!data?.videoId) {
    return
  }

  const index = videos.value.findIndex((video) => video.id === data.videoId)
  if (index === -1) {
    return
  }

  const current = videos.value[index]
  const updated = {
    ...current,
    status: data.status || current.status,
    error: data.error || current.error || null,
    filePath: data.filePath || current.filePath
  }
  videos.value.splice(index, 1, updated)
  if (data.jobStatus) {
    status.value = data.jobStatus
  }
  updateLastUpdated()
}

function handleSocketMessage(data) {
  if (!data?.type) {
    return
  }

  if (data.type === 'job-update' && data.job) {
    updateJobData(data.job)
    return
  }

  if (['videoQueued', 'videoDownloading', 'videoCompleted', 'videoFailed', 'videoCancelled'].includes(data.type)) {
    applyVideoEvent(data)
    return
  }
}

watch(selectedSubsetCompleted, (completed) => {
  if (!completed) {
    overlayDismissed.value = false
  }
})

function setupWebSocket() {
  if (typeof window === 'undefined') return
  connect(handleSocketMessage, undefined, subscribeToJob)
}

function scheduleReconnect() {
  if (reconnectTimer || !jobId.value) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    setupWebSocket()
  }, 2000)
}

function subscribeToJob() {
  if (!socketConnected.value || !jobId.value) return
  send({ type: 'subscribe', jobId: jobId.value })
}

function closeWebSocket() {
  close()
}

function selectVideo(video) {
  selectedVideoIds.value = selectedVideoIds.value.includes(video.id)
    ? selectedVideoIds.value.filter((id) => id !== video.id)
    : [...selectedVideoIds.value, video.id]

  selectionDownloadTriggered.value = false
  if (!selectedSubsetCompleted.value) {
    overlayDismissed.value = false
  }
}

function formatCount(value) {
  if (value === null || value === undefined) return '-'
  return Number(value).toLocaleString()
}

function toggleProfileRaw() {
  showProfileRaw.value = !showProfileRaw.value
}

async function fetchList() {
  if (!username.value) return
  loading.value = true
  loadingMessage.value = `Checking TikTok account @${username.value} and fetching video list...`
  errorMessage.value = ''
  overlayDismissed.value = false
  jobId.value = null
  videos.value = []
  profile.value = {}
  status.value = 'idle'
  selectedVideoIds.value = []
  closeWebSocket()

  const controller = new AbortController()
  fetchController.value = controller

  try {
    const res = await fetch('/api/fetch-list', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: username.value}),
      signal: controller.signal
    })
    const json = await res.json()
    if (!res.ok) {
      errorMessage.value = res.status === 404 ? 'TikTok account not found.' : (json.message || 'Failed to fetch videos.')
      throw new Error(json.message || 'Fetch failed')
    }

    jobId.value = json.jobId
    videos.value = json.videos || []
    profile.value = json.profile || {}
    // initialize thumbnail loading state
    videos.value.forEach((v) => {
      thumbLoading[v.id] = true
    })
    status.value = 'idle'
    selectedVideoIds.value = []
    setupWebSocket()
    subscribeToJob()
  } catch (err) {
    if (err.name === 'AbortError') {
      errorMessage.value = 'Fetch cancelled by user.'
    } else if (!errorMessage.value) {
      errorMessage.value = 'Unable to fetch TikTok data. Please try again.'
    }
    console.error(err)
  } finally {
    loading.value = false
    loadingMessage.value = ''
    fetchController.value = null
  }
}

function cancelFetch() {
  if (!fetchController.value || cancelling.value) return
  cancelling.value = true
  fetchController.value.abort()
  errorMessage.value = 'Cancelling fetch...'
  setTimeout(() => {
    cancelling.value = false
    loading.value = false
    loadingMessage.value = ''
  }, 500)
}

async function cancelActiveJob() {
  if (!jobId.value || cancelling.value) return
  cancelling.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/cancel-job', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ jobId: jobId.value })
    })
    const json = await res.json()
    if (!res.ok) {
      errorMessage.value = json.message || 'Unable to cancel downloads.'
      return
    }
    if (json.cancelled > 0) {
      loadingMessage.value = ''
      errorMessage.value = 'Download process cancelled.'
    }
  } catch (err) {
    errorMessage.value = 'Unable to cancel downloads. Please try again.'
    console.error(err)
  } finally {
    cancelling.value = false
  }
}

function toggleSelectAll() {
  selectedVideoIds.value = allSelected.value ? [] : videos.value.map((v) => v.id)
}

async function retryFailed() {
  if (!jobId.value) return
  
  let videoIds
  if (selectedVideoIds.value.length > 0) {
    videoIds = selectedVideos.value
      .filter((video) => video.status === 'failed')
      .map((video) => video.id)
  } else {
    videoIds = failedVideos.value.map((video) => video.id)
  }
  
  if (videoIds.length === 0) return
  
  await fetch('/api/retry', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jobId: jobId.value, videoIds})
  })
}

async function retryVideo(video) {
  if (!jobId.value) return
  await fetch('/api/retry', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jobId: jobId.value, videoIds: [video.id]})
  })
}

async function downloadSelectedVideos() {
  if (!jobId.value || selectedVideoIds.value.length === 0) return
  selectionDownloadTriggered.value = true
  overlayDismissed.value = false
  await fetch('/api/download/videos', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jobId: jobId.value, videoIds: selectedVideoIds.value})
  })
}

onMounted(() => {
  setupWebSocket()
})

onBeforeUnmount(() => {
  closeWebSocket()
})

function onThumbLoad(id) {
  thumbLoading[id] = false
}

function onThumbError(id) {
  // stop placeholder and rely on remote thumbnail as fallback
  thumbLoading[id] = false
}

function thumbnailUrl(video) {
  if (!jobId.value) return video.thumbnail || ''
  return `/api/thumb/${encodeURIComponent(jobId.value)}/${encodeURIComponent(video.id)}`
}

async function downloadSelectedZip() {
  if (!jobId.value || selectedVideoIds.value.length === 0) return
  const res = await fetch('/api/download/zip-selected', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jobId: jobId.value, selectedVideoIds: selectedVideoIds.value})
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || 'Zip failed')
  window.location.href = `/api/download/${encodeURIComponent(json.archiveName)}`
}

async function downloadAllZip() {
  if (!jobId.value) return
  const doneIds = doneVideos.value.map((video) => video.id)
  if (!doneIds.length) return
  const res = await fetch('/api/download/zip-selected', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({jobId: jobId.value, selectedVideoIds: doneIds})
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || 'Zip failed')
  window.location.href = `/api/download/${encodeURIComponent(json.archiveName)}`
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  padding: 32px 24px;
  background: radial-gradient(circle at top left, rgba(59, 130, 246, 0.18), transparent 24%),
  radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.12), transparent 20%),
  linear-gradient(180deg, #05080f 0%, #08111c 100%);
  color: #e2e8f0;
}

.selected {
  background: linear-gradient(135deg, #0a2c77, #072a39)!important;
}

.content-wrapper {
  max-width: 1180px;
  margin: auto;
}

.header-section {
  margin-bottom: 24px;
}

.header-title {
  font-size: clamp(2.4rem, 4vw, 3.4rem);
  margin-bottom: 0.4rem;
  letter-spacing: -0.04em;
}

.header-subtitle {
  color: #94a3b8;
  max-width: 680px;
  line-height: 1.7;
}

.input-section {
  margin-bottom: 24px;
}

.username-input {
  width: 100%;
  min-width: 240px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.94);
  color: #e2e8f0;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.4);
}

.username-input:focus {
  outline: none;
  border-color: rgba(56, 189, 248, 0.55);
  box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.12);
}

.archive-button,
.action-button,
.retry-button {
  min-width: 160px;
  border: none;
  border-radius: 16px;
  padding: 14px 18px;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}

.archive-button,
.action-button {
  background: linear-gradient(135deg, #2563eb, #38bdf8);
  color: #ffffff;
}

.cancel-button {
  background: rgba(248, 113, 113, 0.14);
  color: #fecaca;
  border: 1px solid rgba(248, 113, 113, 0.24);
  border-radius: 16px;
  padding: 14px 18px;
  cursor: pointer;
}

.retry-button {
  background: linear-gradient(135deg, #f97316, #fb923c);
  color: #ffffff;
}

.archive-button:hover,
.action-button:hover,
.retry-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.24);
}

.archive-button:disabled,
.action-button:disabled,
.retry-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.job-card {
  margin-top: 24px;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 28px;
  padding: 28px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.24);
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.job-header h2 {
  margin: 0;
  font-size: 1.4rem;
}

.job-id {
  color: #94a3b8;
  margin: 6px 0 0;
}

.actions-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
}

.actions-row .action-button,
.actions-row .retry-button {
  flex: 1 1 180px;
  min-width: 160px;
}

.progress-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  flex-direction: row;
  margin-top: 22px;
}

.progress-bar-container {
  width: 100%;
  height: 12px;
  background: rgba(148, 163, 184, 0.08);
  border-radius: 999px;
  margin-top: 10px;
  overflow: hidden;
}

.download-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.86);
  backdrop-filter: blur(8px);
  pointer-events: auto;
}

.download-dialog {
  width: min(560px, calc(100% - 32px));
  padding: 28px;
  border-radius: 28px;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.28);
  text-align: center;
}

.download-dialog h2 {
  margin: 0 0 12px;
  font-size: 1.75rem;
}

.download-dialog p {
  margin: 0 0 20px;
  color: #cbd5e1;
  line-height: 1.7;
}

.progress-bar-container.overlay {
  height: 14px;
  margin-top: 8px;
}

.overlay-subtitle {
  margin-top: 14px;
  color: #94a3b8;
  font-size: 0.95rem;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #22c55e);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.loading-message {
  margin-top: 16px;
  color: #bfdbfe;
  font-size: 0.98rem;
}

.alert {
  margin-top: 18px;
  padding: 14px 18px;
  border-radius: 18px;
  font-size: 0.97rem;
  line-height: 1.55;
}

.error-alert {
  background: rgba(248, 113, 113, 0.14);
  color: #fecaca;
  border: 1px solid rgba(248, 113, 113, 0.24);
}

.profile-summary {
  margin: 24px 0;
  padding: 24px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(8, 14, 24, 0.92));
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 28px;
}

.profile-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 24px;
  align-items: start;
}

.profile-card-avatar {
  display: grid;
  place-items: center;
}

.profile-avatar-frame {
  width: 112px;
  height: 112px;
  border-radius: 26px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(135deg, #0f172a, #1e3a8a);
}

.profile-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-avatar-fallback {
  width: 112px;
  height: 112px;
  border-radius: 26px;
  display: grid;
  place-items: center;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #f8fafc;
  background: linear-gradient(135deg, #3b82f6, #0f172a);
}

.profile-card-details {
  min-width: 260px;
}

.profile-title-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.profile-name {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.profile-username {
  color: #94a3b8;
  margin-top: 8px;
}

.profile-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.profile-status-pill,
.profile-verified-pill {
  width: fit-content;
  padding:  24px;
  border-radius: 24px;
  font-size: 0.8rem;
  font-weight: 700;
  align-content: center;
  letter-spacing: 0.02em;
}

.profile-status-pill.public {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.profile-status-pill.private {
  background: rgba(248, 113, 113, 0.16);
  color: #fecaca;
}

.profile-verified-pill {
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

.profile-description {
  color: #cbd5e1;
  line-height: 1.8;
  margin-top: 18px;
}

.profile-stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.profile-stat {
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 20px;
  padding: 14px 16px;
  display: grid;
  gap: 4px;
}

.stat-value {
  font-weight: 700;
  font-size: 1rem;
}

.stat-label {
  color: #94a3b8;
  font-size: 0.82rem;
}

.profile-hidden-row {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 12px;
  color: #94a3b8;
  font-size: 0.85rem;
  margin-top: 22px;
}

.profile-hidden-row span {
  display: flex;
  gap: 6px;
  align-items: center;
}

.profile-hidden-row a {
  color: #38bdf8;
  text-decoration: none;
}

.raw-toggle-button {
  margin-top: 18px;
  background: rgba(15, 23, 42, 0.95);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 16px;
  padding: 12px 16px;
  cursor: pointer;
}

.profile-raw-json {
  margin-top: 14px;
  padding: 16px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 16px;
  color: #cbd5e1;
  overflow-x: auto;
  font-size: 0.84rem;
  line-height: 1.6;
}

.video-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  margin-top: 24px;
}

.video-card {
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.08);
  border-radius: 22px;
  padding: 18px;
  display: grid;
  gap: 14px;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.video-card:hover {
  transform: translateY(-2px);
  border-color: rgba(56, 189, 248, 0.28);
  box-shadow: 0 20px 42px rgba(8, 15, 29, 0.18);
}

.video-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.video-thumb,
.thumb-placeholder {
  width: 60%;
  min-width: 180px;
  aspect-ratio: 9/16;
  border-radius: 16px;
}

.thumb-placeholder {
  background: linear-gradient(90deg, #0f172a 0%, #111827 100%);
}

.thumb-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.video-meta {
  display: grid;
  gap: 6px;
}

.video-id {
  font-size: 0.92rem;
  font-weight: 700;
}

.video-title {
  color: #cbd5e1;
  line-height: 1.4;
}

.video-date {
  color: #94a3b8;
  font-size: 0.9rem;
}

.video-card input[type='checkbox'] {
  accent-color: #38bdf8;
  width: 18px;
  height: 18px;
  margin-top: 12px;
}

.status-badge {
  display: inline-flex;
  padding: 10px 14px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: capitalize;
  width: fit-content;
}

.status-idle {
  background: rgba(100, 116, 139, 0.16);
  color: #cbd5e1;
}

.status-fetching {
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

.status-processing {
  background: rgba(245, 158, 11, 0.16);
  color: #facc15;
}

.status-partial {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.status-finished {
  background: rgba(16, 185, 129, 0.16);
  color: #6ee7b7;
}

.status-failed {
  background: rgba(239, 68, 68, 0.16);
  color: #fecaca;
}

.last-updated {
  margin-top: 22px;
  color: #94a3b8;
}

.empty-state {
  margin-top: 40px;
  color: #cbd5e1;
  font-size: 1.05rem;
}

@media (max-width: 720px) {
  .profile-card {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .profile-card-avatar,
  .profile-card-details {
    justify-self: center;
  }

  .profile-title-row {
    flex-direction: column;
    align-items: center;
  }

  .video-top {
    grid-template-columns: 1fr;
  }

  .actions-row {
    flex-direction: column;
  }
}
</style>
