# =========================
# Build Stage
# =========================
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build Nuxt
RUN pnpm run build

# Remove dev dependencies
RUN pnpm prune --prod


# =========================
# Production Stage
# =========================
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-dejavu \
    yt-dlp \
    ffmpeg \
    wget

# Install pnpm
RUN npm install -g pnpm

# Playwright configuration
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=0
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy Nuxt output
COPY --from=builder /app/.output ./.output

# Create storage directories
RUN mkdir -p \
    /app/downloads \
    /app/archives \
    /app/jobs \
    /app/storage

# Volume mount points
VOLUME ["/app/downloads"]
VOLUME ["/app/archives"]
VOLUME ["/app/jobs"]
VOLUME ["/app/storage"]

# Expose Nuxt port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s \
            --timeout=5s \
            --start-period=30s \
            --retries=3 \
    CMD wget -q --spider http://127.0.0.1:3000 || exit 1

# Start Nuxt
CMD ["node", ".output/server/index.mjs"]