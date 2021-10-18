const { readdirSync, statSync, readFileSync, writeFileSync, existsSync, lstatSync, unlinkSync, rmdirSync, mkdirSync } = require("fs")
const { join } = require("path")

const Terser = require("terser")
const HTMLMinifier = require("html-minifier")
const CleanCSS = require("clean-css")

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

const getAllJSFiles = (dirPath, arrayOfFiles) => {
  const files = readdirSync(dirPath)

  if (arrayOfFiles == null) {
    arrayOfFiles = []
  }

  files.forEach((file) => {
    if (statSync(join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllJSFiles(join(dirPath, file), arrayOfFiles)
    } else {
      arrayOfFiles.push(join(dirPath, file))
    }
  })

  return arrayOfFiles.filter((filePath) => /\.js$/.exec(filePath))
}

const minifyJSFiles = (filePaths) => {
  filePaths.forEach((filePath) => {
    const unminified = readFileSync(filePath, "utf8")
    Terser.minify(unminified, minifyJSOptions)
      .then((minified) => {
        writeFileSync(filePath, minified.code)
      })
      .catch((err) => {
        process.emitWarning(err)
        process.abort()
      })
  })
}

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

const copyPublicFolderAndMinify = (folderPath, destinationPath) => {
  if (existsSync(destinationPath)) deleteFolderRecursive(destinationPath)

  mkdirSync(destinationPath)

  readdirSync(folderPath).forEach((file) => {
    const curPath = join(folderPath, file)
    const newPath = join(destinationPath, file)
    if (lstatSync(curPath).isDirectory()) {
      // recurse
      copyPublicFolderAndMinify(curPath, newPath)
    } else {
      if (/\.js$/.exec(curPath)) {
        const unminified = readFileSync(curPath, "utf8")
        Terser.minify(unminified, minifyJSOptions)
          .then((minified) => {
            writeFileSync(newPath, minified.code)
          })
          .catch((err) => {
            process.emitWarning(err)
            process.abort()
          })
      } else if (/\.html$/.exec(curPath)) {
        const unminified = readFileSync(curPath, "utf8")

        const unminifiedCorrected = unminified.replace(
          '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src http://localhost:*; connect-src ws://localhost:*">',
          '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">'
        )

        const minifierOptions = {
          preserveLineBreaks: false,
          collapseWhitespace: true,
          collapseInlineTagWhitespace: true,
          minifyURLs: true,
          minifyJS: true,
          minifyCSS: true,
          removeComments: true,
          removeAttributeQuotes: true,
          removeEmptyAttributes: true,
          removeEmptyElements: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true,
          quoteCharacter: "'",
        }
        const minified = HTMLMinifier.minify(unminifiedCorrected, minifierOptions)
        writeFileSync(newPath, minified)
      } else if (/\.css$/.exec(curPath)) {
        const unminified = readFileSync(curPath, "utf8")
        const minified = new CleanCSS().minify(unminified)
        writeFileSync(newPath, minified.styles)
      } else if (/\.png$/.exec(curPath)) {
        const pngFile = readFileSync(curPath)
        writeFileSync(newPath, pngFile)
      }
    }
  })
}

const cleanTsconfig = () => {
  const tsconfigSvelteJSONPath = join(__dirname, "..", "tsconfig.svelte.prod.json")
  const tsconfigElectronJSONPath = join(__dirname, "..", "tsconfig.electron.prod.json")
  const tsconfigServerJSONPath = join(__dirname, "..", "tsconfig.server.prod.json")

  if (existsSync(tsconfigSvelteJSONPath)) unlinkSync(tsconfigSvelteJSONPath)
  if (existsSync(tsconfigElectronJSONPath)) unlinkSync(tsconfigElectronJSONPath)
  if (existsSync(tsconfigServerJSONPath)) unlinkSync(tsconfigServerJSONPath)
}

const bundledElectronPath = join(__dirname, "..", "build")

const jsFiles = getAllJSFiles(bundledElectronPath)
minifyJSFiles(jsFiles)

copyPublicFolderAndMinify(join(__dirname, "..", "public"), join(bundledElectronPath, "public"))
cleanTsconfig()
