import { ContentProvider } from "../base/ContentProvider"
import { getKey } from "../../utils/keys"
import { ChumsConnect } from "./ChumsConnect"
import { ChumsImport } from "./ChumsImport"
import { ChumsExport } from "./ChumsExport"
import { httpsRequest } from "../../utils/requests"
import type { ContentLibraryCategory, ContentFile } from "../base/types"

// Import and re-export types
import type { ChumsScopes } from "./types"
export type { ChumsScopes } from "./types"

// Fix ChumsAuthData to not include null in the export
export interface ChumsAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: ChumsScopes
}

/**
 * Chums provider that acts as the sole interface to Chums functionality.
 *
 * This is the ONLY class that should import from ChumsConnect.ts, ChumsImport.ts, and ChumsExport.ts.
 * All external code should use this provider through ContentProviderRegistry.
 */
export class ChumsProvider extends ContentProvider<ChumsScopes, ChumsAuthData> {
    hasContentLibrary = true

    constructor() {
        super({
            name: "chums",
            displayName: "ChurchApps",
            port: 5502,
            clientId: getKey("chums_id") || "",
            clientSecret: getKey("chums_secret") || "",
            apiUrl: "https://api.churchapps.org",
            scopes: ["plans"] as const
        })
    }

    async connect(scope: ChumsScopes): Promise<ChumsAuthData | null> {
        const result = await ChumsConnect.connect(scope)
        this.access = result
        return result
    }

    disconnect(scope: ChumsScopes = "plans"): void {
        ChumsConnect.disconnect(scope)
        this.access = null
    }

    async apiRequest(data: any): Promise<any> {
        return ChumsConnect.apiRequest(data)
    }

    async loadServices(): Promise<void> {
        return ChumsImport.loadServices()
    }

    async startupLoad(scope: ChumsScopes, data?: any): Promise<void> {
        const connected = await this.connect(scope)
        if (!connected) return

        // Export songs to Chums if data provided
        if (data) {
            await ChumsExport.sendSongsToChums(data)
        }

        // Load services from Chums
        await ChumsImport.loadServices()
    }

    /**
     * Export data to Chums (e.g., songs)
     */
    async exportData(data: any): Promise<void> {
        return ChumsExport.sendSongsToChums(data)
    }

    /**
     * Retrieves the content library category tree from Chums
     */
    async getContentLibrary(): Promise<ContentLibraryCategory[]> {
        return new Promise((resolve, reject) => {
            httpsRequest("https://api.lessons.church", "/lessons/public/tree", "GET", {}, {}, (err, data) => {
                if (err) {
                    console.error("Failed to fetch Chums content library:", err)
                    return reject(err)
                }

                const convertToCategories = (programs: any[]): ContentLibraryCategory[] => {
                    return programs.map(program => ({
                        name: program.name,
                        thumbnail: program.image,
                        children: program.studies?.map((study: any) => ({
                            name: study.name,
                            thumbnail: study.image,
                            children: study.lessons?.map((lesson: any) => ({
                                name: lesson.name,
                                thumbnail: lesson.image,
                                children: lesson.venues?.map((venue: any) => ({
                                    name: venue.name,
                                    key: venue.id
                                }))
                            }))
                        }))
                    }))
                }

                try {
                    const categories = convertToCategories(data.programs || [])
                    resolve(categories)
                } catch (error) {
                    console.error("Failed to convert Chums content library:", error)
                    reject(error)
                }
            })
        })
    }

    /**
     * Retrieves content files for a given venue
     */
    async getContent(venueId: string): Promise<ContentFile[]> {
        return new Promise((resolve, reject) => {
            httpsRequest("https://api.lessons.church", `/venues/playlist/${venueId}`, "GET", {}, {}, (err, data) => {
                if (err) {
                    console.error("Failed to fetch Chums content:", err)
                    return reject(err)
                }

                try {
                    const files: ContentFile[] = []

                    data.messages?.forEach((message: any) => {
                        message.files?.forEach((file: any) => {
                            const url = file.url
                            const isVideo = url.endsWith('.mp4') || url.includes('/file.mp4')

                            files.push({
                                url,
                                thumbnail: file.thumbnail,
                                fileSize: 0,
                                type: isVideo ? "video" : "image",
                                name: file.name
                            })
                        })
                    })

                    resolve(files)
                } catch (error) {
                    console.error("Failed to convert Chums content:", error)
                    reject(error)
                }
            })
        })
    }

    protected handleAuthCallback(_req: any, _res: any): void {
        // Not used - ChumsConnect handles authentication internally
    }

    protected async refreshToken(_scope: ChumsScopes): Promise<ChumsAuthData | null> {
        // Not used - ChumsConnect handles token refresh internally
        return null
    }

    protected async authenticate(_scope: ChumsScopes): Promise<ChumsAuthData | null> {
        // Not used - ChumsConnect handles authentication internally
        return null
    }
}