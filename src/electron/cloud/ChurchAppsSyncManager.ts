import axios from "axios"
import { join } from "path"
import { type ChurchAppsProvider, ContentProviderRegistry } from "../contentProviders"
import { httpsRequest } from "../utils/requests"

const HOSTNAME = "https://content.churchapps.org"
const SCOPE = "plans"
const ZIP_TYPE = "application/zip"

class ChurchAppsSyncManager {
    provider: ChurchAppsProvider

    constructor(provider: ChurchAppsProvider) {
        this.provider = provider
    }

    hasValidConnection() {
        return this.provider.isConnected(SCOPE)
    }

    async getTeams(): Promise<{ id: string; churchId: string; name: string }[]> {
        const response = await this.provider.apiRequest({ api: "membership", authenticated: true, scope: SCOPE, endpoint: "/groups/tag/team" })
        return response || []
    }

    async getData(churchId: string, teamId: string, outputFolderPath: string, fileName: string = "current.zip"): Promise<string | null> {
        const randomNumber = Math.floor(Math.random() * 1000000)
        const path = `/${churchId}/files/group/${teamId}/${fileName}?cacheBuster=${randomNumber}`
        console.log(path)

        return new Promise((resolve) => {
            httpsRequest(HOSTNAME, path, "GET", {}, {}, response, join(outputFolderPath, fileName))

            function response(err: Error | null, filePath?: string) {
                if (err) {
                    console.error("Failed to fetch ChurchApps content library:", err)
                    return resolve(null)
                }

                console.log("Downloaded data to:", filePath)
                return resolve(filePath || null)
            }
        })
    }

    async getWriteToken(teamId: string, fileName: string): Promise<any> {
        const path = `/files/postUrl`
        const params = { fileName, contentType: "group", contentId: teamId }
        // return await ApiHelper.post(path, params, "ContentApi");

        return new Promise((resolve) => {
            httpsRequest(HOSTNAME, path, "POST", params, {}, (err, data: Buffer) => {
                if (err) {
                    console.error("Failed to get ChurchApps token:", err)
                    return resolve(null)
                }

                console.log("Token data:", data)
                return resolve(data)
            })
        })
    }

    async uploadData(teamId: string, filePath: string, fileName: string = "current.zip"): Promise<boolean> {
        const presigned = await this.getWriteToken(fileName, teamId)
        if (!presigned?.url) return false

        const formData = new FormData()
        formData.append("acl", "public-read")
        formData.append("Content-Type", ZIP_TYPE)

        // Loop through all the presigned parameters returned and append them to this request
        for (const property in presigned.fields) formData.append(property, presigned.fields[property])

        formData.append("file", { uri: filePath, type: ZIP_TYPE, name: fileName } as any)
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
