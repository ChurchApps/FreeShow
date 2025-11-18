import type express from "express"
import { ToMain } from "../../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { getKey } from "../../utils/keys"
import { httpsRequest } from "../../utils/requests"
import { ContentProvider } from "../base/ContentProvider"
import { OAuth2Helper } from "../base/OAuth2Helper"
import type { ContentFile, ContentLibraryCategory } from "../base/types"
import { AMAZING_LIFE_API_URL, AMAZING_LIFE_OAUTH_BASE } from "./types"

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
    private oauthHelper: OAuth2Helper<AmazingLifeAuthData>

    constructor() {
        const port = 5502
        const clientId = getKey("amazinglife_id") || ""
        const redirectUri = `http://localhost:${port}/auth/complete`

        super({
            providerId: "amazinglife",
            displayName: "APlay",
            port,
            clientId,
            clientSecret: "",
            apiUrl: AMAZING_LIFE_API_URL,
            scopes: ["openid profile email"] as const
        })

        this.oauthHelper = new OAuth2Helper<AmazingLifeAuthData>({
            clientId,
            clientSecret: "", // Not needed for PKCE flow
            authUrl: `${AMAZING_LIFE_OAUTH_BASE}/authorize`,
            tokenUrl: `${AMAZING_LIFE_OAUTH_BASE}/token`,
            redirectUri,
            scopes: ["openid", "profile", "email"],
            usePKCE: true,
            additionalParams: { state: "xyz" }
        })
    }

    async connect(scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        const storedAccess = getContentProviderAccess("amazinglife", scope) as AmazingLifeAuthData | null

        if (storedAccess) {
            console.info("APlay: Found stored credentials, using them")
            this.access = storedAccess

            if (this.isTokenExpired()) {
                console.info("APlay token expired, refreshing...")
                const refreshed = await this.refreshToken(scope)
                if (refreshed) {
                    this.access = refreshed
                    sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "amazinglife", success: true })
                    return refreshed
                }
            } else {
                console.info("APlay: Stored credentials are valid, reusing without login prompt")
                sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "amazinglife", success: true })
                return storedAccess
            }
        }

        console.info("APlay: No stored credentials found, starting OAuth flow...")
        const authData = await this.authenticate(scope)

        if (authData) {
            sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "amazinglife", success: true, isFirstConnection: true })
            return authData
        } else {
            sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "amazinglife", success: false })
            return null
        }
    }

    disconnect(scope: AmazingLifeScopes = "openid profile email"): void {
        console.log(`APlay: Disconnecting with scope: ${scope}`)
        console.log(`APlay: Clearing stored credentials for scope: ${scope}`)
        setContentProviderAccess("amazinglife", scope, null)
        this.access = null
        AmazingLifeProvider.contentLibraryCache = null
        console.log("APlay: Disconnect complete - credentials cleared")
    }

    async apiRequest(data: any): Promise<any> {
        console.log(data)
        return null
    }

    async loadServices(dataPath?: string): Promise<void> {
        const connected = await this.connect("openid profile email")
        if (!connected) {
            console.error("Failed to connect to APlay")
            return
        }

        console.log(`Loading services from APlay${dataPath ? ` at ${dataPath}` : ""}`)
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
            console.log("Returning cached APlay content library")
            return AmazingLifeProvider.contentLibraryCache
        }
        if (!this.access) {
            console.error("Not authenticated with APlay")
            return []
        }

        const accessToken = this.access.access_token

        return new Promise((resolve, reject) => {
            const headers = { "Authorization": `Bearer ${accessToken}`, "accept": "application/json" }

            // First, fetch the modules
            httpsRequest("https://api-prod.amazingkids.app", "/prod/curriculum/modules", "GET", headers, {}, async (err, data) => {
                if (err) {
                    console.error("Failed to fetch APlay modules:", err)
                    return reject(err)
                }

                console.log("APlay API response:", JSON.stringify(data, null, 2))
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
                    console.error("Failed to convert APlay content library:", error)
                    reject(error)
                }
            })
        })
    }

    async getContent(libraryId: string): Promise<ContentFile[]> {
        if (!this.access) {
            console.error("Not authenticated with APlay")
            return []
        }

        const accessToken = this.access.access_token

        return new Promise((resolve, reject) => {
            const headers = { "Authorization": `Bearer ${accessToken}`, "accept": "application/json" }

            console.log(`Fetching media for library: ${libraryId}`)

            httpsRequest("https://api-prod.amazingkids.app", `/prod/creators/libraries/${libraryId}/media`, "GET", headers, {}, async (err, data) => {
                if (err) {
                    console.error(`Failed to fetch media for library ${libraryId}:`, err)
                    return reject(err)
                }

                try {
                    const mediaItems = data.data || []
                    console.log(`Found ${mediaItems.length} media items`)

                    // Step 1: Map media items to files and collect video/audio mediaIds
                    const videoAudioMediaIds: string[] = []
                    const mediaIdToItemMap = new Map<string, any>()

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
                        const isAudio = item.mediaType?.toLowerCase() === 'audio'

                        const file: ContentFile = {
                            url,
                            thumbnail,
                            fileSize: item.fileSize || 0,
                            type: isVideo ? "video" : "image",
                            name: item.title || item.name || item.fileName || "",
                            mediaId: item.mediaId || item.id
                        }

                        // Collect video/audio mediaIds for license check
                        if ((isVideo || isAudio) && file.mediaId) {
                            videoAudioMediaIds.push(file.mediaId)
                            mediaIdToItemMap.set(file.mediaId, file)
                        }

                        return file
                    }).filter((file: ContentFile) => file.url) // Only include items with valid URLs

                    // Step 2: Check licenses for video/audio files
                    if (videoAudioMediaIds.length > 0) {
                        try {
                            const licenseCheckResult = await this.checkMediaLicenses(videoAudioMediaIds, accessToken)

                            // Step 3: Set pingbackUrl for licensed media
                            licenseCheckResult.forEach(({ mediaId, isLicensed }) => {
                                if (isLicensed) {
                                    const file = mediaIdToItemMap.get(mediaId)
                                    if (file) file.pingbackUrl = `https://api-prod.amazingkids.app/prod/reports/media/${mediaId}/stream-count?source=aplay-pro`
                                }
                            })
                        } catch (licenseError) {
                            console.error("Failed to check media licenses:", licenseError)
                            // Continue without license info - don't fail the entire request
                        }
                    }

                    resolve(files)
                } catch (error) {
                    console.error("Failed to convert APlay media:", error)
                    reject(error)
                }
            }
            )
        })
    }

    private async checkMediaLicenses(mediaIds: string[], accessToken: string): Promise<Array<{ mediaId: string; isLicensed: boolean }>> {
        return new Promise((resolve, reject) => {
            const headers = {
                "Authorization": `Bearer ${accessToken}`,
                "accept": "application/json",
                "Content-Type": "application/json"
            }
            const payload = { mediaIds }

            console.log(`Checking licenses for ${mediaIds.length} media items`)

            httpsRequest("https://api-prod.amazingkids.app", "/prod/reports/media/license-check", "POST", headers, payload, (err, data) => {
                if (err) {
                    console.error("Failed to check media licenses:", err)
                    return reject(err)
                }

                try {
                    // Expected response: array of { mediaId: string, isLicensed: boolean }
                    const licenseData = Array.isArray(data) ? data : (data.data || [])
                    console.log(`License check returned ${licenseData.length} results`)
                    resolve(licenseData)
                } catch (error) {
                    console.error("Failed to parse license check response:", error)
                    reject(error)
                }
            })
        })
    }

    protected handleAuthCallback(req: express.Request, res: express.Response): void {
        this.oauthHelper.handleCallback(req, res)
    }

    protected async refreshToken(scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        if (!this.access?.refresh_token) {
            console.warn("No refresh token available for APlay")
            return null
        }

        try {
            const refreshed = await this.oauthHelper.refreshAccessToken(this.access.refresh_token, scope)
            if (refreshed) {
                this.access = refreshed
                setContentProviderAccess("amazinglife", scope, refreshed)
            }
            return refreshed
        } catch (error) {
            console.error("Failed to refresh APlay token:", error)
            return null
        }
    }

    protected async authenticate(scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        const server = this.app.listen(this.config.port, () => {
            console.info(`Listening for APlay OAuth response at port ${this.config.port}`)
        })

        server.once("error", (err: Error) => {
            if ((err as any).code === "EADDRINUSE") server.close()
        })

        try {
            const authData = await this.oauthHelper.authorize(scope)
            if (authData) {
                this.access = authData
                setContentProviderAccess("amazinglife", scope, authData)
            }
            server.close()
            return authData
        } catch (error) {
            console.error("APlay authentication failed:", error)
            server.close()
            return null
        }
    }
}
