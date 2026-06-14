import { startCleanupScheduler } from '../utils/cleanup.js'

export default defineNitroPlugin(() => {
  startCleanupScheduler()
})
