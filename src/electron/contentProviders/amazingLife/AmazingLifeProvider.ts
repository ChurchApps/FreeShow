import { ContentProvider } from "../base/ContentProvider"
import { getKey } from "../../utils/keys"
import { httpsRequest } from "../../utils/requests"
import { sendToMain } from "../../IPC/main"
import { ToMain } from "../../../types/IPC/ToMain"
import { AMAZING_LIFE_API_URL } from "./types"
import type { ContentLibraryCategory, ContentFile } from "../base/types"

// Import and re-export types
import type { AmazingLifeScopes } from "./types"
export type { AmazingLifeScopes } from "./types"

export interface AmazingLifeAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: AmazingLifeScopes
}

export class AmazingLifeProvider extends ContentProvider<AmazingLifeScopes, AmazingLifeAuthData> {
    hasContentLibrary = true
    private static contentLibraryCache: ContentLibraryCategory[] | null = null

    constructor() {
        super({
            providerId: "amazinglife",
            displayName: "Amazing Life",
            port: 5503,
            clientId: getKey("amazinglife_id") || "",
            clientSecret: getKey("amazinglife_secret") || "",
            apiUrl: AMAZING_LIFE_API_URL,
            scopes: ["services"] as const
        })
    }

    async connect(scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        // If already connected, just notify and return existing access
        if (this.access) {
            sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "amazinglife", success: true })
            return this.access
        }

        const manualToken = "redacted"
        this.access = {
            access_token: manualToken,
            refresh_token: "",
            token_type: "Bearer",
            created_at: Date.now(),
            expires_in: 7775000,
            scope: scope
        }

        sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "amazinglife", success: true, isFirstConnection: true })
        return this.access
    }

    disconnect(scope: AmazingLifeScopes = "services"): void {
        console.log(`Disconnecting from Amazing Life with scope: ${scope}`)
        this.access = null
        AmazingLifeProvider.contentLibraryCache = null
    }

    async apiRequest(data: any): Promise<any> {
        console.log(data);
        return null
    }

    async loadServices(dataPath?: string): Promise<void> {
        // Connect first to ensure we have authentication
        const connected = await this.connect("services")
        if (!connected) {
            console.error("Failed to connect to Amazing Life")
            return
        }

        console.log(`Loading services from Amazing Life${dataPath ? ` at ${dataPath}` : ""}`)
    }

    async startupLoad(scope: AmazingLifeScopes, data?: any): Promise<void> {
        const connected = await this.connect(scope)
        if (!connected) return

        await this.loadServices(data?.dataPath)
    }

    private fetchProductLibraries(productId: string, productTitle: string, productImage: string, headers: any): Promise<ContentLibraryCategory | null> {
        return new Promise((resolve) => {
            httpsRequest("https://api-prod.amazingkids.app", `/prod/curriculum/modules/products/${productId}/libraries`, "GET", headers, {}, (err, data) => {
                if (err) {
                    console.error(`Failed to fetch libraries for product ${productId}:`, err)
                    resolve(null)
                    return
                }

                const libraries = Array.isArray(data) ? data : (data.data || data.libraries || [])
                const productCategory: ContentLibraryCategory = {
                    name: productTitle,
                    thumbnail: productImage,
                    children: libraries.map((library: any) => ({
                        name: library.title || library.name,
                        thumbnail: library.image,
                        key: library.libraryId || library.id
                    }))
                }

                resolve(productCategory)
            })
        })
    }

    // Modules -> Products -> Libraries
    async getContentLibrary(): Promise<ContentLibraryCategory[]> {
        // Return cached data if available
        if (AmazingLifeProvider.contentLibraryCache) {
            console.log("Returning cached Amazing Life content library")
            return AmazingLifeProvider.contentLibraryCache
        }
        if (!this.access) {
            console.error("Not authenticated with Amazing Life")
            return []
        }

        const accessToken = this.access.access_token

        return new Promise((resolve, reject) => {
            const headers = { "Authorization": `Bearer ${accessToken}`, "accept": "application/json" }

            // First, fetch the modules
            httpsRequest("https://api-prod.amazingkids.app", "/prod/curriculum/modules", "GET", headers, {}, async (err, data) => {
                if (err) {
                    console.error("Failed to fetch Amazing Life modules:", err)
                    return reject(err)
                }

                console.log("Amazing Life API response:", JSON.stringify(data, null, 2))
                try {
                    const modules = data.data || []
                    console.log(`Found ${modules.length} modules`)

                    const modulePromises = modules.map(async (module: any) => {
                        const moduleCategory: ContentLibraryCategory = {
                            name: module.title,
                            thumbnail: module.image,
                            children: []
                        }

                        // Fetch libraries for each product in the module
                        if (module.products && Array.isArray(module.products)) {
                            const productPromises = module.products.map((product: any) =>
                                this.fetchProductLibraries(product.productId, product.title, product.image, headers)
                            )

                            const productResults = await Promise.all(productPromises)
                            moduleCategory.children = productResults.filter((p): p is ContentLibraryCategory => p !== null)
                        }

                        return moduleCategory
                    })

                    const categories = await Promise.all(modulePromises)

                    // Cache the results for future requests
                    AmazingLifeProvider.contentLibraryCache = categories

                    resolve(categories)
                } catch (error) {
                    console.error("Failed to convert Amazing Life content library:", error)
                    reject(error)
                }
            })
        })
    }

    async getContent(libraryId: string): Promise<ContentFile[]> {
        if (!this.access) {
            console.error("Not authenticated with Amazing Life")
            return []
        }

        const accessToken = this.access.access_token

        return new Promise((resolve, reject) => {
            const headers = { "Authorization": `Bearer ${accessToken}`, "accept": "application/json" }

            console.log(`Fetching media for library: ${libraryId}`)

            httpsRequest("https://api-prod.amazingkids.app", `/prod/creators/libraries/${libraryId}/media`, "GET", headers, {}, (err, data) => {
                if (err) {
                    console.error(`Failed to fetch media for library ${libraryId}:`, err)
                    return reject(err)
                }

                try {
                    const mediaItems = data.data || []
                    console.log(`Found ${mediaItems.length} media items`)

                    const files: ContentFile[] = mediaItems.map((item: any) => {
                        // Extract URL based on media type
                        let url = ""
                        let thumbnail = ""

                        if (item.mediaType?.toLowerCase() === 'video' && item.video) {
                            // Use MP4 download URL instead of .m3u8 streaming URL
                            if (item.video.muxPlaybackId) url = `https://stream.mux.com/${item.video.muxPlaybackId}/capped-1080p.mp4`
                            else url = item.video.muxStreamingUrl || ""
                            thumbnail = item.video.thumbnailUrl || item.thumbnail?.src || ""
                        } else if (item.mediaType?.toLowerCase() === 'image' || item.image) {
                            url = item.image?.src || item.url || ""
                            thumbnail = item.thumbnail?.src || item.image?.src || ""
                        } else {
                            // Fallback for other formats
                            url = item.url || item.src || ""
                            thumbnail = item.thumbnail?.src || item.thumbnailUrl || ""
                        }

                        if (item.thumbnail?.src) thumbnail = item.thumbnail.src

                        const isVideo = item.mediaType?.toLowerCase() === 'video' || url.includes('.m3u8') || url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.mov')

                        const file: ContentFile = {
                            url: url,
                            thumbnail: thumbnail,
                            fileSize: item.fileSize || 0,
                            type: isVideo ? "video" : "image",
                            name: item.title || item.name || item.fileName || ""
                        }

                        if (item.isLicensed) file.decryptionKey = "123456789"

                        return file
                    }).filter((file: ContentFile) => file.url) // Only include items with valid URLs

                    resolve(files)
                } catch (error) {
                    console.error("Failed to convert Amazing Life media:", error)
                    reject(error)
                }
            }
            )
        })
    }

    protected handleAuthCallback(_req: any, _res: any): void {
    }

    protected async refreshToken(_scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        return null
    }

    protected async authenticate(_scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        return null
    }
}
