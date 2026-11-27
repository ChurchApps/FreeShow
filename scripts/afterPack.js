const fs = require("fs")
const path = require("path")

// electron-builder Arch enum: ia32 = 0, x64 = 1, armv7l = 2, arm64 = 3
const ARCH_NAMES = { 0: "ia32", 1: "x64", 2: "arm", 3: "arm64" }

function keepMatching(dir, shouldKeep) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir)) {
        if (!shouldKeep(entry)) fs.rmSync(path.join(dir, entry), { recursive: true, force: true })
    }
}

exports.default = async function afterPack(context) {
    const platform = context.electronPlatformName // "win32" | "darwin" | "linux"
    const arch = ARCH_NAMES[context.arch] || "x64"

    const resourcesDir = platform === "darwin" ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources") : path.join(context.appOutDir, "resources")
    const unpackedModules = path.join(resourcesDir, "app.asar.unpacked", "node_modules")
    if (!fs.existsSync(unpackedModules)) return

    // strip redundant unpacked native prebuilds that don't match the exact target OS and arch
    keepMatching(path.join(unpackedModules, "better-sqlite3", "prebuilds"), (e) => e.startsWith(`${platform}-${arch}`))
    keepMatching(path.join(unpackedModules, "koffi", "build", "koffi"), (e) => e === `${platform}_${arch}`)
    keepMatching(path.join(unpackedModules, "@julusian", "jpeg-turbo", "prebuilds"), (e) => e === `jpeg-turbo-${platform}-${arch}`)
    keepMatching(path.join(unpackedModules, "node-hid", "prebuilds"), (e) => e.endsWith(`-${platform}-${arch}`))
    const jazzTarget = platform === "win32" ? "win64" : platform === "linux" ? "linux64" : arch === "arm64" ? "macosa64" : "macos64"
    keepMatching(path.join(unpackedModules, "jazz-midi", "bin"), (e) => e === jazzTarget)
}
