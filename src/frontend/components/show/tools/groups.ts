import { get } from "svelte/store"
import type { Show, Slide } from "../../../../types/Show"
import { cachedShowsData, groups, refreshEditSlide, showsCache } from "../../../stores"
import { clone, sortByName } from "../../helpers/array"
import { history } from "../../helpers/history"
import { getShowCacheId } from "../../helpers/show"
import { translateText } from "../../../utils/language"

export function getSlideGroups(showId: string, showUpdater = get(showsCache), cachedUpdater = get(cachedShowsData)) {
    return sortByName(cachedUpdater[getShowCacheId(showId, showUpdater[showId])]?.groups || [], "group") as any
}

export function getGlobalGroupName(groupId: string) {
    const group = get(groups)[groupId]
    if (!group) return ""
    if (group.default) return translateText("groups." + group.name)
    return group.name || "—"
}

// DUPLICATED GROUPS HANDLING

export interface DuplicateGroupSet {
    primaryId: string
    duplicateIds: string[]
}

function getSlideContent(slide: Slide | undefined) {
    if (!slide) return null
    return {
        notes: slide.notes?.trim() || "",
        settings: slide.settings || {},
        timeline: slide.timeline || null,
        items: (slide.items || []).map((item) => {
            const lines = item.lines?.map((line) => ({
                align: line.align,
                text: line.text?.map((t) => ({ ...t, value: t.value?.trim() || "" })),
                chords: line.chords?.map(({ pos, key }) => ({ pos, key }))
            }))
            const { id: _, ...rest } = item
            return { ...rest, lines }
        })
    }
}

export function getDuplicateGroups(slides: { [key: string]: Slide } = {}, showGroups: { id: string }[] = []): DuplicateGroupSet[] {
    const map = new Map<string, string[]>()

    showGroups.forEach(({ id }) => {
        const parent = slides[id]
        if (!parent || parent.group === ".") return

        const allSlides = [parent, ...(parent.children || []).map((cId) => slides[cId])].map(getSlideContent)
        const key = JSON.stringify(allSlides)

        map.set(key, [...(map.get(key) || []), id])
    })

    return Array.from(map.values())
        .filter((ids) => ids.length > 1)
        .map(([primaryId, ...duplicateIds]) => ({ primaryId, duplicateIds }))
}

export function mergeDuplicateGroups(showId: string, duplicateSets: DuplicateGroupSet[]) {
    const currentShow: Show = get(showsCache)[showId]
    if (!currentShow || !duplicateSets?.length) return

    const newShow: Show = clone(currentShow)
    const idMap: Record<string, string> = {}
    const deletedIds: string[] = []

    duplicateSets.forEach(({ primaryId, duplicateIds }) => {
        const primaryChildren = newShow.slides[primaryId]?.children || []

        duplicateIds.forEach((dupId) => {
            idMap[dupId] = primaryId
            deletedIds.push(dupId)

            const dupChildren = newShow.slides[dupId]?.children || []
            dupChildren.forEach((childId, i) => {
                if (primaryChildren[i]) idMap[childId] = primaryChildren[i]
                deletedIds.push(childId)
            })
        })
    })

    // Update layout references
    Object.values(newShow.layouts || {}).forEach((layout) => {
        layout?.slides?.forEach((slide) => {
            if (idMap[slide.id]) slide.id = idMap[slide.id]
            if (slide.parent && idMap[slide.parent]) slide.parent = idMap[slide.parent]
            if (slide.children) {
                const updatedChildren: Record<string, any> = {}
                Object.entries(slide.children).forEach(([id, data]) => {
                    updatedChildren[idMap[id] || id] = data
                })
                slide.children = updatedChildren
            }
        })
    })

    // Delete duplicate slides
    deletedIds.forEach((id) => delete newShow.slides[id])

    history({ id: "UPDATE", newData: { data: newShow }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
    refreshEditSlide.set(true)
}
