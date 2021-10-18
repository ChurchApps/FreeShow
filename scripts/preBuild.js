const { readdirSync, readFileSync, writeFileSync, existsSync, lstatSync, unlinkSync, rmdirSync } = require("fs")
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

const generateProdTSConfig = () => {
  const tsconfigSvelteJSONPath = join(__dirname, "..", "tsconfig.svelte.json")
  const tsconfigElectronJSONPath = join(__dirname, "..", "tsconfig.electron.json")
  const tsconfigServerJSONPath = join(__dirname, "..", "tsconfig.server.json")

  const tsconfigSvelteJSONRaw = readFileSync(tsconfigSvelteJSONPath, "utf8")
  const tsconfigSvelteJSON = JSON.parse(tsconfigSvelteJSONRaw) // eslint-disable-line @typescript-eslint/no-unsafe-assignment

  const tsconfigElectronJSONRaw = readFileSync(tsconfigElectronJSONPath, "utf8")
  const tsconfigElectronJSON = JSON.parse(tsconfigElectronJSONRaw) // eslint-disable-line @typescript-eslint/no-unsafe-assignment

  const tsconfigServerJSONRaw = readFileSync(tsconfigServerJSONPath, "utf8")
  const tsconfigServerJSON = JSON.parse(tsconfigServerJSONRaw) // eslint-disable-line @typescript-eslint/no-unsafe-assignment

  tsconfigSvelteJSON.compilerOptions.sourceMap = false
  tsconfigElectronJSON.compilerOptions.sourceMap = false
  tsconfigServerJSON.compilerOptions.sourceMap = false

  const newTsconfigSvelteJSONPath = tsconfigSvelteJSONPath.replace("tsconfig.svelte.json", "tsconfig.svelte.prod.json")
  const newTsconfigElectronJSONPath = tsconfigElectronJSONPath.replace("tsconfig.electron.json", "tsconfig.electron.prod.json")
  const newTsconfigServerJSONPath = tsconfigServerJSONPath.replace("tsconfig.server.json", "tsconfig.server.prod.json")

  writeFileSync(newTsconfigSvelteJSONPath, JSON.stringify(tsconfigSvelteJSON))
  writeFileSync(newTsconfigElectronJSONPath, JSON.stringify(tsconfigElectronJSON))
  writeFileSync(newTsconfigServerJSONPath, JSON.stringify(tsconfigServerJSON))
}

const buildSveltePath = join(__dirname, "..", "public", "build")
const buildElectronPath = join(__dirname, "..", "build")
const buildServerPath = join(__dirname, "..", "build")
deleteFolderRecursive(buildSveltePath)
deleteFolderRecursive(buildElectronPath)
deleteFolderRecursive(buildServerPath)

if (process.env.NODE_ENV === "production") {
  generateProdTSConfig()
}
// else {
//   var execSync = require("child_process").execSync;
//   var compiler = "npm run prestart:build";

//   execSync(compiler);
// }
