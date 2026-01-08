import axios from "axios"
import fs from "fs"
import { join } from "path"
import { ToMain } from "../../types/IPC/ToMain"
import { ChurchAppsProvider, ContentProviderRegistry } from "../contentProviders"
import { sendToMain } from "../IPC/main"
import { httpsRequest } from "../utils/requests"

const CONTENT_HOSTNAME = "https://content.churchapps.org"
const HOSTNAME = "https://api.churchapps.org"
const SCOPE = "plans"
const ZIP_TYPE = "application/zip"

class ChurchAppsSyncManager {
    provider: ChurchAppsProvider

    constructor(provider: ChurchAppsProvider) {
        this.provider = provider
    }

    async hasValidConnection() {
        await this.provider.connect(SCOPE)
        return this.provider.isConnected(SCOPE)
    }

    async getTeams(): Promise<{ id: string; churchId: string; name: string }[]> {
        const response = await this.provider.apiRequest({ api: "membership", authenticated: true, scope: SCOPE, endpoint: "/groups/tag/team" })
        return response || []
    }

    async existingData(churchId: string, teamId: string) {
        const headers = await this.getHeaders(churchId, teamId)
        this.isCloudNewer(headers) // update changedAt
        return !!headers
    }

    async hasChanged(churchId: string, teamId: string) {
        const headers = await this.getHeaders(churchId, teamId)
        return this.isCloudNewer(headers)
    }

    private changedAt = 0
    private isCloudNewer(headers: any): boolean {
        if (!headers) return false

        const remoteLastModified = new Date(headers["last-modified"]).getTime()
        const localLastModified = this.changedAt

        this.changedAt = remoteLastModified
        return remoteLastModified > localLastModified
    }

    // Simple HTTP GET to content S3 web server.  No auth needed.
    private async getHeaders(churchId: string, teamId: string, fileName: string = "current.zip"): Promise<any> {
        const path = `/${churchId}/files/group/${teamId}/${fileName}`

        return new Promise((resolve) => {
            httpsRequest(CONTENT_HOSTNAME, path, "HEAD", {}, {}, (err: any, data?: any) => {
                if (err) {
                    // not existing
                    if (err.statusCode === 404) return resolve(null)

                    console.error("Failed to get headers:", err)
                    return resolve(null)
                }
                console.log("Headers data:", data)
                return resolve(data)
            })
        })
    }

    // Fetch from S3 content server. No auth needed.
    async getData(churchId: string, teamId: string, outputFolderPath: string, fileName: string = "current.zip"): Promise<string | null> {
        const randomNumber = Math.floor(Math.random() * 1000000)
        const path = `/${churchId}/files/group/${teamId}/${fileName}?cacheBuster=${randomNumber}`
        console.log("Data", path)

        return new Promise((resolve) => {
            httpsRequest(CONTENT_HOSTNAME, path, "GET", {}, {}, response, join(outputFolderPath, fileName))

            function response(err: any, filePath?: string) {
                if (err) {
                    // not existing
                    if (err.statusCode === 404) return resolve(null)

                    //Quietly fail.  The file may not exist yet.
                    //console.error("Failed to fetch content:", err)
                    //sendToMain(ToMain.ALERT, "Failed to get data: " + err.message)
                    return resolve(null)
                }

                console.log("Downloaded data to:", filePath)
                return resolve(filePath || null)
            }
        })
    }

    async getWriteToken(teamId: string, fileName: string): Promise<any> {
        const path = `/content/files/postUrl`
        let params: { [key: string]: string } = { fileName, contentType: "group", contentId: teamId }
        console.log("Write", params)

        const token = await this.provider.getToken(SCOPE)
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        console.log("Headers:", headers)

        return new Promise((resolve) => {
            httpsRequest(HOSTNAME, path, "POST", headers, params, (err, data: Buffer) => {
                if (err) {
                    console.error("Failed to get token:", err)
                    sendToMain(ToMain.ALERT, "Failed to upload data: " + err.message)
                    return resolve(null)
                }

                console.log("Token data:", data)
                return resolve(data)
            })
        })
    }

    async uploadData(teamId: string, filePath: string, fileName: string = "current.zip"): Promise<boolean> {
        const presigned = await this.getWriteToken(teamId, fileName)
        if (!presigned?.url) return false

        const fileBuffer = fs.readFileSync(filePath)
        const blob = new Blob([fileBuffer], { type: ZIP_TYPE })

        const formData = new FormData()
        formData.append("acl", "public-read")
        formData.append("Content-Type", ZIP_TYPE)

        // Loop through all the presigned parameters returned and append them to this request
        for (const property in presigned.fields) formData.append(property, presigned.fields[property])

        formData.append("file", blob, fileName)
        await axios.post(presigned.url, formData, { headers: { "Content-Type": "multipart/form-data" } })

        return true
    }

    // BACKUP

    async getBackup(churchId: string, teamId: string, outputFolderPath: string): Promise<string | null> {
        return await this.getData(churchId, teamId, outputFolderPath, "previous.zip")
    }

    async uploadBackup(teamId: string, filePath: string): Promise<boolean> {
        return await this.uploadData(teamId, filePath, "previous.zip")
    }
}

let syncManager: ChurchAppsSyncManager | null = null
export function getChurchAppsSyncManager() {
    if (syncManager) return syncManager

    const provider = ContentProviderRegistry.getProvider<ChurchAppsProvider>("churchApps")
    if (!provider) return null

    syncManager = new ChurchAppsSyncManager(provider)
    return syncManager
}
