import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"
import typescript from "@rollup/plugin-typescript"
import copy from "rollup-plugin-copy"
import css from "rollup-plugin-css-only"
import livereload from "rollup-plugin-livereload"
import serve from "rollup-plugin-serve"
import svelte from "rollup-plugin-svelte"
import startSvelteInspector from "svelte-inspector"
import sveltePreprocess from "svelte-preprocess"

const production = !process.env.ROLLUP_WATCH

// SVELTE INSPECTOR CONFIG
// https://github.com/qutran/svelte-inspector
const inspectorConfig = {
    activateKeyCode: 73, // I(nspect)
    openFileKeyCode: 79, // O(pen)
    editor: "code", // Allowed values: 'sublime', 'atom', 'code', 'webstorm', 'phpstorm', 'idea14ce', 'vim', 'emacs', 'visualstudio'
    color: "#ff3c00",
}

export default [
    mainApp(),
    webServer("remote", { typescript: true }),
    webServer("stage"),
    webServer("controller"),
    webServer("output_stream"),
    // webServer("cam"),
]

function mainApp() {
    return {
        input: "src/frontend/main.ts",
        output: {
            sourcemap: !production,
            format: "iife",
            name: "freeshow",
            file: "public/build/bundle.js",
        },
        plugins: [
            svelte({
                preprocess: sveltePreprocess({
                    typescript: {
                        tsconfigFile: `./tsconfig.svelte${production ? ".prod" : ""}.json`,
                    },
                }),
                compilerOptions: {
                    // enable run-time checks when not in production
                    dev: !production,
                },
                onwarn: handleWarnings,
            }),
            startSvelteInspector(inspectorConfig),
            // extract any component CSS out into a separate file - better for performance
            css({
                output: "bundle.css",
                mangle: production,
                compress: production,
            }),

            // If you have external dependencies installed from
            // npm, you'll most likely need these plugins. In
            // some cases you'll need additional configuration -
            // consult the documentation for details:
            // https://github.com/rollup/plugins/tree/master/packages/commonjs
            resolve({
                browser: true,
                dedupe: ["svelte"],
            }),
            commonjs(),
            typescript({
                tsconfig: `./tsconfig.svelte${production ? ".prod" : ""}.json`,
                sourceMap: !production,
                inlineSources: !production,
            }),

            // In dev mode, call `npm run start` once
            // the bundle has been generated
            !production &&
                serve({
                    host: "localhost",
                    port: 3000,
                    contentBase: "public",
                    // verbose: true,
                }),

            !production &&
                livereload({
                    watch: "public",
                    // verbose: true,
                }),

            production &&
                terser({
                    compress: true,
                    mangle: true,
                }),
        ],
        watch: {
            clearScreen: false,
        },
    }
}

function webServer(id, options = {}) {
    return {
        input: `src/server/${id}/main.ts`,
        output: {
            sourcemap: !production,
            format: "iife",
            name: id,
            file: `build/electron/${id}/client.js`,
        },
        // external: ["svelte/internal"], // <-- suppresses the warning
        plugins: [
            svelte({
                preprocess: sveltePreprocess(
                    options.typescript && {
                        typescript: {
                            tsconfigFile: `./tsconfig.server${production ? ".prod" : ""}.json`,
                        },
                    }
                ),
                compilerOptions: {
                    dev: !production,
                },
                onwarn: handleWarnings,
            }),
            css({
                output: "styles.css",
                mangle: production,
                compress: production,
            }),

            resolve({
                browser: true,
                dedupe: ["svelte"],
            }),
            commonjs(),
            // options.typescript &&
            typescript({
                tsconfig: `./tsconfig.server${production ? ".prod" : ""}.json`,
                sourceMap: !production,
                inlineSources: !production,
            }),

            copy({
                targets: webFiles(id),
            }),
        ],
    }
}

function webFiles(id) {
    const dest = `build/electron/${id}`
    return [
        { src: `src/server/${id}/index.html`, dest },
        { src: `src/server/${id}/manifest.json`, dest },
        { src: `src/server/icon.png`, dest },
        { src: `src/server/sw.js`, dest },
    ]
}

// HELPERS

function handleWarnings(warning, handler) {
    // disable A11y warnings
    if (warning.code.startsWith("a11y-")) return
    handler(warning)
}
