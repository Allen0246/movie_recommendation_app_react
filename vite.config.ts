/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Docker Desktop bind mounts on Windows don't reliably forward inotify
    // events into the container, so chokidar's default watcher never fires
    // and HMR silently stops working. Polling costs a little CPU but works
    // everywhere (host or container), so it's not worth gating.
    watch: {
      usePolling: true,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
