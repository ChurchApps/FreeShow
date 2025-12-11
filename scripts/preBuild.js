const { readdirSync, existsSync, lstatSync, unlinkSync, rmdirSync, readFileSync, writeFileSync, copyFile } = require("fs")
const { join } = require("path")

// app build file paths
const buildSveltePath = join(__dirname, "..", "public", "build")
const buildElectronPath = join(__dirname, "..", "build") // this includes server files

// delete folders and all of it's content
deleteFolderRecursive(buildSveltePath)
deleteFolderRecursive(buildElectronPath)

function deleteFolderRecursive(folderPath) {
    if (!existsSync(folderPath)) return

    readdirSync(folderPath).forEach((file) => {
        const path = join(folderPath, file)
        const isFolder = lstatSync(path).isDirectory()
        if (isFolder) return deleteFolderRecursive(path)

        // delete file
        unlinkSync(path)
    })

    rmdirSync(folderPath)
}

// create production configs with no source map
function generateProdConfigs() {
    const configs = ["svelte", "electron", "server"]
    configs.forEach(createProdConfig)

    function createProdConfig(id) {
        const baseConfigPath = join(__dirname, "..", "config", "typescript", `tsconfig.${id}.json`)
        const rawConfig = readFileSync(baseConfigPath, "utf8")
        const parsedConfig = JSON.parse(rawConfig || "{}")

        if (!parsedConfig.compilerOptions) parsedConfig.compilerOptions = {}
        parsedConfig.compilerOptions.sourceMap = false

        const newConfigPath = baseConfigPath.replace(`tsconfig.${id}.json`, `tsconfig.${id}.prod.json`)
        writeFileSync(newConfigPath, JSON.stringify(parsedConfig))
    }
}

// copy the latest version of pdf worker file to ensure it's up to date with the package version
function getPdfWorkerFile() {
    const workerName = "pdf.worker.min.mjs"
    const originPath = join(__dirname, "..", "node_modules", "pdfjs-dist", "build", workerName)
    const outputPath = join(__dirname, "..", "public", "assets", workerName)

    copyFile(originPath, outputPath, (err) => {
        if (err) console.error("Could not copy PDF worker file:", err)
    })
}

if (process.env.NODE_ENV === "production") generateProdConfigs()
getPdfWorkerFile()
