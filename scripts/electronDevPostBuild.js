const { readFileSync, writeFileSync, copyFile } = require("fs")
const { join } = require("path")

function movePreload() {
    const rootPath = join(__dirname, "..")

    // copy preload.ts to public
    const preloadPath = join(rootPath, "src", "electron", "preload.ts")
    const newPreloadPath = join(rootPath, "public", "preload.ts")
    copyFile(preloadPath, newPreloadPath, err => {
        if (err) console.error("Error copying preload file:", err)
    })

    // change source to new preload path, and write built map to public
    const preloadMapPath = join(rootPath, "build", "electron", "preload.js.map")
    const preloadMapContent = readFileSync(preloadMapPath, "utf8")
    const parsedPreloadMap = JSON.parse(preloadMapContent || "{}")

    if (!parsedPreloadMap.sources) return
    parsedPreloadMap.sources = ["preload.ts"]

    const newPreloadMapPath = join(rootPath, "public", "preload.js.map")
    writeFileSync(newPreloadMapPath, JSON.stringify(parsedPreloadMap))
}

if (process.env.NODE_ENV !== "production") movePreload()
