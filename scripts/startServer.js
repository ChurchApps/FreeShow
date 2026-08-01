// ----- FreeShow -----
// Dev helper for the headless server: builds the web bundle + headless server,
// then starts the server. Pass through args, e.g.:
//   npm run dev:server -- --port 5502 --data ~/freeshow-data --token secret
//
// (A watch-based dev loop can be layered on later; this is a straightforward
// build-then-run so it works without extra dev dependencies.)

const { spawnSync, spawn } = require("child_process")
const path = require("path")

const root = path.join(__dirname, "..")
const passthroughArgs = process.argv.slice(2)

function run(cmd, args, label) {
    console.info(`\n[startServer] ${label} ...`)
    const res = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" })
    if (res.status !== 0) {
        console.error(`[startServer] ${label} failed`)
        process.exit(res.status || 1)
    }
}

run("npm", ["run", "build:web"], "building web bundle")
run("npm", ["run", "build:headless"], "building headless server")

console.info("\n[startServer] starting server ...")
const server = spawn("node", ["build/headless/server/headless/index.js", ...passthroughArgs], { cwd: root, stdio: "inherit", shell: process.platform === "win32" })
server.on("exit", (code) => process.exit(code || 0))
