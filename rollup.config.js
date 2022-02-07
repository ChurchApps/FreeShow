import svelte from "rollup-plugin-svelte"
import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve"
import livereload from "rollup-plugin-livereload"
import { terser } from "rollup-plugin-terser"
import sveltePreprocess from "svelte-preprocess"
import typescript from "@rollup/plugin-typescript"
import css from "rollup-plugin-css-only"
import serve from "rollup-plugin-serve"
import copy from "rollup-plugin-copy"

const production = !process.env.ROLLUP_WATCH

// function serve() {
//   let server

//   function toExit() {
//     if (server) server.kill(0)
//   }

//   return {
//     writeBundle() {
//       if (server) return
//       server = require("child_process").spawn("npm", ["run", "start:frontend"], {
//         // , "--", "--dev"
//         stdio: ["ignore", "inherit", "inherit"],
//         shell: true,
//       })

//       process.on("SIGTERM", toExit)
//       process.on("exit", toExit)
//     },
//   }
// }

export default [
  {
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
            // tsconfigFile: production ? "./tsconfig.svelte.prod.json" : "./tsconfig.svelte.json",
            tsconfigFile: "./tsconfig.svelte.json",
          },
        }),
        compilerOptions: {
          // enable run-time checks when not in production
          dev: !production,
        },
      }),
      // we'll extract any component CSS out into
      // a separate file - better for performance
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
        // tsconfig: production ? "./tsconfig.svelte.prod.json" : "./tsconfig.svelte.json",
        tsconfig: "./tsconfig.svelte.json",
        sourceMap: !production,
        inlineSources: !production,
      }),

      // In dev mode, call `npm run start` once
      // the bundle has been generated
      !production && // serve(),
        serve({
          host: "localhost",
          port: 3000,
          contentBase: "public",
          // verbose: true,
        }),

      // Watch the `public` directory and refresh the
      // browser on changes when not in production
      !production &&
        livereload({
          watch: "public",
          // verbose: true,
        }),

      // If we're building for production (npm run build
      // instead of npm run dev), minify
      production &&
        terser({
          compress: true,
          mangle: true,
        }),
    ],
    watch: {
      clearScreen: false,
    },
  },
  // remote
  {
    input: "src/server/remote/main.ts",
    output: {
      sourcemap: !production,
      format: "iife",
      name: "remote",
      file: "build/electron/remote/client.js",
    },
    // external: ["svelte/internal"], // <-- suppresses the warning
    plugins: [
      svelte({
        preprocess: sveltePreprocess({
          typescript: {
            // tsconfigFile: production ? "./tsconfig.server.prod.json" : "./tsconfig.server.json",
            tsconfigFile: "./tsconfig.server.json",
          },
        }),
        compilerOptions: {
          // enable run-time checks when not in production
          dev: !production,
        },
      }),
      // we'll extract any component CSS out into
      // a separate file - better for performance
      css({
        output: "styles.css",
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
        // tsconfig: production ? "./tsconfig.server.prod.json" : "./tsconfig.server.json",
        tsconfig: "./tsconfig.server.json",
        sourceMap: !production,
        inlineSources: !production,
      }),

      // In dev mode, call `npm run start` once
      // the bundle has been generated
      // !production && // serve(),
      //   serve({
      //     host: "localhost",
      //     port: 3000,
      //     contentBase: "public",
      //     // verbose: true,
      //   }),
      // serve({
      //   contentBase: "public",
      //   // verbose: true,
      // }),

      // // Watch the `public` directory and refresh the
      // // browser on changes when not in production
      // !production &&
      //   livereload({
      //     watch: "public",
      //     // verbose: true,
      //   }),

      // If we're building for production (npm run build
      // instead of npm run dev), minify
      // terser({
      //   compress: true,
      //   mangle: true,
      // }),

      // html({
      //   title: "RemoteShow",
      //   fileName: "index.html",
      //   minify: production,
      //   meta: [{ charset: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1.0" }],
      //   attributes: { link: { "": '"/><link rel="manifest" href="manifest.json" />' } },
      // }),
      copy({
        targets: [
          { src: "src/server/remote/index.html", dest: "build/electron/remote" },
          { src: "src/server/remote/manifest.json", dest: "build/electron/remote" },
          { src: "src/server/icon.png", dest: "build/electron/remote" },
          { src: "src/server/sw.js", dest: "build/electron/remote" },
        ],
      }),
    ],
  },
  // stage
  {
    input: "src/server/stage/main.ts",
    output: {
      sourcemap: !production,
      format: "iife",
      name: "stage",
      file: "build/electron/stage/client.js",
    },
    // external: ["svelte/internal", "socket.io-client"], // <-- suppresses the warning
    plugins: [
      svelte({
        preprocess: sveltePreprocess({
          // typescript: {
          //   tsconfigFile: production ? "./tsconfig.server.prod.json" : "./tsconfig.server.json",
          // },
        }),
        compilerOptions: {
          // enable run-time checks when not in production
          dev: !production,
        },
      }),
      // we'll extract any component CSS out into
      // a separate file - better for performance
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
      typescript({
        // tsconfig: production ? "./tsconfig.server.prod.json" : "./tsconfig.server.json",
        tsconfig: "./tsconfig.server.json",
        sourceMap: !production,
        // inlineSources: !production,
      }),

      // html({
      //   title: "StageShow",
      //   fileName: "index.html",
      //   minify: production,
      //   meta: [{ charset: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1.0" }],
      // }),
      copy({
        targets: [
          { src: "src/server/stage/index.html", dest: "build/electron/stage" },
          { src: "src/server/stage/manifest.json", dest: "build/electron/stage" },
          { src: "src/server/icon.png", dest: "build/electron/stage" },
          { src: "src/server/sw.js", dest: "build/electron/stage" },
        ],
      }),
    ],
  },
  // webcam
  {
    input: "src/server/webcam/main.ts",
    output: {
      sourcemap: !production,
      format: "iife",
      name: "stage",
      file: "build/electron/webcam/client.js",
    },
    plugins: [
      svelte({
        preprocess: sveltePreprocess(),
        compilerOptions: {
          // enable run-time checks when not in production
          dev: !production,
        },
      }),
      // we'll extract any component CSS out into
      // a separate file - better for performance
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
      typescript({
        // tsconfig: production ? "./tsconfig.server.prod.json" : "./tsconfig.server.json",
        tsconfig: "./tsconfig.server.json",
        sourceMap: !production,
        // inlineSources: !production,
      }),

      // html({
      //   title: "CamShow",
      //   fileName: "index.html",
      //   minify: production,
      //   meta: [{ charset: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1.0" }],
      // }),
      copy({
        targets: [
          { src: "src/server/webcam/index.html", dest: "build/electron/webcam" },
          { src: "src/server/webcam/manifest.json", dest: "build/electron/webcam" },
          { src: "src/server/icon.png", dest: "build/electron/webcam" },
          { src: "src/server/sw.js", dest: "build/electron/webcam" },
        ],
      }),
    ],
  },
]
