# TikTok Archiver

A lightweight Nuxt 4 app for archiving public TikTok profiles by fetching video metadata, downloading selected videos, and creating ZIP archives.

## What it does

- Fetches a public TikTok user's video list and profile metadata
- Allows selecting specific videos to download
- Downloads selected videos in the background with WebSocket progress updates
- Persists job state in `jobs/{jobId}.json`
- Generates ZIP archives for selected videos
- Supports retrying failed videos and cancelling active download jobs

## Project structure

```
root/
├── app/
│   └── app.vue
├── app/pages/
│   └── index.vue
├── server/
│   ├── api/
│   │   ├── cancel-job.post.js
│   │   ├── download/
│   │   │   ├── videos.post.js
│   │   │   └── zip-selected.post.js
│   │   ├── fetch-list.post.js
│   │   ├── retry.post.js
│   │   ├── status/
│   │   ├── thumb/
│   │   └── thumbnail/
│   └── utils/
│       ├── cleanup.js
│       ├── downloadQueue.js
│       ├── jobStore.js
│       ├── tiktokProfileFetcher.js
│       ├── websocketServer.js
│       └── wsEvents.js
├── server/plugins/
│   ├── cleanup.js
│   ├── download-queue.js
│   └── ws-server.js
├── jobs/
├── downloads/
├── archives/
├── public/
├── package.json
└── README.md
```

## Quickstart

### 1. Install dependencies

```bash
npm install
# or
pnpm install
```

### 2. Install `yt-dlp`

This project uses `yt-dlp` to download TikTok videos.

```bash
pip install -U yt-dlp
```

Or download the binary from:

https://github.com/yt-dlp/yt-dlp

### 3. Run the app

```bash
npm run dev
# or
pnpm dev
```

Open `http://localhost:3000`, enter a TikTok username, select videos, and use the download controls.

## Current behavior

- `Fetch Videos`: loads TikTok profile and video metadata
- `Download Selected`: queues only selected `pending` or `failed` videos for download
- `Retry Failed`: retries failed videos in the current selection, or all failed videos if nothing is selected
- `Download Selected ZIP`: creates a ZIP archive from downloaded videos in the current selection
- `Download All ZIP`: creates a ZIP from all downloaded videos in the job
- `Cancel downloads`: cancels active downloads for the current job
- Overlay popup shows progress only while downloads are active or after a selection-triggered download completes

## Available API endpoints

- `POST /api/fetch-list`
  - Request body: `{ "username": "cristiano" }`
  - Creates a new job and returns `jobId`, `videos`, and `profile`

- `POST /api/download/videos`
  - Request body: `{ "jobId": "...", "videoIds": ["id1", "id2"] }`
  - Queues selected videos for download

- `POST /api/retry`
  - Request body: `{ "jobId": "...", "videoIds": ["id1"] }`
  - Retries failed videos; if no `videoIds` provided, retries all failed videos

- `POST /api/cancel-job`
  - Request body: `{ "jobId": "..." }`
  - Cancels pending / active downloads for the job

- `POST /api/download/zip-selected`
  - Request body: `{ "jobId": "...", "selectedVideoIds": ["id1", "id2"] }`
  - Creates a ZIP archive with downloaded selected videos

- `POST /api/cleanup-old-storage`
  - Request body: none
  - Triggers manual cleanup of stale job files, downloads, and archives
  - Note: automatic cleanup runs daily when the Nuxt server starts

- WebSocket support is available via the frontend `useWebSocket` composable to receive progress events.

## WebSocket setup

- The WebSocket server starts automatically when the Nuxt app launches via `server/plugins/ws-server.js`.
- Default WebSocket port: `3001`.
- Override with `WS_PORT` if needed:

```bash
WS_PORT=4001 npm run dev
# or
WS_PORT=4001 pnpm dev
```

- The frontend uses `useWebSocket` to connect to `ws://<hostname>:<port>`.

## Cleanup worker

- The cleanup scheduler starts automatically via `server/plugins/cleanup.js` when Nitro boots.
- It runs once at startup and then every 24 hours.
- By default it removes job state, downloads, and archives older than 7 days.
- Override the TTL with `CLEANUP_TTL_DAYS`:

```bash
CLEANUP_TTL_DAYS=14 npm run dev
```

- You can also trigger cleanup manually with `POST /api/cleanup-old-storage`.

## Notes

- This project persists state in JSON files under `jobs/` and does not use a database.
- Downloaded video files are stored in `downloads/{jobId}/`
- Generated ZIP files are stored in `archives/`
- The backend uses BullMQ with Redis for download queue management
- A valid Redis instance should be available at `redis://127.0.0.1:6379` by default

## Cleaned up unused code

- Removed stale selection-only computed helpers that were not used by the current UI
- Removed obsolete `downloadPendingVideos` helper from the frontend

## Contributing

Contributions are welcome! If you want to help improve this project:

1. Fork the repository
2. Create a feature branch
3. Open a Pull Request with a clear description of what changed

Suggested improvements:

- Add tests for API handlers and frontend selection/download behavior
- Improve the download progress overlay and error messaging
- Add authentication or per-user job isolation
- Add support for downloading thumbnails or video metadata export
- Add better Redis / BullMQ job recovery logic

Please ensure code is formatted consistently and keep changes small for easy review.

## Development notes

- The frontend entry is `app/pages/index.vue`
- The download queue is implemented in `server/utils/downloadQueue.js`
- Job persistence is implemented in `server/utils/jobStore.js`
- WebSocket events are emitted from `server/utils/wsEvents.js`

## Build / preview

```bash
npm run dev
# or
pnpm dev
```

For production preview:

```bash
npm run build
npm run preview
```
