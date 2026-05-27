import { get } from "svelte/store"
import { shows } from "../../stores"
import { getFileName, removeExtension } from "./media"
import { loadShows } from "./setShow"

export interface ProjectProgressItem {
    name: string
    index: number
    type: string
    metadata: Record<string, any>
}

function isOutputMatch(projectItem: any, outData: any) {
    const type = projectItem?.type || "show"
    const projectId = projectItem?.id
    if (!projectId) return false

    const outSlide = outData?.slide || null
    const outBackground = outData?.background || null
    const outOverlays: string[] = Array.isArray(outData?.overlays) ? outData.overlays : []

    if (type === "overlay") return outOverlays.includes(projectId)

    if (type === "show") {
        if (outSlide?.id !== projectId) return false
        if (projectItem?.layout && outSlide?.layout) return projectItem.layout === outSlide.layout
        return true
    }

    if (type === "pdf") return outSlide?.id === projectId

    if (type === "image" || type === "video" || type === "player") return outBackground?.path === projectId || outBackground?.id === projectId

    return false
}

export function getProjectItems(projectItems: any[], showsStore: Record<string, any>): ProjectProgressItem[] {
    return (projectItems || []).map((projectItem, index) => {
        const type = projectItem?.type || "show"
        if (type === "show" && !showsStore?.[projectItem.id]) loadShows([projectItem.id])
        const show = type === "show" ? showsStore?.[projectItem.id] || get(shows)[projectItem.id] : null

        let name = projectItem?.name || ""
        if (type === "show") name = show?.name || name
        if (!name && projectItem?.id) name = removeExtension(getFileName(projectItem.id))

        const metadata = type === "show" ? { ...(show?.meta || {}), ...(show?.quickAccess?.metadata || {}) } : {}

        return { name: name || "—", index, type, metadata }
    })
}

export function getProjectItemLabel(projectItem: ProjectProgressItem, metadataKey = "name") {
    if (!projectItem) return ""
    if (metadataKey === "name") return projectItem.name || "—"
    if (projectItem.type !== "show") return ""

    const value = projectItem.metadata?.[metadataKey]
    if (value === null || value === undefined) return ""
    return String(value)
}

export function getCurrentProjectIndexes(projectItems: any[], outData: any, fallbackIndex = -1): number[] {
    if (!projectItems?.length) return []

    const indexes = projectItems.reduce((acc: number[], projectItem: any, index: number) => {
        if (isOutputMatch(projectItem, outData)) acc.push(index)
        return acc
    }, [])

    if (indexes.length) return indexes
    if (fallbackIndex >= 0 && projectItems[fallbackIndex]) return [fallbackIndex]
    return []
}
