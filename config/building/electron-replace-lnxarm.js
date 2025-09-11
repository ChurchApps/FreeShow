const fs = require("fs")

// castlabs electron has no build for Linux arm64
const version = "37.0.0"
const integrity = "sha512-QhdtwF7Hq1qfnUXigYp1+bTGuLYTmYTir5KnrMXxWJoWfNhURRU2EYuTktBHoWT5mtv/GmmRjGEiR3IS2p9SSA=="

// replace package.json entry
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
pkg.devDependencies["electron"] = version
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2))

// replace package-lock.json entry
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"))
if (lock.packages && lock.packages["node_modules/electron"]) {
    lock.packages["node_modules/electron"].version = version
    lock.packages["node_modules/electron"].resolved = `https://registry.npmjs.org/electron/-/electron-${version}.tgz`
    lock.packages["node_modules/electron"].integrity = integrity
}
fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2))
