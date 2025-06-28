import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { freeShowInspectorPlugin } from './config/vite/inspector-plugin.mjs'

const production = process.env.NODE_ENV === 'production'

// Warning handler for Svelte
function handleWarnings(warning: any) {
  // Ignore specific warnings that clutter the console
  if (warning.code === 'a11y-click-events-have-key-events') return
  if (warning.code === 'a11y-no-noninteractive-element-interactions') return
  if (warning.code === 'a11y-no-static-element-interactions') return
  if (warning.code === 'a11y-missing-attribute') return
  if (warning.code === 'css-unused-selector') return
  if (warning.code === 'unused-export-let') return
  
  // Show other warnings
  console.warn(warning.toString())
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'build/electron',
      rollupOptions: {
        input: 'src/electron/index.ts',
        output: {
          format: 'cjs',
          entryFileNames: 'index.js'
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'build/electron',
      rollupOptions: {
        input: 'src/electron/preload.ts',
        output: {
          format: 'cjs',
          entryFileNames: 'preload.js'
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  },
  renderer: {
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
      // Copy static files needed for the app
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
          },
          {
            src: 'public/global.css',
            dest: '.'
          }
        ]
      }),
      // Add custom inspector plugin in development mode
      !production && freeShowInspectorPlugin({
        activateKeyCode: 73, // I(nspect)
        openFileKeyCode: 79, // O(pen)
        editor: 'code',
        color: '#ff3c00'
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '~': resolve(__dirname, 'public')
      }
    },
    build: {
      outDir: 'public/build-vite',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index-vite.html')
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: (assetInfo: any) => {
            if (assetInfo.name?.endsWith('.css')) {
              return 'bundle.css'
            }
            return '[name].[ext]'
          }
        }
      },
      // Ensure CSS is extracted as a separate file
      cssCodeSplit: false,
      sourcemap: !production,
      minify: production ? 'esbuild' : false,
      // Target modern browsers for the Electron renderer
      target: 'chrome120'
    },
    define: {
      // Add any global defines here if needed
      __DEV__: !production
    },
    css: {
      devSourcemap: !production
    }
  }
})