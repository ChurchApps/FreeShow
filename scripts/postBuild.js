const { readdirSync, statSync, readFileSync, writeFileSync, existsSync, lstatSync, unlinkSync, rmdirSync, mkdirSync, rename } = require("fs")
const { join } = require("path")

const Terser = require("terser")
// const HTMLMinifier = require("html-minifier")
// const CleanCSS = require("clean-css")

function getAllJSFiles(dirPath, arrayOfFiles) {
    const files = readdirSync(dirPath)

    if (!arrayOfFiles) arrayOfFiles = []

    files.forEach((file) => {
        const isFolder = statSync(join(dirPath, file)).isDirectory()

        if (isFolder) arrayOfFiles = getAllJSFiles(join(dirPath, file), arrayOfFiles)
        else arrayOfFiles.push(join(dirPath, file))
    })

    return arrayOfFiles.filter((filePath) => /\.js$/.exec(filePath))
}

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

function copyPublicFolderAndMinify(folderPath, destinationPath) {
    if (existsSync(destinationPath)) deleteFolderRecursive(destinationPath)

    mkdirSync(destinationPath)

    readdirSync(folderPath).forEach(processFile)
    function processFile(file) {
        const curPath = join(folderPath, file)
        const newPath = join(destinationPath, file)
        const isFolder = lstatSync(curPath).isDirectory()

        if (isFolder) return copyPublicFolderAndMinify(curPath, newPath)

        if (/\.js$/.exec(curPath)) return minifyJS(curPath, newPath)
        // if (/\.html$/.exec(curPath)) return minifyHTML(curPath, newPath)
        // if (/\.css$/.exec(curPath)) return minifyCSS(curPath, newPath)

        if (/\.png|\.ico|\.icns|\.html|\.css|\.ttf|\.woff|\.woff2|\.json$/.exec(curPath)) {
            const fileContent = readFileSync(curPath)
            writeFileSync(newPath, fileContent)
        }
    }
}

// remove custom configs created by preBuild.js
function removeTsConfigs() {
    const configs = ["svelte", "electron", "server"]
    configs.forEach(deleteConfig)

    function deleteConfig(id) {
        const prodConfidPath = join(__dirname, "..", "config", "typescript", `tsconfig.${id}.prod.json`)
        if (!existsSync(prodConfidPath)) return
        unlinkSync(prodConfidPath)
    }
}

// MINIFY

const minifyJSOptions = {
    mangle: {
        toplevel: true,
    },
    compress: {
        passes: 2,
    },
    output: {
        beautify: false,
        preamble: "/* uglified */",
    },
}

function minifyJSFiles(filePaths) {
    filePaths.forEach((filePath) => minifyJS(filePath))
}

function minifyJS(filePath, newPath = "") {
    const unminified = readFileSync(filePath, "utf8")

    Terser.minify(unminified, minifyJSOptions)
        .then((minified) => {
            writeFileSync(newPath || filePath, minified.code)
        })
        .catch((err) => {
            process.emitWarning(err)
            process.abort()
        })
}

// const minifyHTMLOptions = {
//     preserveLineBreaks: false,
//     collapseWhitespace: true,
//     collapseInlineTagWhitespace: true,
//     minifyURLs: true,
//     minifyJS: true,
//     minifyCSS: true,
//     removeComments: true,
//     removeAttributeQuotes: true,
//     removeEmptyAttributes: true,
//     removeEmptyElements: true,
//     removeRedundantAttributes: true,
//     removeScriptTypeAttributes: true,
//     removeStyleLinkTypeAttributes: true,
//     useShortDoctype: true,
//     quoteCharacter: "'",
// }

// function minifyHTML(curPath, newPath) {
//     const unminified = readFileSync(curPath, "utf8")

//     const unminifiedCorrected = unminified.replace(
//         '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src http://localhost:*; connect-src ws://localhost:*">',
//         '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">'
//     )

//     const minified = HTMLMinifier.minify(unminifiedCorrected, minifyHTMLOptions)
//     writeFileSync(newPath, minified)
// }

// function minifyCSS(curPath, newPath) {
//     const unminified = readFileSync(curPath, "utf8")
//     const minified = new CleanCSS().minify(unminified)

//     writeFileSync(newPath, minified.styles)
// }

// OPUS FIX

// EXAMPLE
// actual build: "node-v127-napi-v3-win32-x64-unknown-unknown"
// should be: "electron-v32.2-napi-v3-win32-x64-unknown-unknown"
// there is a slight difference, but it works!
function renameOpusBuild() {
    const prebuildDir = join(__dirname, "..", "node_modules", "@discordjs", "opus", "prebuild")
    const folders = readdirSync(prebuildDir)

    if (folders.length !== 1 || folders[0].includes("electron")) return

    const electronVersion = require("electron/package.json").version || ""
    if (!electronVersion) return

    const electronMajorVersion = electronVersion.split(".")[0] + "." + electronVersion.split(".")[1]
    const newName = `electron-v${electronMajorVersion}-${folders[0].slice(folders[0].indexOf("napi"))}`

    rename(join(prebuildDir, folders[0]), join(prebuildDir, newName), (err) => {
        if (err) console.error("Error renaming folder:", err)
    })
}

// Copy Vite-processed index.html to the correct location and fix paths
function copyProductionHTML() {
    // Copy the production HTML to replace the main index.html for packaging
    const sourceIndexPath = join(__dirname, "..", "public", "index.html")
    const prodIndexPath = join(__dirname, "..", "public", "index.prod.html")
    
    if (existsSync(prodIndexPath)) {
        const prodContent = readFileSync(prodIndexPath, "utf8")
        writeFileSync(sourceIndexPath, prodContent)
    }
}

// EXECUTE

const bundledElectronPath = join(__dirname, "..", "build")
minifyJSFiles(getAllJSFiles(bundledElectronPath))
copyPublicFolderAndMinify(join(__dirname, "..", "public"), join(bundledElectronPath, "public"))
copyProductionHTML() // Copy production HTML for packaging
removeTsConfigs()

// fix for OPUS electron vs node env
renameOpusBuild()
