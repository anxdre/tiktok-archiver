import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const POLL_INTERVAL_MS = 2000
const TERMINAL_STATUSES = new Set(['finished', 'failed', 'partial', 'cancelled'])

export function useJobPolling(jobId, onUpdate) {
  const polling = ref(false)
  const error = ref(null)
  let intervalId = null
  let activeFetchId = null

  const stopPolling = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    polling.value = false
  }

  const shouldStopForStatus = (status) => TERMINAL_STATUSES.has(status)

  const fetchStatus = async (id) => {
    if (!id) return
    if (activeFetchId === id) return

    const requestId = id
    activeFetchId = requestId

    try {
      const job = await $fetch(`/api/status/${encodeURIComponent(id)}`)
      if (jobId?.value !== requestId) {
        return job
      }

      error.value = null
      onUpdate?.(job)
      if (shouldStopForStatus(job.status)) {
        stopPolling()
      }
      return job
    } catch (fetchError) {
      if (jobId?.value === requestId) {
        error.value = fetchError
        if (fetchError?.statusCode === 404) {
          stopPolling()
        }
      }
      console.error('[useJobPolling] fetch error', fetchError)
    } finally {
      if (activeFetchId === requestId) {
        activeFetchId = null
      }
    }
  }

  const startPolling = async () => {
    if (typeof window === 'undefined' || !jobId?.value || intervalId) return

    const currentJobId = jobId.value
    polling.value = true

    const job = await fetchStatus(currentJobId)
    if (!job || shouldStopForStatus(job.status)) {
      return
    }

    intervalId = window.setInterval(async () => {
      const id = jobId.value
      if (!id) {
        stopPolling()
        return
      }
      if (id !== currentJobId) {
        stopPolling()
        await startPolling()
        return
      }
      await fetchStatus(id)
    }, POLL_INTERVAL_MS)
  }

  watch(
    jobId,
    async (newJobId, oldJobId) => {
      if (newJobId === oldJobId) return
      stopPolling()
      if (newJobId) {
        await startPolling()
      }
    },
    { immediate: true }
  )

  onMounted(() => {
    if (jobId?.value) {
      startPolling()
    }
  })

  onBeforeUnmount(() => {
    stopPolling()
  })

  return { polling, error, stopPolling, startPolling }
}
