// ----- FreeShow -----
// Cloud sync to any S3 compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO, Wasabi, ...).
// Stores the same current.zip / previous.zip pair as the ChurchApps sync, inside the configured bucket & prefix.

import crypto from "crypto"
import { app } from "electron"
import fs from "fs"
import { dirname, join } from "path"
import { ToMain } from "../../types/IPC/ToMain"
import { getStoreValue, setStoreValue } from "../data/store"
import { sendToMain } from "../IPC/main"
import { getErrorMessage, isOfflineError, normalizeS3Config, S3Client, type S3Config } from "./s3/S3Client"

const ZIP_TYPE = "application/zip"
const CURRENT = "current.zip"
const PREVIOUS = "previous.zip"

// CONFIG

// the secret is never sent back to the renderer
export type S3PublicConfig = Omit<S3Config, "secretAccessKey">

export function getS3Config(): S3Config | null {
    const secrets = getStoreValue({ file: "ACCESS", key: "secrets" }) || {}
    const config = secrets.s3Sync as S3Config | undefined
    if (!config?.bucket || !config.accessKeyId || !config.secretAccessKey) return null
    return normalizeS3Config(config)
}

export function getS3PublicConfig(): S3PublicConfig | null {
    const config = getS3Config()
    if (!config) return null

    const publicConfig: Partial<S3Config> = { ...config }
    delete publicConfig.secretAccessKey
    return publicConfig as S3PublicConfig
}

// test before saving, an empty secret keeps the stored one (so the form can be edited without re-entering it)
export async function setS3Config(input: S3Config | null): Promise<{ success: boolean; error?: string }> {
    const secrets = getStoreValue({ file: "ACCESS", key: "secrets" }) || {}

    if (!input) {
        const rest = { ...secrets }
        delete rest.s3Sync
        setStoreValue({ file: "ACCESS", key: "secrets", value: rest })
        resetS3SyncManager()
        return { success: true }
    }

    const previous = getS3Config()
    const config = normalizeS3Config({ ...input, secretAccessKey: input.secretAccessKey || previous?.secretAccessKey || "" })

    const result = await new S3Client(config).testConnection()
    if (!result.success) return result

    setStoreValue({ file: "ACCESS", key: "secrets", value: { ...secrets, s3Sync: config } })
    resetS3SyncManager()
    return { success: true }
}

// MANAGER

class S3SyncManager {
    private static offlineAlerted = false
    client: S3Client

    constructor(config: S3Config) {
        this.client = new S3Client(config)
    }

    async hasValidConnection() {
        const result = await this.client.testConnection()
        if (!result.success) console.error("S3 sync connection failed:", result.error)
        return result.success
    }

    // S3 has no teams, the bucket location is the one "team"
    getTeams(): Promise<{ id: string; churchId: string; name: string }[]> {
        const { bucket, prefix } = this.client.config
        const location = prefix ? `${bucket}/${prefix}` : bucket
        return Promise.resolve([{ id: location, churchId: "s3", name: location }])
    }

    async existingData() {
        try {
            return !!(await this.client.headObject(this.client.getKey(CURRENT)))
        } catch (err) {
            this.handleError(err, "check")
            return false
        }
    }

    async getData(_churchId: string, _teamId: string, outputFolderPath: string, fileName = CURRENT): Promise<string | null> {
        const isCurrent = fileName === CURRENT
        const key = this.client.getKey(fileName)

        try {
            if (isCurrent) {
                const cachedPath = await this.getUnchangedCache(key)
                if (cachedPath) {
                    console.log("Cloud data unchanged, using local copy")
                    return cachedPath
                }
            }

            console.log("Downloading data...")
            const object = await this.client.getObject(key)
            if (!object) return null

            const filePath = join(outputFolderPath, fileName)
            await fs.promises.mkdir(outputFolderPath, { recursive: true })
            await fs.promises.writeFile(filePath, object.data)

            S3SyncManager.offlineAlerted = false
            if (isCurrent) await this.setCache(filePath, object.info.etag)
            return filePath
        } catch (err) {
            this.handleError(err, isCurrent ? "download" : "")
            return null
        }
    }

    async uploadData(_teamId: string, filePath: string, fileName = CURRENT): Promise<boolean> {
        try {
            const data = await fs.promises.readFile(filePath)

            console.log("Uploading data...")
            const etag = await this.client.putObject(this.client.getKey(fileName), data, ZIP_TYPE)

            S3SyncManager.offlineAlerted = false
            if (fileName === CURRENT) await this.setCache(filePath, etag)
            return true
        } catch (err) {
            this.handleError(err, fileName === CURRENT ? "upload" : "")
            return false
        }
    }

    // BACKUP

    async getBackup(churchId: string, teamId: string, outputFolderPath: string): Promise<string | null> {
        return await this.getData(churchId, teamId, outputFolderPath, PREVIOUS)
    }

    // 0 if no backup exists
    async getBackupModified(): Promise<number> {
        try {
            return (await this.client.headObject(this.client.getKey(PREVIOUS)))?.lastModified || 0
        } catch (err) {
            this.handleError(err, "")
            return 0
        }
    }

    async uploadBackup(teamId: string, filePath: string): Promise<boolean> {
        return await this.uploadData(teamId, filePath, PREVIOUS)
    }

    // CACHE

    // Keep a copy of the last current.zip downloaded/uploaded with its ETag, so it's only downloaded again when another device changed it.
    private getCachePaths() {
        const { endpoint, region, bucket, prefix } = this.client.config
        const id = crypto.createHash("sha1").update([endpoint, region, bucket, prefix].join("|")).digest("hex").slice(0, 16)
        const zip = join(app.getPath("userData"), "cloud-cache", `s3-${id}.zip`)
        return { zip, etag: zip + ".etag" }
    }

    private async getUnchangedCache(key: string): Promise<string | null> {
        const cache = this.getCachePaths()
        if (!fs.existsSync(cache.zip) || !fs.existsSync(cache.etag)) return null

        const info = await this.client.headObject(key)
        if (!info?.etag) return null

        const cachedEtag = (await fs.promises.readFile(cache.etag, "utf8")).trim()
        return cachedEtag === info.etag ? cache.zip : null
    }

    private async setCache(filePath: string, etag: string) {
        const cache = this.getCachePaths()

        try {
            await fs.promises.mkdir(dirname(cache.zip), { recursive: true })
            if (filePath !== cache.zip) await fs.promises.copyFile(filePath, cache.zip)
            if (etag) await fs.promises.writeFile(cache.etag, etag)
            else await fs.promises.rm(cache.etag, { force: true })
        } catch (err) {
            console.error("Could not update cloud cache:", err)
        }
    }

    // ERRORS

    private handleError(err: any, action: "check" | "download" | "upload" | "") {
        if (isOfflineError(err)) {
            if (S3SyncManager.offlineAlerted) return
            S3SyncManager.offlineAlerted = true
            sendToMain(ToMain.ALERT, "Offline: Data will not be synced to the cloud.")
            return
        }

        console.error("S3 sync error:", err)
        if (action === "download") sendToMain(ToMain.ALERT, "Failed to get data: " + getErrorMessage(err))
        else if (action === "upload") sendToMain(ToMain.ALERT, "Failed to upload data: " + getErrorMessage(err))
    }
}

let syncManager: S3SyncManager | null = null
export function getS3SyncManager() {
    if (syncManager) return syncManager

    const config = getS3Config()
    if (!config) return null

    syncManager = new S3SyncManager(config)
    return syncManager
}

function resetS3SyncManager() {
    syncManager = null
}
