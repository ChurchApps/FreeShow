import { httpsRequest } from "../../utils/requests"
import type { ContentFile, ContentLibraryCategory } from "../base/types"
import { CanvaConnect } from "./CanvaConnect"
import { CANVA_API_URL } from "./CanvaProvider"

const DEFAULT_SCOPE = "folder:read design:content:read design:meta:read" as const

type FolderItem = {
    type: "folder" | "design" | "image"
    folder?: { id: string; name?: string; title?: string; thumbnail?: { url?: string } }
    design?: { id: string; title?: string; url?: string; thumbnail?: { url?: string }; type?: string; page_count?: number }
    image?: { id: string; name?: string; url?: string; thumbnail?: { url?: string } }
}

type ListItemsResponse = {
    items?: FolderItem[]
    continuation?: string
}

export class CanvaContentLibrary {
    private static contentLibraryCache: ContentLibraryCategory[] | null = null

    public static clearCache(): void {
        this.contentLibraryCache = null
    }

    private static async request(path: string): Promise<any> {
        const accessToken = await CanvaConnect.ensureValidToken(DEFAULT_SCOPE)
        if (!accessToken) {
            return null
        }

        return new Promise((resolve, reject) => {
            const url = new URL(CANVA_API_URL + path)
            httpsRequest(
                url.hostname,
                url.pathname + (url.search ? url.search : ""),
                "GET",
                {
                    Authorization: `Bearer ${accessToken}`,
                    accept: "application/json"
                },
                {},
                (err, data) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve(data)
                }
            )
        })
    }

    private static async listFolderItems(folderId: string, itemTypes: string[] = ["folder", "image", "design"]): Promise<FolderItem[]> {
        let continuation = ""
        const allItems: FolderItem[] = []

        do {
            const continuationQuery = continuation ? `&continuation=${encodeURIComponent(continuation)}` : ""
            const path = `/v1/folders/${encodeURIComponent(folderId)}/items?limit=100&item_types=${itemTypes.join(",")}${continuationQuery}`
            const response = (await this.request(path)) as ListItemsResponse | null
            if (!response) break

            allItems.push(...(response.items || []))
            continuation = response.continuation || ""
        } while (continuation)

        return allItems
    }

    public static async getContentLibrary(): Promise<ContentLibraryCategory[]> {
        if (this.contentLibraryCache) {
            return this.contentLibraryCache
        }

        const rootChildren = await this.listFolderItems("root", ["folder"])
        const folders: ContentLibraryCategory[] = rootChildren
            .filter((item) => item.type === "folder" && item.folder?.id)
            .map((item) => ({
                name: item.folder?.name || item.folder?.title || "Folder",
                thumbnail: item.folder?.thumbnail?.url,
                key: item.folder!.id
            }))

        const categories: ContentLibraryCategory[] = [{ name: "All Assets", key: "root" }, ...folders]
        this.contentLibraryCache = categories

        return categories
    }

    /**
     * Returns content for a folder or a presentation (design).
     * If folderId starts with 'presentation:', treat as a presentation and fetch slides.
     */
    public static async getContent(folderId: string): Promise<ContentFile[]> {
        // If folderId is a presentation, fetch slides
        if (folderId.startsWith("presentation:")) {
            const designId = folderId.replace("presentation:", "")
            return await this.getPresentationSlides(designId)
        }

        // Otherwise, fetch normal folder content
        const items = await this.listFolderItems(folderId, ["image", "design"])

        // Always return files, but for presentations, add isPresentation and slideCount
        return items
            .map((item): ContentFile | null => {
                if (item.type === "image" && item.image) {
                    const url = item.image.url || item.image.thumbnail?.url
                    if (!url) return null
                    return {
                        url,
                        thumbnail: item.image.thumbnail?.url || url,
                        fileSize: 0,
                        type: "image",
                        name: item.image.name || "Canva Image",
                        mediaId: item.image.id
                    }
                }
                // Designs (including presentations)
                if (item.type === "design" && item.design) {
                    const url = item.design.url || item.design.thumbnail?.url
                    if (!url) return null
                    const isPresentation = item.design?.type === "presentation" || item.design?.title?.toLowerCase().includes("presentation") || (typeof item.design?.page_count === "number" && item.design.page_count > 1)
                    return {
                        url,
                        thumbnail: item.design.thumbnail?.url || url,
                        fileSize: 0,
                        type: "image",
                        name: item.design.title || "Canva Design",
                        mediaId: item.design.id,
                        // @ts-ignore
                        isPresentation,
                        // @ts-ignore
                        slideCount: item.design.page_count
                    }
                }
                return null
            })
            .filter((file): file is ContentFile => !!file)
    }

    /**
     * Fetches slides for a given presentation (design).
     * Returns each slide as a ContentFile (image).
     */
    private static async getPresentationSlides(designId: string): Promise<ContentFile[]> {
        // Canva API: /v1/designs/{design_id}/pages
        const path = `/v1/designs/${encodeURIComponent(designId)}/pages?limit=100`
        const response = await this.request(path)
        // Debug log the response to diagnose structure
        console.log("Canva getPresentationSlides response:", JSON.stringify(response, null, 2))
        if (!response || !Array.isArray(response.items)) return []

        // Each item (slide) should have a thumbnail or image URL
        return response.items
            .map((item: any, idx: number) => {
                const url = item.url || item.thumbnail?.url || null
                if (!url) return null
                return {
                    url,
                    thumbnail: item.thumbnail?.url || url,
                    fileSize: 0,
                    type: "image",
                    name: `Slide ${item.index ?? idx + 1}`,
                    mediaId: item.index?.toString() || (idx + 1).toString()
                }
            })
            .filter((file: ContentFile | null) => !!file)
    }

    // TODO: download full quality image
    /**
     * Requests a high-res PNG export for a specific slide (page) of a design.
     * Returns the download URL when ready.
     * @param designId Canva design ID
     * @param pageIndex 1-based index of the slide/page
     */
    public static async exportSlideAsPng(designId: string, pageIndex: number): Promise<string | null> {
        // 1. Request export
        const exportReqPath = `/v1/designs/${encodeURIComponent(designId)}/exports`
        const exportReqBody = {
            format: "png",
            page_indexes: [pageIndex] // 1-based
        }
        const accessToken = await CanvaConnect.ensureValidToken(DEFAULT_SCOPE)
        if (!accessToken) return null
        const url = new URL(CANVA_API_URL + exportReqPath)
        let exportResponse: any
        try {
            exportResponse = await new Promise((resolve, reject) => {
                httpsRequest(
                    url.hostname,
                    url.pathname + (url.search ? url.search : ""),
                    "POST",
                    {
                        Authorization: `Bearer ${accessToken}`,
                        accept: "application/json",
                        "content-type": "application/json"
                    },
                    exportReqBody,
                    (err, data) => {
                        if (err) reject(err)
                        else resolve(data)
                    }
                )
            })
        } catch (e) {
            console.error("Canva export request failed", e)
            return null
        }
        const exportId = exportResponse?.id
        if (!exportId) return null

        // 2. Poll for export completion
        let status = "pending"
        let downloadUrl: string | null = null
        for (let i = 0; i < 20; ++i) {
            // Poll up to 20 times (about 20s)
            await new Promise((res) => setTimeout(res, 1000))
            const pollPath = `/v1/designs/${encodeURIComponent(designId)}/exports/${encodeURIComponent(exportId)}`
            let pollResponse: any
            try {
                pollResponse = await this.request(pollPath)
            } catch (e) {
                continue
            }
            status = pollResponse?.status
            if (status === "completed" && Array.isArray(pollResponse.files) && pollResponse.files[0]?.url) {
                downloadUrl = pollResponse.files[0].url
                break
            }
            if (status === "failed") break
        }
        if (!downloadUrl) return null

        // 3. Save to local file system
        // WIP

        return downloadUrl
    }
}
