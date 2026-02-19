import { httpsRequest } from "../../utils/requests"
import type { ContentFile, ContentLibraryCategory } from "../base/types"
import { CanvaConnect } from "./CanvaConnect"
import { CANVA_API_URL } from "./CanvaProvider"

const DEFAULT_SCOPE = "folder:read design:meta:read" as const

type FolderItem = {
    type: "folder" | "design" | "image"
    folder?: { id: string; name?: string; title?: string; thumbnail?: { url?: string } }
    design?: { id: string; title?: string; thumbnail?: { url?: string } }
    image?: { id: string; name?: string; thumbnail?: { url?: string } }
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

    public static async getContent(folderId: string): Promise<ContentFile[]> {
        const items = await this.listFolderItems(folderId, ["image", "design"])

        return items
            .map((item): ContentFile | null => {
                if (item.type === "image" && item.image?.thumbnail?.url) {
                    const url = item.image.thumbnail.url
                    return {
                        url,
                        thumbnail: url,
                        fileSize: 0,
                        type: "image",
                        name: item.image.name || "Canva Image",
                        mediaId: item.image.id
                    }
                }

                if (item.type === "design" && item.design?.thumbnail?.url) {
                    const url = item.design.thumbnail.url
                    return {
                        url,
                        thumbnail: url,
                        fileSize: 0,
                        type: "image",
                        name: item.design.title || "Canva Design",
                        mediaId: item.design.id
                    }
                }

                return null
            })
            .filter((file): file is ContentFile => !!file)
    }
}
