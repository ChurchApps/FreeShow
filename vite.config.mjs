import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const production = process.env.NODE_ENV === 'production'
const target = process.env.BUILD_TARGET || 'frontend'

// Multi-target configuration
export default defineConfig(() => {
  const configs = {
    frontend: getFrontendConfig(),
    remote: getServerConfig('remote', { typescript: true }),
    stage: getServerConfig('stage'),
    controller: getServerConfig('controller'),
    output_stream: getServerConfig('output_stream')
  }
  
  const config = configs[target]
  if (!config) {
    throw new Error(`Unknown build target: ${target}. Available: ${Object.keys(configs).join(', ')}`)
  }
  
  return config
})

// Frontend configuration (main Electron app)
function getFrontendConfig() {
  return {
    root: '.',
    publicDir: 'public',
    plugins: [
      svelte({
        configFile: './svelte.config.mjs',
        compilerOptions: {
          dev: !production
        },
        onwarn: handleWarnings
      }),
      // Copy static files that are needed
      viteStaticCopy({
        targets: [
          {
            src: 'public/assets',
            dest: '.'
          },
          {
            src: 'public/lang',
            dest: '.'
          },
          {
            src: 'public/proto',
            dest: '.'
          }
        ]
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src/frontend'),
        svelte: resolve(__dirname, 'node_modules/svelte')
      },
      dedupe: ['svelte']
    },
    build: {
      outDir: 'public/build-vite',
      emptyOutDir: true,
      sourcemap: !production,
      minify: production ? 'terser' : false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index-vite.html')
        },
        output: {
          entryFileNames: 'bundle.js',
          chunkFileNames: '[name].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === 'style.css') return 'bundle.css'
            return assetInfo.name
          }
        }
      }
    },
    server: {
      port: 3000,
      host: 'localhost',
      fs: {
        // Allow serving files from project root
        allow: ['..']
      }
    },
    optimizeDeps: {
      exclude: ['svelte-inspector']
    }
  }
}

// Server configuration (remote, stage, controller, output_stream)
function getServerConfig(id, options = {}) {
  return {
    root: '.',
    publicDir: false, // Servers don't need public directory
    plugins: [
      svelte({
        configFile: './svelte.config.mjs',
        compilerOptions: {
          dev: !production
        },
        onwarn: handleWarnings
      }),
      // Copy server-specific files
      viteStaticCopy({
        targets: getServerCopyTargets(id)
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src/server'),
        svelte: resolve(__dirname, 'node_modules/svelte')
      },
      dedupe: ['svelte']
    },
    build: {
      outDir: `build/electron/${id}`,
      emptyOutDir: true,
      sourcemap: !production,
      minify: production ? 'terser' : false,
      rollupOptions: {
        input: resolve(__dirname, `src/server/${id}/main.ts`),
        output: {
          format: 'iife',
          name: id,
          entryFileNames: 'client.js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === 'style.css') return 'styles.css'
            return assetInfo.name
          }
        }
      }
    }
  }
}

// Get copy targets for each server
function getServerCopyTargets(id) {
  const targets = [
    { src: `src/server/${id}/index.html`, dest: '.' },
    { src: `src/server/${id}/manifest.json`, dest: '.' },
    { src: `src/server/icon.png`, dest: '.' },
    { src: `src/server/sw.js`, dest: '.' }
  ]

  // Stage server has additional files
  if (id === 'stage') {
    targets.push(
      { src: `src/server/${id}/html/navigation.js`, dest: 'html' },
      { src: `src/server/${id}/html/show.css`, dest: 'html' }
    )
  }
  
  return targets
}

// Shared warning handler
function handleWarnings(warning, handler) {
  // Suppress a11y warnings like in Rollup config
  if (warning.code.startsWith('a11y-')) return
  handler(warning)
}