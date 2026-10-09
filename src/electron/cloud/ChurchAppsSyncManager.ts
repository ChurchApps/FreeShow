import axios from "axios"
import crypto from "crypto"
import { app } from "electron"
import fs from "fs"
import { dirname, join } from "path"
import { ToMain } from "../../types/IPC/ToMain"
import type { ChurchAppsProvider } from "../contentProviders"
import { ContentProviderRegistry } from "../contentProviders"
import { sendToMain } from "../IPC/main"
import { httpsRequest } from "../utils/requests"
import { getContentProviderAccess } from "../data/contentProviders"

const CONTENT_HOSTNAME = "https://content.churchapps.org"
const HOSTNAME = "https://api.churchapps.org"
const SCOPE = "plans"
const ZIP_TYPE = "application/zip"

class ChurchAppsSyncManager {
    private static offlineAlerted = false
    provider: ChurchAppsProvider

    constructor(provider: ChurchAppsProvider) {
        this.provider = provider
    }

    async hasValidConnection() {
        if (!getContentProviderAccess("churchApps", SCOPE)) return false
        await this.provider.connect(SCOPE)
        return this.provider.isConnected(SCOPE)
    }

    async getTeams(): Promise<{ id: string; churchId: string; name: string }[]> {
        const response = await this.provider.apiRequest({ api: "membership", authenticated: true, scope: SCOPE, endpoint: "/groups/my/team" })
        return response || []
    }

    async existingData(churchId: string, teamId: string) {
        const headers = await this.getHeaders(churchId, teamId)
        return !!headers
    }

    // Simple HTTP HEAD to content S3 web server.  No auth needed.
    private async getHeaders(churchId: string, teamId: string, fileName = "current.zip"): Promise<any> {
        // cache buster so CloudFront never returns a stale ETag / Last-Modified
        const randomNumber = Math.floor(Math.random() * 1000000)
        const path = `/${churchId}/files/group/${teamId}/${fileName}?cacheBuster=${randomNumber}`
        console.log("Checking data...")

        return new Promise((resolve) => {
            httpsRequest(CONTENT_HOSTNAME, path, "HEAD", {}, {}, response, "", true)

            function response(err: any, data?: any) {
                if (err) {
                    // not existing
                    if (err.statusCode === 404 || err.statusCode === 403) return resolve(null)
                    console.error("Failed to get headers:", err)
                    return resolve(null)
                }

                return resolve(data)
            }
        })
    }

    // Fetch from S3 content server. No auth needed.
    private TWO_MINUTES = 2 * 60 * 1000
    async getData(churchId: string, teamId: string, outputFolderPath: string, fileName = "current.zip"): Promise<string | null> {
        const isCurrent = fileName === "current.zip"
        if (isCurrent) {
            const cachedPath = await this.getUnchangedCache(churchId, teamId)
            if (cachedPath) {
                console.log("Cloud data unchanged, using local copy")
                return cachedPath
            }
        }

        const randomNumber = Math.floor(Math.random() * 1000000)
        const path = `/${churchId}/files/group/${teamId}/${fileName}?cacheBuster=${randomNumber}`
        console.log("Downloading data...")

        const filePath = await new Promise<string | null>((resolve) => {
            httpsRequest(CONTENT_HOSTNAME, path, "GET", {}, {}, response, join(outputFolderPath, fileName), false, this.TWO_MINUTES)

            function response(err: any, filePath?: string) {
                if (err) {
                    // likely not existing yet
                    if (err.statusCode === 404 || err.statusCode === 403) return resolve(null)

                    // likely offline
                    if (err.code === "ENOTFOUND") {
                        ChurchAppsSyncManager.isOffline()
                        return resolve(null)
                    }

                    console.error("Failed to fetch content:", err)
                    if (fileName !== "current.zip") return resolve(null)

                    sendToMain(ToMain.ALERT, "Failed to get data: " + err.message)
                    return resolve(null)
                }

                // Reset offline alert state if successful
                ChurchAppsSyncManager.offlineAlerted = false
                return resolve(filePath || null)
            }
        })

        if (filePath && isCurrent) await this.setCache(teamId, filePath)
        return filePath
    }

    // CACHE

    // Keep a copy of the last current.zip downloaded/uploaded, so it's only downloaded again when another device changed it.
    // S3 ETag is the MD5 of the file for single-part uploads; anything else (multipart, KMS) never matches and falls back to a full download.
    private getCachePath(teamId: string) {
        return join(app.getPath("userData"), "cloud-cache", `${teamId}.zip`)
    }

    private async getUnchangedCache(churchId: string, teamId: string): Promise<string | null> {
        const cachePath = this.getCachePath(teamId)
        if (!fs.existsSync(cachePath)) return null

        const headers = await this.getHeaders(churchId, teamId)
        const etag = headers?.etag?.replace(/"/g, "")
        if (!etag) return null

        try {
            return etag === (await md5File(cachePath)) ? cachePath : null
        } catch (err) {
            console.error("Could not read cloud cache:", err)
            return null
        }
    }

    private async setCache(teamId: string, filePath: string) {
        const cachePath = this.getCachePath(teamId)
        if (filePath === cachePath) return

        try {
            await fs.promises.mkdir(dirname(cachePath), { recursive: true })
            await fs.promises.copyFile(filePath, cachePath)
        } catch (err) {
            console.error("Could not update cloud cache:", err)
        }
    }

    async getWriteToken(teamId: string, fileName: string): Promise<any> {
        const path = `/content/files/postUrl`
        const params: { [key: string]: string } = { fileName, contentType: "group", contentId: teamId, mimeType: ZIP_TYPE }

        const token = await this.provider.getToken(SCOPE)
        const headers = token ? { Authorization: `Bearer ${token}` } : {}

        return new Promise((resolve) => {
            httpsRequest(HOSTNAME, path, "POST", headers, params, (err, data: Buffer) => {
                if (err) {
                    console.error("Failed to get token:", err)
                    if (fileName !== "current.zip") return resolve(null)

                    // likely offline
                    if (err.code === "ENOTFOUND") {
                        ChurchAppsSyncManager.isOffline()
                        return resolve(null)
                    }

                    if (err.statusCode === 401) sendToMain(ToMain.ALERT, "Could not upload data. Make sure you are member of a team, then log out and back in.")
                    else sendToMain(ToMain.ALERT, "Failed to upload data: " + err.message)

                    return resolve(null)
                }

                // Reset offline alert state if successful
                ChurchAppsSyncManager.offlineAlerted = false
                return resolve(data)
            })
        })
    }

    private static isOffline() {
        if (ChurchAppsSyncManager.offlineAlerted) return
        ChurchAppsSyncManager.offlineAlerted = true
        sendToMain(ToMain.ALERT, "Offline: Data will not be synced to the cloud.")
    }

    async uploadData(teamId: string, filePath: string, fileName = "current.zip"): Promise<boolean> {
        try {
            const presigned = await this.getWriteToken(teamId, fileName)
            if (!presigned?.url) return false

            const fileBuffer = await fs.promises.readFile(filePath)
            const blob = new Blob([new Uint8Array(fileBuffer)], { type: ZIP_TYPE })

            const formData = new FormData()
            if (!presigned.fields?.["acl"]) formData.append("acl", "public-read")
            if (!presigned.fields?.["Content-Type"]) formData.append("Content-Type", ZIP_TYPE)

            // Loop through all the presigned parameters returned and append them to this request
            for (const property in presigned.fields) formData.append(property, presigned.fields[property])

            console.log("Uploading data...")
            formData.append("file", blob, fileName)
            await axios.post(presigned.url, formData, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 })

            if (fileName === "current.zip") await this.setCache(teamId, filePath)
            return true
        } catch (err) {
            console.error("Failed to upload data:", err)
            return false
        }
    }

    // BACKUP

    async getBackup(churchId: string, teamId: string, outputFolderPath: string): Promise<string | null> {
        return await this.getData(churchId, teamId, outputFolderPath, "previous.zip")
    }

    // 0 if no backup exists
    async getBackupModified(churchId: string, teamId: string): Promise<number> {
        const headers = await this.getHeaders(churchId, teamId, "previous.zip")
        return headers?.["last-modified"] ? new Date(headers["last-modified"]).getTime() : 0
    }

    async uploadBackup(teamId: string, filePath: string): Promise<boolean> {
        return await this.uploadData(teamId, filePath, "previous.zip")
    }
}

function md5File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("md5")
        fs.createReadStream(filePath)
            .on("data", (chunk) => hash.update(chunk))
            .on("end", () => resolve(hash.digest("hex")))
            .on("error", reject)
    })
}

let syncManager: ChurchAppsSyncManager | null = null
export function getChurchAppsSyncManager() {
    if (syncManager) return syncManager

    const provider = ContentProviderRegistry.getProvider<ChurchAppsProvider>("churchApps")
    if (!provider) return null

    syncManager = new ChurchAppsSyncManager(provider)
    return syncManager
}
