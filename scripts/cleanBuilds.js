const { existsSync, readdirSync, lstatSync, unlinkSync, rmdirSync } = require("fs")
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
