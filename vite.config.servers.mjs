import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import sveltePreprocess from 'svelte-preprocess'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

const production = process.env.NODE_ENV === 'production'

// Get server to build from command line or environment
const serverId = process.env.VITE_SERVER_ID || process.argv.find(arg => arg.startsWith('--server='))?.split('=')[1]

// Define server configurations
const servers = {
  remote: { typescript: true },
  stage: { typescript: true },
  controller: { typescript: true },
  output_stream: { typescript: true },
}

if (!serverId || !servers[serverId]) {
  console.error('Please specify a server to build using VITE_SERVER_ID environment variable')
  console.error('Available servers:', Object.keys(servers).join(', '))
  process.exit(1)
}

const serverConfig = servers[serverId]

// Copy static files for the server
function copyServerFiles(id) {
  const dest = `build/electron/${id}`
  
  // Ensure directory exists
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true })
  }
  
  const files = [
    { src: `src/server/${id}/index.html`, dest: `${dest}/index.html` },
    { src: `src/server/${id}/manifest.json`, dest: `${dest}/manifest.json` },
    { src: `src/server/icon.png`, dest: `${dest}/icon.png` },
    { src: `src/server/sw.js`, dest: `${dest}/sw.js` },
  ]
  
  if (id === 'stage') {
    files.push(
      { src: `src/server/${id}/html/navigation.js`, dest: `${dest}/html/navigation.js` },
      { src: `src/server/${id}/html/show.css`, dest: `${dest}/html/show.css` }
    )
    
    // Ensure html directory exists
    if (!existsSync(`${dest}/html`)) {
      mkdirSync(`${dest}/html`, { recursive: true })
    }
  }
  
  files.forEach(({ src, dest }) => {
    try {
      copyFileSync(src, dest)
    } catch (err) {
      console.warn(`Failed to copy ${src} to ${dest}:`, err.message)
    }
  })
}

// Plugin to copy server files after build
function copyServerFilesPlugin(serverId) {
  return {
    name: 'copy-server-files',
    writeBundle() {
      copyServerFiles(serverId)
    }
  }
}

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess({
        typescript: serverConfig.typescript ? {
          tsconfigFile: `./config/typescript/tsconfig.server${production ? '.prod' : ''}.json`,
        } : false,
      }),
      compilerOptions: {
        dev: !production,
      },
      onwarn: (warning, handler) => {
        // disable A11y warnings
        if (warning.code.startsWith('a11y-')) return
        handler(warning)
      },
    }),
    copyServerFilesPlugin(serverId),
  ],
  root: `src/server/${serverId}`,
  publicDir: false,
  build: {
    outDir: resolve(process.cwd(), `build/electron/${serverId}`),
    emptyOutDir: true,
    lib: {
      entry: 'main.ts',
      name: serverId,
      formats: ['iife'],
      fileName: () => 'client.js'
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'styles.css'
          }
          return assetInfo.name
        },
      },
    },
    minify: production ? 'terser' : false,
    sourcemap: !production,
  },
  resolve: {
    dedupe: ['svelte'],
    alias: {
      '@': resolve(process.cwd(), 'src'),
    }
  },
  server: {
    port: 3001 + Object.keys(servers).indexOf(serverId),
    strictPort: false,
  },
})