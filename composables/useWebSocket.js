import { ref } from 'vue'

const socket = ref(null)
const connected = ref(false)
let reconnectTimer = null

function getSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const port = import.meta.env.VITE_WS_PORT || 3001
  return `${protocol}://${window.location.hostname}:${port}`
}

function scheduleReconnect(onMessage, url) {
  if (reconnectTimer) {
    return
  }
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connect(onMessage, url)
  }, 2000)
}

function connect(onMessage, url = getSocketUrl(), onOpen) {
  if (socket.value) {
    return
  }
  if (typeof window === 'undefined') {
    return
  }

  socket.value = new WebSocket(url)

  socket.value.addEventListener('open', () => {
    connected.value = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    onOpen?.()
  })

  socket.value.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage?.(data)
    } catch (err) {
      console.error('[ws] parse error', err)
    }
  })

  socket.value.addEventListener('close', () => {
    connected.value = false
    socket.value = null
    scheduleReconnect(onMessage, url)
  })

  socket.value.addEventListener('error', () => {
    connected.value = false
    scheduleReconnect(onMessage, url)
  })
}

function send(payload) {
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
    return
  }
  socket.value.send(JSON.stringify(payload))
}

function close() {
  if (!socket.value) {
    return
  }
  socket.value.close()
  socket.value = null
  connected.value = false
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

export function useWebSocket() {
  return {
    connected,
    connect,
    send,
    close
  }
}
