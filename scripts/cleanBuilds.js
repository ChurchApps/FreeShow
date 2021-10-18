const { existsSync, readdirSync, lstatSync, unlinkSync, rmdirSync } = require("fs")
const { join } = require("path")

const deleteFolderRecursive = (folderPath) => {
  if (existsSync(folderPath)) {
    readdirSync(folderPath).forEach((file) => {
      const curPath = join(folderPath, file)
      if (lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath)
      } else {
        // delete file
        unlinkSync(curPath)
      }
    })
    rmdirSync(folderPath)
  }
}

const buildSveltePath = join(__dirname, "..", "public", "build")
const buildElectronPath = join(__dirname, "..", "build")
const buildServerPath = join(__dirname, "..", "build")
deleteFolderRecursive(buildSveltePath)
deleteFolderRecursive(buildElectronPath)
deleteFolderRecursive(buildServerPath)
