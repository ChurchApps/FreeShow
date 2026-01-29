#!/usr/bin/env node
/*
Standalone OpenSong converter test runner
Usage:
  1) Install jsdom if you don't have it: npm i -D jsdom
  2) Run: node scripts/test-opensong.js

What it does:
  - Reads the original TypeScript converter at src/frontend/converters/opensong.ts
  - Produces a stripped-down JS version with small stubs for Svelte/browser dependencies
  - Loads the JS module and calls convertOpenSong with the sample file at scripts/testfiles/opensong_sample.os
  - The script prints the "temp shows" captured by the stubbed setTempShows
*/

const fs = require('fs')
const path = require('path')

// ensure DOMParser available (jsdom)
try {
    const { JSDOM } = require('jsdom')
    global.DOMParser = new JSDOM('').window.DOMParser
} catch (err) {
    console.error('This script requires jsdom. Install it with: npm i -D jsdom')
    process.exit(1)
}

const srcPath = path.join(__dirname, '..', 'src', 'frontend', 'converters', 'opensong.ts')
const tmpDir = path.join(__dirname, '.tmp')
const tmpFile = path.join(tmpDir, 'opensong_test.js')
const sampleFile = path.join(__dirname, 'testfiles', 'opensong_sample.os')

if (!fs.existsSync(srcPath)) {
    console.error('Cannot find opensong.ts at', srcPath)
    process.exit(1)
}

if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

let content = fs.readFileSync(srcPath, 'utf8')

// 1) Remove TypeScript-only constructs (interfaces, type imports)
content = content.replace(/import type[\s\S]*?;\n/g, '')
content = content.replace(/interface[\s\S]*?}\n/g, '')

// 2) Replace some imports with CommonJS requires or stubbed code
// We'll inject small stubs for Svelte stores / helpers used by the converter
const stubHeader = `// --- auto-generated test stubs ---
const { uid } = require('uid')
const DEFAULT_ITEM_STYLE = { fontSize: '40' }
const setQuickAccessMetadata = (show/*, k, v */) => show
const checkName = (name) => name || 'Untitled'
const formatToFileName = (s) => s || ''
const translateText = (s) => s || s
// minimal "get" for svelte stores used in the converter
const get = (store) => (store && store.__value !== undefined ? store.__value : store)
// stubbed svelte-like stores used by opensong.ts
const activePopup = { set: (v) => console.log('[stub] activePopup.set ->', v) }
const alertMessage = { set: (v) => console.log('[stub] alertMessage.set ->', v) }
// emulate common global groups so converters that check for them will set globalGroup
const groups = { __value: { verse: true, chorus: true, bridge: true, tag: true, outro: true, pre_chorus: true } }
const scriptures = { __value: {} }
const scripturesCache = { update: (fn) => { const a = {}; fn(a); } }
const setActiveScripture = () => {}
const createCategory = (name) => 'category_test_' + (name || 'opensong')
let _capturedTempShows = null
const setTempShows = (tempShows) => { _capturedTempShows = tempShows; console.log('[stub] setTempShows called, shows:'); console.log(JSON.stringify(tempShows, null, 2)) }
// Minimal ShowObj used only to arrange basic structure
class ShowObj {
    constructor(isPrivate = false, category = null, layoutId = uid()) {
        this.name = ''
        this.private = isPrivate
        this.category = category
        this.settings = { activeLayout: layoutId }
        this.timestamps = { created: Date.now(), modified: null, used: null }
        this.quickAccess = {}
        this.meta = {}
        this.slides = {}
        this.layouts = { [layoutId]: { name: translateText('example.default'), notes: '', slides: [] } }
        this.media = {}
    }
}
// --- end stubs ---

`

// Remove the original imports (a handful) and replace with stub header
content = content.replace(/(^\s*import[\s\S]*?\n(\s*\n|(?=export function)))/m, '')
content = stubHeader + '\n' + content

// 3) Transpile TypeScript to JavaScript using TypeScript compiler
const ts = require('typescript')
const transpiled = ts.transpileModule(content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }})
let js = transpiled.outputText

// ensure functions and helper are exported/available
js += '\nmodule.exports = { convertOpenSong: exports.convertOpenSong || convertOpenSong, convertOpenSongBible: exports.convertOpenSongBible || convertOpenSongBible, _capturedTempShows: () => _capturedTempShows }\n'

fs.writeFileSync(tmpFile, js, 'utf8')
console.log('Wrote test module to', tmpFile)

// Collect files to test (supports files, directories, and simple glob patterns)
function isGlobPattern(s) {
    return /[*?\[\]{}]/.test(s)
}

function globToRegExp(p) {
    // very small handler: '**' -> '.*', '*' -> '[^/]*', '?' -> '.', escape other regex chars
    let tmp = p.replace(/\\/g, '/')
    tmp = tmp.replace(/\*\*/g, '::RECUR::')
    tmp = tmp.replace(/([.+^=!:${}()|\\])/g, '\\$1')
    tmp = tmp.replace(/::RECUR::/g, '.*')
    tmp = tmp.replace(/\*/g, '[^/]*')
    tmp = tmp.replace(/\?/g, '.')
    return new RegExp('^' + tmp + '$')
}

function walkDir(dir, cb) {
    const entries = fs.readdirSync(dir)
    entries.forEach((name) => {
        const fp = path.join(dir, name)
        const stat = fs.lstatSync(fp)
        if (stat.isDirectory()) walkDir(fp, cb)
        else cb(fp)
    })
}

function collectFilesFromPaths(paths) {
    const exts = new Set(['.os', '.xml', '.song', '.songs', '.txt'])
    const result = []

    paths.forEach((p) => {
        // treat as glob if contains glob chars
        if (isGlobPattern(p)) {
            // determine base dir to walk
            const dirPart = path.dirname(p)
            const baseDir = dirPart === '.' ? process.cwd() : path.isAbsolute(dirPart) ? dirPart : path.join(__dirname, '..', dirPart)
            const re = globToRegExp(p)
            if (fs.existsSync(baseDir) && fs.lstatSync(baseDir).isDirectory()) {
                walkDir(baseDir, (fp) => {
                    const rel = path.relative(baseDir, fp).replace(/\\/g, '/')
                    const cand = path.join(dirPart === '.' ? '' : dirPart, rel)
                    if (re.test(cand) || re.test(fp.replace(/\\/g, '/'))) result.push({ content: fs.readFileSync(fp, 'utf8'), name: path.basename(fp), extension: path.extname(fp).slice(1), path: fp })
                })
            }
            return
        }

        const full = path.isAbsolute(p) ? p : path.join(__dirname, '..', p)
        if (!fs.existsSync(full)) return
        const stat = fs.lstatSync(full)
        if (stat.isDirectory()) {
            const entries = fs.readdirSync(full)
            const candidates = entries
                .map((name) => path.join(full, name))
                .filter((fp) => fs.lstatSync(fp).isFile())
            // filter by known extensions; if none match, include all files
            const filtered = candidates.filter((fp) => exts.has(path.extname(fp).toLowerCase()))
            const chosen = filtered.length ? filtered : candidates
            chosen.forEach((fp) => result.push({ content: fs.readFileSync(fp, 'utf8'), name: path.basename(fp), extension: path.extname(fp).slice(1), path: fp }))
        } else if (stat.isFile()) {
            result.push({ content: fs.readFileSync(full, 'utf8'), name: path.basename(full), extension: path.extname(full).slice(1), path: full })
        }
    })

    return result
}

// Simple CLI options: --out <file> (combined JSON), --out-dir <dir> (per-file JSON), --pretty
const rawArgs = process.argv.slice(2)
const opts = { out: null, outDir: null, pretty: false }
const paths = []
for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i]
    if (a === '--out' && rawArgs[i + 1]) {
        opts.out = rawArgs[i + 1]
        i++
        continue
    }
    if (a.startsWith('--out=')) {
        opts.out = a.split('=')[1]
        continue
    }
    if (a === '--out-dir' && rawArgs[i + 1]) {
        opts.outDir = rawArgs[i + 1]
        i++
        continue
    }
    if (a.startsWith('--out-dir=')) {
        opts.outDir = a.split('=')[1]
        continue
    }
    if (a === '--pretty') {
        opts.pretty = true
        continue
    }
    if (a === '--help' || a === '-h') {
        console.log('Usage: node scripts/test-opensong.js [paths...] [--out <file>] [--out-dir <dir>] [--pretty]')
        process.exit(0)
    }
    paths.push(a)
}

let filesToTest = []
if (!paths.length) {
    if (!fs.existsSync(sampleFile)) {
        console.error('Sample OpenSong file not found at', sampleFile)
        process.exit(1)
    }

    filesToTest.push({ content: fs.readFileSync(sampleFile, 'utf8'), name: path.basename(sampleFile), extension: path.extname(sampleFile).slice(1), path: sampleFile })
} else {
    filesToTest = collectFilesFromPaths(paths)
    if (!filesToTest.length) {
        console.error('No files found for provided path(s):', paths.join(', '))
        process.exit(1)
    }
}

// Load the generated module and run converter
const mod = require(tmpFile)
console.log('Processing', filesToTest.length, 'file(s)...')

// run sequentially so we can produce per-file outputs
async function runSequential() {
    const results = []
    for (const file of filesToTest) {
        console.log(' - converting', file.path || file.name)
        mod.convertOpenSong([file])
        // wait for the converter setTimeout to run (10ms inside converter)
        await new Promise((res) => setTimeout(res, 300))
        const out = mod._capturedTempShows()
        results.push({ file: file.path || file.name, shows: out })

        if (opts.outDir) {
            const outDirResolved = path.isAbsolute(opts.outDir) ? opts.outDir : path.join(__dirname, '..', opts.outDir)
            if (!fs.existsSync(outDirResolved)) fs.mkdirSync(outDirResolved, { recursive: true })
            const safeName = path.basename(file.name).replace(/\.[^/.]+$/, '') + '.json'
            const outPath = path.join(outDirResolved, safeName)
            fs.writeFileSync(outPath, opts.pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out))
            console.log('   wrote', outPath)
        }
    }

    if (opts.out) {
        const outPath = path.isAbsolute(opts.out) ? opts.out : path.join(__dirname, '..', opts.out)
        const outDir = path.dirname(outPath)
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
        fs.writeFileSync(outPath, opts.pretty ? JSON.stringify(results, null, 2) : JSON.stringify(results))
        console.log('Wrote combined results to', outPath)
    }

    // print summary
    console.log('\nSummary:')
    results.forEach((r) => console.log(' -', r.file, '->', (r.shows || []).length, 'show(s)'))
}

runSequential().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1) })
