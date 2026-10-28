const { readdirSync, existsSync, cpSync } = require("fs")
const { join } = require("path")

// EXAMPLE
// actual build: "node-v127-napi-v3-win32-x64-unknown-unknown"
// should be: "electron-vX-napi-v3-win32-x64-unknown-unknown"
// there is a slight difference, but it works!
function ensureOpusBuild() {
    const prebuildDir = join(__dirname, "..", "node_modules", "@discordjs", "opus", "prebuild")
    if (!existsSync(prebuildDir)) return

    const electronVersion = require("electron/package.json").version || ""
    if (!electronVersion) return

    const electronMajorVersion = electronVersion.split(".")[0] + "." + electronVersion.split(".")[1]
    const targetPrefix = `electron-v${electronMajorVersion}-`

    const folders = readdirSync(prebuildDir).filter((f) => f.includes("napi"))
    const nodeFolders = folders.filter((f) => f.startsWith("node-"))
    const sourceFolders = nodeFolders.length ? nodeFolders : folders.filter((f) => !f.startsWith(targetPrefix))

    for (const sourceFolder of sourceFolders) {
        const newName = `${targetPrefix}${sourceFolder.slice(sourceFolder.indexOf("napi"))}`
        if (folders.includes(newName)) continue

        try {
            cpSync(join(prebuildDir, sourceFolder), join(prebuildDir, newName), { recursive: true })
        } catch (err) {
            console.error("Error copying OPUS folder:", err)
        }
    }
}

if (require.main === module) ensureOpusBuild()

exports.default = async function () {
    ensureOpusBuild()
}
exports.ensureOpusBuild = ensureOpusBuild
