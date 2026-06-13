import { chromium } from 'playwright'

export default defineEventHandler(async () => {
  const context =
    await chromium.launchPersistentContext(
      './storage/tiktok-profile',
      {
        headless: false
      }
    )

  const page = context.pages()[0]

  await page.goto(
    'https://www.tiktok.com/login'
  )

  return {
    success: true
  }
})