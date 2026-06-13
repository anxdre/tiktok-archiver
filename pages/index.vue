<template>
  <div style="max-width:720px;margin:40px auto;font-family:system-ui,Segoe UI,Roboto;">
    <h1>TikTok Archiver</h1>
    <div style="margin-top:20px">
      <input v-model="username" placeholder="Enter TikTok username" style="padding:8px;width:60%" />
      <button @click="start" :disabled="loading || !username" style="padding:8px 12px;margin-left:8px">Archive</button>
    </div>

    <div v-if="jobId" style="margin-top:20px;border:1px solid #eee;padding:12px;border-radius:6px">
      <div><strong>Job:</strong> {{ jobId }}</div>
      <div style="margin-top:8px"><strong>Status:</strong> {{ status }}</div>
      <div style="margin-top:8px"><strong>Progress:</strong> {{ completed }} / {{ total }}</div>
      <div v-if="status === 'failed'" style="color:crimson;margin-top:8px"><strong>Error:</strong> {{ error }}</div>
      <div v-if="status === 'finished'" style="margin-top:12px">
        <a :href="`/api/download/${jobId}`"><button style="padding:8px 12px">Download ZIP</button></a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const username = ref('')
const jobId = ref(null)
const status = ref(null)
const total = ref(0)
const completed = ref(0)
const error = ref(null)
const loading = ref(false)

let pollHandle = null

function startPolling(id) {
  if (pollHandle) clearInterval(pollHandle)
  pollHandle = setInterval(async () => {
    try {
      const res = await fetch(`/api/status/${id}`)
      if (!res.ok) return
      const json = await res.json()
      status.value = json.status
      total.value = json.total ?? 0
      completed.value = json.completed ?? 0
      error.value = json.error ?? null
      if (json.status === 'finished' || json.status === 'failed') {
        clearInterval(pollHandle)
        pollHandle = null
        loading.value = false
      }
    } catch (e) {
      // ignore
    }
  }, 2000)
}

async function start() {
  loading.value = true
  status.value = 'pending'
  try {
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value.replace(/^@/, '') })
    })
    const json = await res.json()
    jobId.value = json.jobId
    startPolling(jobId.value)
  } catch (e) {
    loading.value = false
  }
}
</script>
