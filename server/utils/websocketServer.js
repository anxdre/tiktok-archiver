import { WebSocketServer } from 'ws'

let wss = null
const connections = new Map() // jobId -> Set of websockets
let heartbeatInterval = null

export function initWebSocketServer(server) {
  if (wss) return wss

  console.info('[ws] initializing websocket server')
  wss = new WebSocketServer({ noServer: true })

  const attachUpgrade = (req, socket, head) => {
    const pathname = req.url || '/'
    if (pathname === '/api/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  }

  if (typeof server.on === 'function') {
    server.on('upgrade', attachUpgrade)
  } else if (typeof server.addListener === 'function') {
    server.addListener('upgrade', attachUpgrade)
  } else {
    console.warn('[ws] unable to attach upgrade handler to server')
  }

  wss.on('connection', (ws) => {
    ws.isAlive = true
    ws.on('pong', () => {
      ws.isAlive = true
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'subscribe' && msg.jobId) {
          const jobId = String(msg.jobId)
          if (!connections.has(jobId)) {
            connections.set(jobId, new Set())
          }
          connections.get(jobId).add(ws)
          ws.jobId = jobId
          ws.send(JSON.stringify({ type: 'subscribed', jobId }))
        }
      } catch (err) {
        console.error('[ws] parse error:', err)
      }
    })

    ws.on('close', () => {
      if (ws.jobId && connections.has(ws.jobId)) {
        connections.get(ws.jobId).delete(ws)
        if (connections.get(ws.jobId).size === 0) {
          connections.delete(ws.jobId)
        }
      }
    })

    ws.on('error', (err) => {
      console.error('[ws] error:', err)
    })
  })

  heartbeatInterval = setInterval(() => {
    if (!wss) return
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate()
        return
      }
      ws.isAlive = false
      ws.ping()
    })
  }, 30000)

  return wss
}

export function broadcastJobUpdate(jobId, job) {
  const clients = connections.get(jobId)
  if (!clients || clients.size === 0) return
  const message = JSON.stringify({ type: 'job-update', job })
  clients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(message)
    }
  })
}

export function getWebSocketServer() {
  return wss
}

export function shutdownWebSocketServer() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
  if (wss) {
    wss.close()
    wss = null
  }
}
