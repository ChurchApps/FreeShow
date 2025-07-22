const { existsSync, readdirSync, lstatSync, unlinkSync, rmdirSync, readFileSync, writeFileSync } = require("fs")
const { join } = require("path")

// app build file paths
const buildSveltePath = join(__dirname, "..", "public", "build")
const buildElectronPath = join(__dirname, "..", "build") // this includes server files

// delete folders and all of it's content
deleteFolderRecursive(buildSveltePath)
deleteFolderRecursive(buildElectronPath)
deletePublicFile("preload.ts")
deletePublicFile("preload.js.map")
restoreDevelopmentHTML()

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

function deletePublicFile(fileName) {
    const publicPath = join(__dirname, "..", "public")
    const filePath = join(publicPath, fileName)
    if (!existsSync(filePath)) return

    unlinkSync(filePath)
}

function restoreDevelopmentHTML() {
    const sourceIndexPath = join(__dirname, "..", "public", "index.html")
    const devIndexPath = join(__dirname, "..", "public", "index.dev.html")
    
    if (existsSync(devIndexPath)) {
        const devContent = readFileSync(devIndexPath, "utf8")
        writeFileSync(sourceIndexPath, devContent)
    }
}
