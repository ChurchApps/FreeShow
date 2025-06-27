import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const production = process.env.NODE_ENV === 'production'

// https://vitejs.dev/config/
export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [
    svelte({
      configFile: './svelte.config.js',
      compilerOptions: {
        dev: !production
      },
      onwarn: (warning, handler) => {
        // Suppress a11y warnings like in Rollup config
        if (warning.code.startsWith('a11y-')) return
        handler(warning)
      }
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
})