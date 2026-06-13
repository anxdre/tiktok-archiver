# TikTok Archiver (MVP)

Simple Nuxt 4 app to archive public TikTok profiles by downloading videos and producing a ZIP.

Features
- Enter a TikTok username and start an archive job
- Background download using `yt-dlp` (no database)
- Job progress persisted to `jobs/{jobId}.json`
- Archive available as `archives/{jobId}.zip`

Project structure

```
root/
├── app/
│   └── app.vue
├── pages/
│   └── index.vue
├── server/
│   ├── api/
│   │   ├── archive.post.js
│   │   ├── status/[jobId].get.js
│   │   └── download/[jobId].get.js
│   └── utils/
│       └── downloadProfile.js
├── jobs/
├── downloads/
├── archives/
├── package.json
└── README.md
```

Quickstart

1. Install dependencies

```bash
npm install
# or
pnpm install
```

2. Install `yt-dlp` on your system (required):

```bash
# using pip
pip install -U yt-dlp

# or download the binary from https://github.com/yt-dlp/yt-dlp
```

3. Run the app

```bash
npm run dev
# or
pnpm dev
```

Open the app in your browser (typically http://localhost:3000). Enter a TikTok username and click "Archive". The UI polls status every 2s and shows a Download button when finished.

Server API

- Start an archive job: POST `/api/archive`
  - Body: `{ "username": "someuser" }`
  - Returns: `{ "jobId": "..." }`
  - Implementation: [server/api/archive.post.js](server/api/archive.post.js)

- Get job status: GET `/api/status/{jobId}`
  - Returns contents of `jobs/{jobId}.json`
  - Implementation: [server/api/status/[jobId].get.js](server/api/status/[jobId].get.js)

- Download archive: GET `/api/download/{jobId}`
  - Streams `archives/{jobId}.zip` with Content-Disposition attachment
  - Implementation: [server/api/download/[jobId].get.js](server/api/download/[jobId].get.js)

Key files

- Frontend page: [pages/index.vue](pages/index.vue)
- Download & zip worker: [server/utils/downloadProfile.js](server/utils/downloadProfile.js)
- Job files stored under: [jobs](jobs)
- Downloaded videos stored under: [downloads](downloads)
- Produced ZIP archives: [archives](archives)

Notes & behavior

- The server runs downloads in a background async function started by the POST `/api/archive` handler. Job metadata is stored in `jobs/{jobId}.json` and includes:

```json
{
  "status": "processing", // pending, processing, zipping, finished, failed
  "username": "someuser",
  "total": 0,
  "completed": 0,
  "archive": null
}
```

- Downloading is performed by calling the `yt-dlp` binary using `execa`. You must have `yt-dlp` installed and available in PATH.
- After successful downloads, the code zips the `downloads/{jobId}` folder into `archives/{jobId}.zip` using the `archiver` package.
- If `yt-dlp` or zipping fails, job status becomes `failed` and the error message is written to the job JSON.

Security & limitations

- No authentication — this is an MVP.
- No rate-limiting; use carefully.
- Downloads run on the server directly; be mindful of disk usage and quotas.

Troubleshooting

- If you see an import error for `execa`, ensure you have the correct package version. The code uses named import `import { execa } from 'execa'`.
- If downloads fail, confirm `yt-dlp` works from the shell: `yt-dlp https://www.tiktok.com/@username`.

Extending this project

- Add persistent job queue or use Redis for distributed workers
- Add authentication and user quotas
- Stream live progress via WebSockets instead of polling

If you want, I can run `npm install` and start the dev server here to test the flow — tell me which package manager to use. 
# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
