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
    public static urlToContentIdMap: Record<string, string> = {}

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

    private static async post(path: string, body: any): Promise<any> {
        const accessToken = await CanvaConnect.ensureValidToken(DEFAULT_SCOPE)
        if (!accessToken) {
            return null
        }

        return new Promise((resolve, reject) => {
            const url = new URL(CANVA_API_URL + path)
            httpsRequest(
                url.hostname,
                url.pathname + (url.search ? url.search : ""),
                "POST",
                {
                    Authorization: `Bearer ${accessToken}`,
                    accept: "application/json",
                    "content-type": "application/json"
                },
                body,
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
        if (folderId.startsWith("presentation-export:")) {
            const match = folderId.match(/^presentation-export:(.*):(\d+)$/)
            const designId = match?.[1] || ""
            const page = Number(match?.[2] || 0)
            if (!designId || !page) return []
            return await this.getPresentationSlides(designId, true, [page])
        }

        // If folderId is a presentation, fetch slides
        if (folderId.startsWith("presentation:")) {
            const designId = folderId.replace("presentation:", "")
            return await this.getPresentationSlides(designId, false)
        }

        // Otherwise, fetch normal folder content
        const items = await this.listFolderItems(folderId, ["image", "design"])

        // Always return files, but for presentations, add isPresentation and slideCount
        const files = items
            .map((item): ContentFile | null => {
                if (item.type === "image" && item.image) {
                    const url = item.image.url || item.image.thumbnail?.url
                    if (!url) return null

                    if (url && item.image.id) {
                        this.urlToContentIdMap[url] = item.image.id
                    }

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

                    if (url && item.design.id) {
                        this.urlToContentIdMap[url] = item.design.id
                    }

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

        return files
    }

    /**
     * Fetches slides for a given presentation (design).
     * Returns each slide as a ContentFile (image).
     */
    private static async getPresentationSlides(designId: string, exportFullQuality = true, pages?: number[]): Promise<ContentFile[]> {
        // Canva API: /v1/designs/{design_id}/pages
        const path = `/v1/designs/${encodeURIComponent(designId)}/pages?limit=100`
        const response = await this.request(path)
        if (!response || !Array.isArray(response.items)) return []

        const pageItems = pages?.length ? pages.map((page) => response.items[page - 1]).filter(Boolean) : response.items
        const exportedUrls = exportFullQuality ? await this.exportDesignAsPngs(designId, pages || response.items.map((_item: any, idx: number) => idx + 1)) : []

        // Use full-quality export URLs when available. Page URLs are thumbnails and only used as fallback.
        return pageItems
            .map((item: any, idx: number) => {
                const pageIndex = pages?.[idx] || idx + 1
                const fallbackUrl = item.url || item.thumbnail?.url || null
                const url = exportedUrls[idx] || fallbackUrl
                if (!url) return null
                return {
                    url,
                    thumbnail: item.thumbnail?.url || fallbackUrl || url,
                    fileSize: 0,
                    type: "image",
                    name: `Slide ${item.index ?? pageIndex}`,
                    mediaId: item.index?.toString() || pageIndex.toString()
                }
            })
            .filter((file: ContentFile | null) => !!file)
    }

    /**
     * Requests high-quality PNG exports for one or more pages of a design.
     * @param designIdOrUrl Canva design ID or URL
     * @param pages 1-based page indexes. If omitted, Canva exports all pages.
     */
    public static async exportDesignAsPngs(designIdOrUrl: string, pages?: number[]): Promise<string[]> {
        let designId = designIdOrUrl
        if (designIdOrUrl.startsWith("http://") || designIdOrUrl.startsWith("https://")) {
            designId = this.urlToContentIdMap[designIdOrUrl]
            if (!designId) return []
        }

        const exportBody: any = {
            design_id: designId,
            format: {
                type: "png",
                lossless: true,
                as_single_image: false
            }
        }
        if (pages?.length) exportBody.format.pages = pages

        const exportResponse = await this.post("/v1/exports", exportBody).catch(() => null)
        const jobId = exportResponse?.job?.id
        if (!jobId) return []

        let urls: string[] = []
        for (let i = 0; i < 60; ++i) {
            await new Promise((res) => setTimeout(res, 1000))

            const pollPath = `/v1/exports/${encodeURIComponent(jobId)}`
            let pollResponse: any = null
            try {
                pollResponse = await this.request(pollPath)
            } catch (e) {
                continue
            }

            const job = pollResponse?.job || {}

            if (job.status === "success" && Array.isArray(job.urls)) {
                urls = job.urls
                break
            }

            if (job.status === "failed") break
        }

        return urls
    }

    public static async exportDesignAsPng(designIdOrUrl: string, pageIndex: number): Promise<string | null> {
        return (await this.exportDesignAsPngs(designIdOrUrl, [pageIndex]))[0] || null
    }
}
