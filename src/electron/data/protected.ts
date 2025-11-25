import crypto from "crypto"
import { app, protocol } from "electron"
import fs from "fs"
import http from "http"
import https from "https"
import path from "path"
import { ContentProviderFactory } from "../contentProviders/base/ContentProvider"
import type { ContentProviderId } from "../contentProviders/base/types"
import { createFolder, getMimeType } from "../utils/files"
import { getKey } from "../utils/keys"
import { filePathHashCode } from "./thumbnails"

export function getProtectedPath(url: string) {
    const protectedDir = path.join(app.getPath("temp"), "freeshow-protected")
    createFolder(protectedDir)
    return path.join(protectedDir, filePathHashCode(url))
}

const alg = "aes-256-cbc"
const keyLength = 32 // 32 bytes for AES-256
const ivLength = 16 // 16 bytes for CBC

function deriveKey(key: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const salt = Buffer.from(getKey("enc_salt"), "utf8")
        crypto.scrypt(key, salt, keyLength, (err, derivedKey) => {
            if (err) reject(err)
            resolve(derivedKey)
        })
    })
}

export async function encryptFile(inputFile: string, outputFile: string, key: string) {
    const k = await deriveKey(key)
    const iv = crypto.randomBytes(ivLength) // random IV

    await removeIfExists(outputFile)
    const writeStream = fs.createWriteStream(outputFile)

    // prepend the IV
    writeStream.write(iv)

    const readStream = await getReadStream(inputFile)
    const cipher = crypto.createCipheriv(alg, k, iv)

    return new Promise<void>((resolve, reject) => {
        const handleError = (err: Error) => {
            writeStream.destroy()
            removeIfExists(outputFile)
            reject(err)
        }

        readStream.on("error", handleError)
        writeStream.on("error", handleError)
        writeStream.on("finish", () => {
            console.info("File encrypted successfully!")
            resolve()
        })

        readStream.pipe(cipher).pipe(writeStream)
    })
}

export async function decryptFile(inputFile: string, key: string): Promise<Buffer | null> {
    if (inputFile.startsWith("http://") || inputFile.startsWith("https://")) return null

    const k = await deriveKey(key)

    // read entire encrypted file into memory (IV + ciphertext)
    const data = await fs.promises.readFile(inputFile)
    if (data.length < ivLength) throw new Error("Encrypted file too short")

    const iv = data.slice(0, ivLength)
    const ciphertext = data.slice(ivLength)

    const decipher = crypto.createDecipheriv(alg, k, iv)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

    return decrypted
}

async function getReadStream(input: string, maxRedirects = 5): Promise<NodeJS.ReadableStream> {
    if (!input.startsWith("http://") && !input.startsWith("https://")) return fs.createReadStream(input)

    return new Promise((resolve, reject) => {
        const client = input.startsWith("https://") ? https : http
        const req = client.get(input, (res) => {
            // handle redirects (basic)
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (maxRedirects <= 0) {
                    reject(new Error("Too many redirects"))
                    return
                }
                // follow location
                const loc = res.headers.location

                // close current response
                res.destroy()
                getReadStream(loc, maxRedirects - 1).then(resolve).catch(reject)
                return
            }

            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`Request failed with status ${res.statusCode}`))
                return
            }

            resolve(res)
        })
        req.on("error", reject)
    })
}

// ----- Protected media protocol -----

type ProtectedMediaEntry = {
    id: string
    filePath: string
    providerId: ContentProviderId
    mimeType: string
}

const protectedEntries = new Map<string, ProtectedMediaEntry>()
const decryptedCache = new Map<
    string,
    {
        buffer: Buffer
        timeout: NodeJS.Timeout | null
    }
>()

const CACHE_TTL = 1000 * 60 * 5 // 5 minutes
const PROTOCOL_SCHEME = "freeshow-protected"

export function registerProtectedProtocol() {
    protocol.handle(PROTOCOL_SCHEME, async (request) => {
        try {
            const parsed = new URL(request.url)
            const entryId = parsed.hostname || parsed.pathname.replace(/^\//, "")
            const entry = protectedEntries.get(entryId)
            if (!entry) throw new Error(`Unknown protected media id: ${entryId}`)

            const buffer = await getDecryptedBuffer(entry)
            if (!buffer) throw new Error(`Failed to decrypt protected file: ${entry.filePath}`)

            const total = buffer.length
            const range = request.headers.get("range")
            const { start, end, statusCode } = parseRange(range, total)
            const chunk = buffer.subarray(start, end + 1)

            const headers = new Headers({
                "Content-Type": entry.mimeType,
                "Content-Length": String(chunk.length),
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-store"
            })
            if (statusCode === 206) {
                headers.set("Content-Range", `bytes ${start}-${end}/${total}`)
            }

            return new Response(new Uint8Array(chunk), { status: statusCode, headers })
        } catch (err) {
            console.error("[ProtectedMedia] Failed to serve protected media:", err)
            return new Response(null, { status: 500 })
        }
    })
}

export function registerProtectedMediaFile({
    filePath,
    providerId,
    mimeType
}: {
    filePath: string
    providerId: ContentProviderId
    mimeType?: string
}): string | null {
    if (!filePath || !providerId) return null

    const entryId = path.basename(filePath)
    const normalizedMime = mimeType || getMimeType(filePath) || "application/octet-stream"

    protectedEntries.set(entryId, { id: entryId, filePath, providerId, mimeType: normalizedMime })
    if (decryptedCache.has(entryId)) {
        decryptedCache.delete(entryId)
    }

    return `${PROTOCOL_SCHEME}://${entryId}`
}

async function getDecryptedBuffer(entry: ProtectedMediaEntry) {
    const cached = decryptedCache.get(entry.id)
    if (cached) {
        refreshCache(entry.id)
        return cached.buffer
    }

    const provider = ContentProviderFactory.getProvider(entry.providerId)
    const key = provider?.getEncryptionKey?.()
    if (!key) {
        throw new Error(`Provider ${entry.providerId} did not provide an encryption key`)
    }

    const decrypted = await decryptFile(entry.filePath, key)
    if (!decrypted) return null

    decryptedCache.set(entry.id, { buffer: decrypted, timeout: null })
    refreshCache(entry.id)
    return decrypted
}

function refreshCache(id: string) {
    const cached = decryptedCache.get(id)
    if (!cached) return
    if (cached.timeout) clearTimeout(cached.timeout)
    cached.timeout = setTimeout(() => decryptedCache.delete(id), CACHE_TTL)
}

function parseRange(rangeHeader: string | null, totalLength: number) {
    if (!rangeHeader || totalLength === 0) {
        return { start: 0, end: Math.max(0, totalLength - 1), statusCode: 200 }
    }

    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader || "")
    if (!match) return { start: 0, end: totalLength - 1, statusCode: 200 }

    const hasStart = match[1] !== ""
    const hasEnd = match[2] !== ""

    let start = hasStart ? Number(match[1]) : 0
    let end = hasEnd ? Number(match[2]) : totalLength - 1

    if (!hasStart && hasEnd) {
        const suffixLength = Number(match[2])
        if (!Number.isNaN(suffixLength)) {
            start = Math.max(totalLength - suffixLength, 0)
            end = totalLength - 1
        }
    }

    if (Number.isNaN(start) || start < 0) start = 0
    if (Number.isNaN(end) || end >= totalLength) end = totalLength - 1
    if (start > end) start = 0

    return { start, end, statusCode: 206 }
}

async function removeIfExists(filePath: string) {
    try {
        await fs.promises.unlink(filePath)
    } catch (err: any) {
        if (err?.code !== "ENOENT") throw err
    }
}