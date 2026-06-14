import { WebSocketServer, WebSocket } from 'ws'

const WS_PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 3001
let wss = null
let heartbeatInterval = null
const subscriptions = new Map()

function safeJsonParse(value) {
  if (typeof value !== 'string' && !(value instanceof Buffer)) {
    return null
  }
  try {
    return JSON.parse(value.toString())
  } catch (error) {
    return null
  }
}

function sendMessage(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return
  }
  try {
    ws.send(JSON.stringify(payload))
  } catch (error) {
    console.error('[ws] send error:', error)
  }
}

function sendToJob(jobId, payload) {
  const key = String(jobId)
  const clients = subscriptions.get(key)
  if (!clients || clients.size === 0) {
    return
  }
  for (const client of Array.from(clients)) {
    sendMessage(client, payload)
  }
}

function removeClient(ws) {
  if (!ws || !ws.jobId) {
    return
  }
  const key = String(ws.jobId)
  const clients = subscriptions.get(key)
  if (!clients) {
    return
  }
  clients.delete(ws)
  if (clients.size === 0) {
    subscriptions.delete(key)
  }
}

export function startWebSocketServer() {
  if (wss) {
    return wss
  }

  wss = new WebSocketServer({ port: WS_PORT })

  wss.on('connection', (ws) => {
    ws.isAlive = true
    ws.jobId = null

    ws.on('pong', () => {
      ws.isAlive = true
    })

    ws.on('message', (message) => {
      const data = safeJsonParse(message)
      if (!data || data.type !== 'subscribe' || !data.jobId) {
        return
      }

      const jobId = String(data.jobId)
      if (!subscriptions.has(jobId)) {
        subscriptions.set(jobId, new Set())
      }
      subscriptions.get(jobId).add(ws)
      ws.jobId = jobId
      sendMessage(ws, { type: 'subscribed', jobId })
    })

    ws.on('close', () => {
      removeClient(ws)
    })

    ws.on('error', () => {
      removeClient(ws)
    })
  })

  heartbeatInterval = setInterval(() => {
    if (!wss) {
      return
    }
    wss.clients.forEach((client) => {
      if (!client.isAlive) {
        client.terminate()
        return
      }
      client.isAlive = false
      client.ping()
    })
  }, 30000)

  wss.on('listening', () => {
    console.info(`[ws] listening on port ${WS_PORT}`)
  })

  wss.on('error', (error) => {
    console.error('[ws] server error:', error)
  })

  return wss
}

export function emitProgress(type, payload) {
  if (!payload || !payload.jobId) {
    return
  }

  const message = {
    type,
    jobId: String(payload.jobId),
    videoId: payload.videoId,
    status: payload.status,
    progress: payload.progress,
    error: payload.error || null,
    filePath: payload.filePath || null,
    jobStatus: payload.jobStatus || null
  }

  sendToJob(payload.jobId, message)
}

export function broadcastJobUpdate(jobId, job) {
  if (!jobId || !job) {
    return
  }
  sendToJob(jobId, { type: 'job-update', job })
}
