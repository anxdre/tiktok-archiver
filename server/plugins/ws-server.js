import { startWebSocketServer } from '../ws/server.js'
import { startDownloadWorker } from '../utils/downloadQueue.js'

export default defineNitroPlugin(() => {
  startDownloadWorker()
  startWebSocketServer()
})
