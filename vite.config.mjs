import { defineConfig } from "vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import sveltePreprocess from "svelte-preprocess"

const production = process.env.NODE_ENV === "production"

export default defineConfig({
    plugins: [
        svelte({
            preprocess: sveltePreprocess({
                typescript: {
                    tsconfigFile: "config/typescript/tsconfig.svelte.json"
                }
            }),
            compilerOptions: {
                dev: !production
            },
            onwarn: (warning, handler) => {
                // disable A11y warnings
                if (warning.code.startsWith("a11y-")) return
                handler(warning)
            }
        })
    ],
    root: ".",
    publicDir: "public",
    build: production
        ? {
              lib: {
                  entry: "src/frontend/main.ts",
                  name: "freeshow",
                  formats: ["iife"],
                  fileName: () => "bundle.js"
              },
              outDir: "public/build",
              emptyOutDir: false,
              rollupOptions: {
                  output: {
                      assetFileNames: (assetInfo) => {
                          if (assetInfo.name.endsWith(".css")) {
                              return "bundle.css"
                          }
                          return assetInfo.name
                      }
                  }
              }
          }
        : {
              outDir: "dist",
              rollupOptions: {
                  input: "index.html"
              }
          },
    server: {
        port: 3000,
        host: "127.0.0.1",
        strictPort: true,
        middlewareMode: false
    },
    resolve: {
        dedupe: ["svelte"]
    }
})
