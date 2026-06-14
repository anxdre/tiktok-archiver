import { startDownloadWorker } from '../utils/downloadQueue.js'

export default defineNitroPlugin(() => {
  startDownloadWorker()
})
