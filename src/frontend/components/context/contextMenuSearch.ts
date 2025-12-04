import { formatSearch } from "../../utils/search"
import type { ContextMenuItem } from "./contextMenus"
import { loadItems } from "./loadItems"
import { closeContextMenu } from "../../utils/shortcuts"

export interface FlatMenuItem {
    id: string
    label: string
    path: string[]
    disabled?: boolean
}

export function handleKeydown(e: KeyboardEvent, contextActive: boolean, searchQuery: string, highlightedItemId: string | null, lastTriggeredTime: number, lastTriggeredElem: HTMLDivElement | null, onContextMenu: (e: MouseEvent) => void): { searchQuery: string; highlightedItemId: string | null; highlightedPath: string[] } | null {
    // reopen again if enter is pressed within 2 seconds after trigger
    if (!contextActive && e.key === "Enter" && Date.now() - lastTriggeredTime < 2000 && lastTriggeredElem) {
        e.preventDefault()
        const rect = lastTriggeredElem.getBoundingClientRect()
        const fakeEvent = new MouseEvent("contextmenu", {
            clientX: rect.left,
            clientY: rect.top,
            bubbles: true,
            cancelable: true
        })
        Object.defineProperty(fakeEvent, "target", { value: lastTriggeredElem, enumerable: true })
        onContextMenu(fakeEvent as any)
        return null
    }

    if (!contextActive) return null

    if (e.key === "Escape") {
        closeContextMenu()
        return { searchQuery: "", highlightedItemId: null, highlightedPath: [] }
    }

    if (e.key === "Enter" && highlightedItemId) {
        e.preventDefault()
        const menuElement = document.querySelector(`.contextMenu`)
        if (!menuElement) return null

        // Find the actual item element (not parent submenu)
        const targetElement = Array.from(menuElement.querySelectorAll(".highlighted")).find(el => el instanceof HTMLElement && !el.querySelector(".submenu")) as HTMLElement | undefined

        if (targetElement) targetElement.click()
        return null
    }

    if (e.key === "Backspace") {
        e.preventDefault()
        return { searchQuery: "", highlightedItemId: null, highlightedPath: [] }
    }

    if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) return null

    e.preventDefault()
    return { searchQuery: searchQuery + e.key, highlightedItemId: null, highlightedPath: [] }
}

/**
 * Flatten menu items for searching (including submenus)
 */
export function flattenMenuItems(menuIds: string[], contextMenuItems: { [key: string]: ContextMenuItem }, path: string[] = []): FlatMenuItem[] {
    const items: FlatMenuItem[] = []

    menuIds.forEach(id => {
        if (id === "SEPARATOR") return

        // Handle LOAD_ items
        if (id.includes("LOAD_")) {
            const loadId = id.slice(5)
            loadItems(loadId).forEach(([, menuItem]) => {
                if (menuItem === "SEPARATOR") return

                const actualItemId = menuItem.id || loadId
                items.push({
                    id: actualItemId,
                    label: menuItem.label || actualItemId,
                    path: [...path, actualItemId],
                    disabled: menuItem.disabled
                })
            })
            return
        }

        const menuItem = contextMenuItems[id]
        if (!menuItem) return

        const currentPath = [...path, id]

        // Skip parent items that only contain LOAD_ children
        const hasOnlyLoadItems = menuItem.items?.every(item => item === "SEPARATOR" || item.includes("LOAD_"))
        if (!hasOnlyLoadItems) {
            items.push({
                id,
                label: menuItem.label || id,
                path: currentPath,
                disabled: menuItem.disabled
            })
        }

        // Recursively add submenu items
        if (menuItem.items?.length) {
            items.push(...flattenMenuItems(menuItem.items, contextMenuItems, currentPath))
        }
    })

    return items
}

/**
 * Search for matching items in the menu
 */
export function searchMenuItems(query: string, flatMenuItems: FlatMenuItem[], translateText: (key: string, dictionary: any) => string, dictionary: any): { id: string | null; path: string[] } {
    if (!query) return { id: null, path: [] }

    const lowerQuery = formatSearch(query, true)
    const enabledItems = flatMenuItems.filter(item => !item.disabled)

    // WIP this doesn't get the actual replaced text from ContextItem.svelte

    // Find best match - exact match first, then prefix, then partial
    const match =
        enabledItems.find(item => {
            const label = formatSearch(translateText(item.label, dictionary), true)
            return label === lowerQuery
        }) ||
        enabledItems.find(item => {
            const label = formatSearch(translateText(item.label, dictionary), true)
            return label.startsWith(lowerQuery)
        }) ||
        enabledItems.find(item => {
            const label = formatSearch(translateText(item.label, dictionary), true)
            return label.includes(lowerQuery)
        })

    return match ? { id: match.id, path: match.path } : { id: null, path: [] }
}
