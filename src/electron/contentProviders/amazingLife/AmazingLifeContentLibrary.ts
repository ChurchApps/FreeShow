import { httpsRequest } from "../../utils/requests"
import type { ContentFile, ContentLibraryCategory } from "../base/types"
import { AmazingLifeConnect } from "./AmazingLifeConnect"
import { AMAZING_LIFE_API_BASE } from "./types"

/**
 * Handles content library operations for AmazingLife (APlay).
 * Manages fetching modules, products, libraries, and media content.
 *
 * WARNING: This class should ONLY be accessed through AmazingLifeProvider.
 * Do not import or use this class directly in other parts of the application.
 * Use ContentProviderRegistry or AmazingLifeProvider instead.
 */
export class AmazingLifeContentLibrary {
    private static contentLibraryCache: ContentLibraryCategory[] | null = null

    /**
     * Clears the content library cache
     */
    public static clearCache(): void {
        this.contentLibraryCache = null
    }

    /**
     * Creates authorization headers for API requests
     */
    private static createAuthHeaders(accessToken: string): Record<string, string> {
        return {
            Authorization: `Bearer ${accessToken}`,
            accept: "application/json"
        }
    }

    /**
     * Fetches libraries for a specific product
     */
    private static fetchProductLibraries(productId: string, productTitle: string, productImage: string, headers: any): Promise<ContentLibraryCategory | null> {
        return new Promise((resolve) => {
            httpsRequest(AMAZING_LIFE_API_BASE, `/prod/curriculum/modules/products/${productId}/libraries`, "GET", headers, {}, (err, data) => {
                if (err) {
                    console.error(`Failed to fetch libraries for product ${productId}:`, err)
                    resolve(null)
                    return
                }

                const libraries = Array.isArray(data) ? data : data.data || data.libraries || []
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

    /**
     * Retrieves the content library hierarchy: Modules -> Products -> Libraries
     */
    public static async getContentLibrary(): Promise<ContentLibraryCategory[]> {
        // Return cached data if available
        if (this.contentLibraryCache) {
            console.log("Returning cached APlay content library")
            return this.contentLibraryCache
        }

        const accessToken = AmazingLifeConnect.getAccessToken()
        if (!accessToken) {
            console.error("Not authenticated with APlay")
            return []
        }

        return new Promise((resolve, reject) => {
            const headers = this.createAuthHeaders(accessToken)

            httpsRequest(AMAZING_LIFE_API_BASE, "/prod/curriculum/modules", "GET", headers, {}, async (err, data) => {
                if (err) {
                    console.error("Failed to fetch APlay modules:", err)
                    return reject(err)
                }

                console.log("APlay API response:", JSON.stringify(data, null, 2))
                try {
                    const allModules = data.data || []
                    const modules = allModules.filter((module: any) => !module.isLocked)

                    const modulePromises = modules.map(async (module: any) => {
                        const moduleCategory: ContentLibraryCategory = {
                            name: module.title,
                            thumbnail: module.image,
                            children: []
                        }

                        // Fetch libraries for each product in the module
                        if (module.products && Array.isArray(module.products)) {
                            const productPromises = module.products.map((product: any) => this.fetchProductLibraries(product.productId, product.title, product.image, headers))

                            const productResults = await Promise.all(productPromises)
                            moduleCategory.children = productResults.filter((p): p is ContentLibraryCategory => p !== null)
                        }

                        return moduleCategory
                    })

                    const categories = await Promise.all(modulePromises)

                    // Cache the results for future requests
                    this.contentLibraryCache = categories

                    resolve(categories)
                } catch (error) {
                    console.error("Failed to convert APlay content library:", error)
                    reject(error)
                }
            })
        })
    }

    /**
     * Checks if a single media item is licensed
     * Returns the pingback URL if licensed, null otherwise
     */
    public static async checkMediaLicense(mediaId: string): Promise<string | null> {
        const accessToken = AmazingLifeConnect.getAccessToken()
        if (!accessToken) {
            console.warn("Not authenticated with APlay, cannot check license")
            return null
        }

        return new Promise((resolve) => {
            const headers = this.createAuthHeaders(accessToken)
            const payload = { mediaIds: [mediaId] }

            httpsRequest(AMAZING_LIFE_API_BASE, "/prod/reports/media/license-check", "POST", headers, payload, (err, data) => {
                if (err) {
                    console.error(`[APlay] Failed to check license for media ${mediaId}:`, err)
                    return resolve(null)
                }

                try {
                    const licenseData = Array.isArray(data) ? data : data.data || []
                    const result = licenseData.find((item: any) => item.mediaId === mediaId)

                    if (result?.isLicensed) {
                        const pingbackUrl = `${AMAZING_LIFE_API_BASE}/prod/reports/media/${mediaId}/stream-count?source=aplay-pro`
                        resolve(pingbackUrl)
                    } else {
                        resolve(null)
                    }
                } catch (error) {
                    console.error(`[APlay] Failed to parse license check response:`, error)
                    resolve(null)
                }
            })
        })
    }

    /**
     * Retrieves media content for a specific library
     */
    public static async getContent(libraryId: string): Promise<ContentFile[]> {
        const accessToken = AmazingLifeConnect.getAccessToken()
        if (!accessToken) {
            console.error("Not authenticated with APlay")
            return []
        }

        return new Promise((resolve, reject) => {
            const headers = this.createAuthHeaders(accessToken)
            console.log(`Fetching media for library: ${libraryId}`)

            httpsRequest(AMAZING_LIFE_API_BASE, `/prod/creators/libraries/${libraryId}/media`, "GET", headers, {}, async (err, data) => {
                if (err) {
                    console.error(`Failed to fetch media for library ${libraryId}:`, err)
                    return reject(err)
                }

                try {
                    const mediaItems = data.data || []
                    console.log(`Found ${mediaItems.length} media items`)

                    const files: ContentFile[] = mediaItems
                        .map((item: any) => {
                            const mediaType = item.mediaType?.toLowerCase()

                            // Extract URL and thumbnail based on media type
                            let url = ""
                            let thumbnail = item.thumbnail?.src || ""

                            if (mediaType === "video" && item.video) {
                                url = item.video.muxPlaybackId ? `https://stream.mux.com/${item.video.muxPlaybackId}/capped-1080p.mp4` : item.video.muxStreamingUrl || ""
                                thumbnail = thumbnail || item.video.thumbnailUrl || ""
                            } else if (mediaType === "image" || item.image) {
                                url = item.image?.src || item.url || ""
                                thumbnail = thumbnail || item.image?.src || ""
                            } else {
                                url = item.url || item.src || ""
                                thumbnail = thumbnail || item.thumbnailUrl || ""
                            }

                            const isVideo = mediaType === "video" || url.includes(".m3u8") || url.toLowerCase().endsWith(".mp4") || url.toLowerCase().endsWith(".mov")

                            const file: ContentFile = {
                                url,
                                thumbnail,
                                fileSize: item.fileSize || 0,
                                type: isVideo ? "video" : "image",
                                name: item.title || item.name || item.fileName || "",
                                mediaId: item.mediaId || item.id
                            }

                            return file
                        })
                        .filter((file: ContentFile) => file.url)

                    resolve(files)
                } catch (error) {
                    console.error("Failed to convert APlay media:", error)
                    reject(error)
                }
            })
        })
    }
}
