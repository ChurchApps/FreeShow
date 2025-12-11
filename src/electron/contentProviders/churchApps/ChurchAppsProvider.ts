import { ContentProvider } from "../base/ContentProvider"
import { getKey } from "../../utils/keys"
import { ChurchAppsConnect } from "./ChurchAppsConnect"
import { ChurchAppsImport } from "./ChurchAppsImport"
import { ChurchAppsExport } from "./ChurchAppsExport"
import { httpsRequest } from "../../utils/requests"
import type { ContentLibraryCategory, ContentFile } from "../base/types"

// Import and re-export types
import type { ChurchAppsScopes } from "./types"
export type { ChurchAppsScopes } from "./types"

// Fix ChurchAppsAuthData to not include null in the export
export interface ChurchAppsAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: ChurchAppsScopes
}

/**
 * ChurchApps provider that acts as the sole interface to ChurchApps functionality.
 *
 * This is the ONLY class that should import from ChurchAppsConnect.ts, ChurchAppsImport.ts, and ChurchAppsExport.ts.
 * All external code should use this provider through ContentProviderRegistry.
 */
export class ChurchAppsProvider extends ContentProvider<ChurchAppsScopes, ChurchAppsAuthData> {
    hasContentLibrary = true

    constructor() {
        super({
            providerId: "churchApps",
            displayName: "ChurchApps",
            port: 5502,
            clientId: getKey("churchApps_id") || "",
            clientSecret: getKey("churchApps_secret") || "",
            apiUrl: "https://api.churchapps.org",
            scopes: ["plans"] as const
        })
    }

    async connect(scope: ChurchAppsScopes): Promise<ChurchAppsAuthData | null> {
        const result = await ChurchAppsConnect.connect(scope)
        this.access = result
        return result
    }

    disconnect(scope: ChurchAppsScopes = "plans"): void {
        ChurchAppsConnect.disconnect(scope)
        this.access = null
    }

    async apiRequest(data: any): Promise<any> {
        return ChurchAppsConnect.apiRequest(data)
    }

    async loadServices(): Promise<void> {
        return ChurchAppsImport.loadServices()
    }

    async startupLoad(scope: ChurchAppsScopes, data?: any): Promise<void> {
        const connected = await this.connect(scope)
        if (!connected) return

        // Export songs to ChurchApps if data provided
        if (data) {
            await ChurchAppsExport.sendSongsToChurchApps(data)
        }

        // Load services from ChurchApps
        await ChurchAppsImport.loadServices()
    }

    /**
     * Export data to ChurchApps (e.g., songs)
     */
    async exportData(data: any): Promise<void> {
        return ChurchAppsExport.sendSongsToChurchApps(data)
    }

    /**
     * Retrieves the content library category tree from ChurchApps
     */
    async getContentLibrary(): Promise<ContentLibraryCategory[]> {
        return new Promise((resolve, reject) => {
            httpsRequest("https://api.lessons.church", "/lessons/public/tree", "GET", {}, {}, (err, data) => {
                if (err) {
                    console.error("Failed to fetch ChurchApps content library:", err)
                    return reject(err)
                }

                const convertToCategories = (programs: any[]): ContentLibraryCategory[] => {
                    return programs.map((program) => ({
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
                    console.error("Failed to convert ChurchApps content library:", error)
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
                    console.error("Failed to fetch ChurchApps content:", err)
                    return reject(err)
                }

                try {
                    const files: ContentFile[] = []
                    const seenUrls = new Set<string>()

                    data.messages?.forEach((message: any) => {
                        message.files?.forEach((file: any) => {
                            const url = file.url

                            // Skip duplicates
                            if (seenUrls.has(url)) return
                            seenUrls.add(url)

                            const isVideo = url.endsWith(".mp4") || url.includes("/file.mp4")

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
                    console.error("Failed to convert ChurchApps content:", error)
                    reject(error)
                }
            })
        })
    }

    protected handleAuthCallback(_req: any, _res: any): void {
        // Not used - ChurchAppsConnect handles authentication internally
    }

    protected async refreshToken(_scope: ChurchAppsScopes): Promise<ChurchAppsAuthData | null> {
        // Not used - ChurchAppsConnect handles token refresh internally
        return null
    }

    protected async authenticate(_scope: ChurchAppsScopes): Promise<ChurchAppsAuthData | null> {
        // Not used - ChurchAppsConnect handles authentication internally
        return null
    }
}
