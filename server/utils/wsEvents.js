import { broadcastJobUpdate as broadcastWSJobUpdate, emitProgress as emitWSProgress } from '../ws/server.js'

export function emitProgress(type, payload) {
  emitWSProgress(type, payload)
}

export function broadcastJobUpdate(jobId, job) {
  broadcastWSJobUpdate(jobId, job)
}
