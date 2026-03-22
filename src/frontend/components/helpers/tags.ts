import { get, type Writable } from "svelte/store"
import type { Selected } from "../../../types/Main"
import type { Tag } from "../../../types/Show"
import { activePopup, popupData } from "../../stores"
import { closeContextMenu } from "../../utils/shortcuts"
import { keysToID, sortByName, sortObject } from "./array"
import type { ContextMenuItem } from "../context/contextMenus"

type TagPopupType = "show" | "media" | "player" | "action" | "variable"
type TagMenuItem = ContextMenuItem | "SEPARATOR"

interface ToggleSelectionTagsOptions<T> {
    data: T[] | undefined
    tagId: string
    disable: boolean
    getTags: (item: T) => string[] | undefined
    applyTags: (item: T, tags: string[]) => void
}

export function openTagManager(type: TagPopupType) {
    closeContextMenu()
    popupData.set({ type })
    activePopup.set("manage_tags")
}

export function toggleSelectionTags<T>({ data, tagId, disable, getTags, applyTags }: ToggleSelectionTagsOptions<T>) {
    data?.forEach((item) => {
        const tags = getUpdatedTags(getTags(item), tagId, disable)
        applyTags(item, tags)
    })
}

export function toggleTagFilter(filterStore: Writable<string[]>, tagId = "") {
    const activeTags = [...get(filterStore)]
    const currentIndex = activeTags.indexOf(tagId)
    if (currentIndex < 0) activeTags.push(tagId)
    else activeTags.splice(currentIndex, 1)

    filterStore.set(activeTags)
}

export function createTagItems(tagStore: Writable<{ [key: string]: Tag }>, activeTags: string[] = [], includeManage = false): TagMenuItem[] {
    const items: TagMenuItem[] = sortObject(sortByName(keysToID(get(tagStore))), "color").map((tag) => ({ ...tag, label: tag.name, enabled: activeTags.includes(tag.id), translate: false }))

    if (!includeManage) return items

    if (items.length) items.push("SEPARATOR")
    items.push({ label: "popup.manage_tags", icon: "edit", iconColor: "#97c7ff", id: "create" })
    return items
}

export function getMenuTagId(menu: { id?: string } | null | undefined) {
    return menu?.id || ""
}

export function getSelectedTagIds<T>(selection: Selected | null | undefined, readItemTags: (item: T) => string[] | undefined) {
    const firstItem = selection?.data?.[0] as T | undefined
    return firstItem ? readItemTags(firstItem) || [] : []
}

function getUpdatedTags(tags: string[] | undefined, tagId: string, disable: boolean) {
    const updatedTags = [...(tags || [])]
    const existingIndex = updatedTags.indexOf(tagId)

    if (disable) {
        if (existingIndex > -1) updatedTags.splice(existingIndex, 1)
    } else if (existingIndex < 0) {
        updatedTags.push(tagId)
    }

    return updatedTags
}
