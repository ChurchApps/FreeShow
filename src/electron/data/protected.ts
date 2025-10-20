import crypto from 'crypto'
import { app } from "electron"
import fs from 'fs'
import http from 'http'
import https from 'https'
import path from 'path'
import { createFolder } from "../utils/files"
import { filePathHashCode } from "./thumbnails"
import { getKey } from "../utils/keys"
import { getMachineId } from "../IPC/responsesMain"

const protectedProviders = ["stream.mux.com"]

export function isProtectedProvider(url: string) {
    return protectedProviders.find(a => url.includes(a))
}

export function getProtectedPath(url: string) {
    const protectedDir = path.join(app.getPath("temp"), "freeshow-protected")
    createFolder(protectedDir)
    return path.join(protectedDir, filePathHashCode(url))
}

const alg = 'aes-256-cbc'
const keyLength = 32 // 32 bytes for AES-256
const ivLength = 16  // 16 bytes for CBC

export function getProviderKey(url: string) {
    if (url.includes("stream.mux.com")) return getMachineId()
    return getKey("enc_general")
}

function deriveKey(key: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const salt = Buffer.from(getKey("enc_salt"), 'utf8')
        crypto.scrypt(key, salt, keyLength, (err, derivedKey) => {
            if (err) reject(err)
            resolve(derivedKey)
        })
    })
}

export async function encryptFile(inputFile: string, outputFile: string, key: string) {
    const k = await deriveKey(key)
    const iv = crypto.randomBytes(ivLength) // random IV

    const writeStream = fs.createWriteStream(outputFile)

    // prepend the IV
    writeStream.write(iv)

    const readStream = await getReadStream(inputFile)
    const cipher = crypto.createCipheriv(alg, k, iv)

    return new Promise<void>((resolve, reject) => {
        readStream.on('error', (err) => {
            writeStream.destroy()
            reject(err)
        })
        writeStream.on('error', (err) => reject(err))
        writeStream.on('finish', () => {
            console.info('File encrypted successfully!')
            resolve()
        })

        readStream.pipe(cipher).pipe(writeStream)
    })
}

export async function decryptFile(inputFile: string, key: string): Promise<Buffer | null> {
    if (inputFile.startsWith('http://') || inputFile.startsWith('https://')) return null

    const k = await deriveKey(key)

    // read entire encrypted file into memory (IV + ciphertext)
    const data = await fs.promises.readFile(inputFile)
    if (data.length < ivLength) throw new Error('Encrypted file too short')

    const iv = data.slice(0, ivLength)
    const ciphertext = data.slice(ivLength)

    const decipher = crypto.createDecipheriv(alg, k, iv)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

    return decrypted
}

async function getReadStream(input: string, maxRedirects = 5): Promise<NodeJS.ReadableStream> {
    if (!input.startsWith('http://') && !input.startsWith('https://')) return fs.createReadStream(input)

    return new Promise((resolve, reject) => {
        const client = input.startsWith('https://') ? https : http
        const req = client.get(input, (res) => {
            // handle redirects (basic)
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (maxRedirects <= 0) {
                    reject(new Error('Too many redirects'))
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
        req.on('error', reject)
    })
}