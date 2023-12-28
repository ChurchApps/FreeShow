const { readdirSync, existsSync, lstatSync, unlinkSync, rmdirSync } = require("fs")
const { join } = require("path")

// app build file paths
const buildSveltePath = join(__dirname, "..", "public", "build")
const buildElectronPath = join(__dirname, "..", "build")
const buildServerPath = join(__dirname, "..", "build")

// delete folders and all of it's content
deleteFolderRecursive(buildSveltePath)
deleteFolderRecursive(buildElectronPath)
deleteFolderRecursive(buildServerPath)

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

// PRODUCTION CONFIG - WITHOUT SOURCE MAP (Already disabled)

// function generateProdTSConfig() {
//     const tsconfigSvelteJSONPath = join(__dirname, "..", "tsconfig.svelte.json")
//     const tsconfigElectronJSONPath = join(__dirname, "..", "tsconfig.electron.json")
//     const tsconfigServerJSONPath = join(__dirname, "..", "tsconfig.server.json")

//     const tsconfigSvelteJSONRaw = readFileSync(tsconfigSvelteJSONPath, "utf8")
//     const tsconfigElectronJSONRaw = readFileSync(tsconfigElectronJSONPath, "utf8")
//     const tsconfigServerJSONRaw = readFileSync(tsconfigServerJSONPath, "utf8")

//     const tsconfigSvelteJSON = JSON.parse(tsconfigSvelteJSONRaw)
//     const tsconfigElectronJSON = JSON.parse(tsconfigElectronJSONRaw)
//     const tsconfigServerJSON = JSON.parse(tsconfigServerJSONRaw)

//     tsconfigSvelteJSON.compilerOptions.sourceMap = false
//     tsconfigElectronJSON.compilerOptions.sourceMap = false
//     tsconfigServerJSON.compilerOptions.sourceMap = false

//     const newTsconfigSvelteJSONPath = tsconfigSvelteJSONPath.replace("tsconfig.svelte.json", "tsconfig.svelte.prod.json")
//     const newTsconfigElectronJSONPath = tsconfigElectronJSONPath.replace("tsconfig.electron.json", "tsconfig.electron.prod.json")
//     const newTsconfigServerJSONPath = tsconfigServerJSONPath.replace("tsconfig.server.json", "tsconfig.server.prod.json")

//     writeFileSync(newTsconfigSvelteJSONPath, JSON.stringify(tsconfigSvelteJSON))
//     writeFileSync(newTsconfigElectronJSONPath, JSON.stringify(tsconfigElectronJSON))
//     writeFileSync(newTsconfigServerJSONPath, JSON.stringify(tsconfigServerJSON))
// }

// if (process.env.NODE_ENV === "production") {
//     generateProdTSConfig()
// } else {
//     var execSync = require("child_process").execSync
//     var compiler = "npm run prestart:build"

//     execSync(compiler)
// }
