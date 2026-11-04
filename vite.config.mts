import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Public files that are not part of the app on a phone (the share card, search-engine files, the
// alert sounds, which are saved the first time they play instead).
const NOT_PRECACHED = /^\/(images\/og\.png|robots\.txt|sitemap\.xml|google[\w-]*\.html|sw\.js|sounds\/)/

const filesIn = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? filesIn(path) : [path]
})

/**
 * Writes the offline file list into the built service worker (public/sw.js, `const PRECACHE = null`):
 * the page, every file under /assets (every lazy page's chunk, so pages not yet opened work offline
 * too), the icons and the manifest, the Google Fonts stylesheet the page links, and a build id that
 * names the cache. Build only: in development the worker caches nothing.
 */
const swPrecache = (): Plugin => {
  let outDir = 'dist'
  return {
    name: 'bird-alert-sw-precache',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const swPath = join(outDir, 'sw.js')
        const html = readFileSync(join(outDir, 'index.html'), 'utf8')
        const urls = filesIn(outDir)
          .map((path) => `/${relative(outDir, path).split(sep).join('/')}`)
          .filter((url) => !url.endsWith('.map') && !NOT_PRECACHED.test(url))
          .sort()
        const fonts = [...html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'))
        const build = createHash('sha256').update(urls.join('\n')).update(html).digest('hex').slice(0, 12)
        const sw = readFileSync(swPath, 'utf8')
        const placeholder = 'const PRECACHE = null'
        if (!sw.includes(placeholder)) throw new Error(`swPrecache: "${placeholder}" not found in ${swPath}`)
        writeFileSync(swPath, sw.replace(placeholder, `const PRECACHE = ${JSON.stringify({ build, urls, fonts })}`))
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), swPrecache()],
  server: {
    port: 3000,
    // Listen on IPv4 and IPv6 so both `localhost` resolutions (and CI) reach the dev server.
    host: true,
    // Same-origin /api in development, so the session cookie is first-party (see vercel.json for production).
    proxy: { '/api': 'http://localhost:3001' }
  },
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}']
  }
})
