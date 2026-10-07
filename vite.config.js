import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Production builds go straight into Laravel's public folder so the whole
// system (React frontend + Laravel backend) is one app in this folder.
const LARAVEL_PUBLIC = resolve(import.meta.dirname, 'public')

// Only remove files this build owns; index.php, .htaccess and storage/ stay.
function laravelPublicCleanup() {
  return {
    name: 'laravel-public-cleanup',
    apply: 'build',
    buildStart() {
      rmSync(resolve(LARAVEL_PUBLIC, 'assets'), { recursive: true, force: true })
    },
    closeBundle() {
      for (const file of ['_redirects', 'web.config']) {
        rmSync(resolve(LARAVEL_PUBLIC, file), { force: true })
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), laravelPublicCleanup()],
  publicDir: 'resources/static',
  // The built app is served by Laravel on the same domain, so the API is always /api.
  define: command === 'build' ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') } : {},
  server: {
    watch: {
      ignored: ['**/vendor/**', '**/storage/**', '**/public/**'],
    },
  },
  build: {
    outDir: LARAVEL_PUBLIC,
    emptyOutDir: false,
  },
}))
