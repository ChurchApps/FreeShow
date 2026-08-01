import { svelte } from "@sveltejs/vite-plugin-svelte"
import path from "path"
import { defineConfig } from "vite"
import sveltePreprocess from "svelte-preprocess"

// Web (browser) build of the main frontend. Reuses src/frontend unchanged; the
// transport layer (installTransport) selects the Socket.IO backend because
// VITE_TARGET === "web". Output: build/web (served by the headless server).

export default defineConfig({
    plugins: [
        svelte({
            preprocess: sveltePreprocess({
                typescript: {
                    tsconfigFile: "config/typescript/tsconfig.svelte.json"
                }
            }),
            compilerOptions: { dev: false },
            onwarn: (warning, handler) => {
                if (warning.code.startsWith("a11y-")) return
                handler(warning)
            }
        })
    ],
    root: "public",
    publicDir: false,
    define: {
        "import.meta.env.VITE_TARGET": JSON.stringify("web")
    },
    build: {
        outDir: "../build/web",
        emptyOutDir: true,
        rollupOptions: {
            input: "public/index.html"
        }
    },
    resolve: {
        dedupe: ["svelte"],
        // index.html references /src/frontend/main.ts (absolute); map /src -> repo src
        alias: { "/src": path.resolve(process.cwd(), "src") }
    }
})
