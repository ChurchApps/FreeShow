import { defineConfig } from "vite"
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte"

const production = process.env.NODE_ENV === "production"

export default defineConfig({
    plugins: [
        svelte({
            preprocess: vitePreprocess(),
            compilerOptions: {
                dev: !production
            },
            onwarn: (warning, handler) => {
                // disable A11y warnings (Svelte 5 renamed the codes to a11y_*)
                if (warning.code.startsWith("a11y_")) return
                handler(warning)
            }
        })
    ],
    root: production ? "." : "public",
    publicDir: false,
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
                          // Vite 8 / Rollup 4: asset name comes from names[]
                          const name = assetInfo.names?.[0] ?? ""
                          if (name.endsWith(".css")) {
                              return "bundle.css"
                          }
                          return name
                      }
                  }
              }
          }
        : {
              outDir: "../dist",
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
        dedupe: ["svelte"],
        ...(!production && { alias: { "/src": "../src" } })
    }
})
