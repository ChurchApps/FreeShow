import type { ProjectShowRef } from "../../types/Projects"

// Project items synced from a content provider carry a `providerItemId`.
// Items without one were added by the user, and a sync must keep them.

interface MergeOptions {
    // provider names by provider item id, as imported show items don't always carry a name
    providerNames: { [providerItemId: string]: string }
    showExists: (showId: string) => boolean
}

const isShow = (item: ProjectShowRef) => (item.type || "show") === "show"
const normalizeName = (name: string | undefined) => (name || "").trim().toLowerCase()

export function getProviderItemId(item: ProjectShowRef) {
    if (item.providerItemId) return item.providerItemId
    // providers without a stable id for sections are matched by name
    return item.type === "section" ? `section:${item.name || ""}` : item.id
}

// a show put in the place of a placeholder takes over its provider item, so the next sync keeps it
export function fillPlaceholderItem(replaced: ProjectShowRef | undefined, item: ProjectShowRef): ProjectShowRef {
    if (replaced?.type !== "show_placeholder" || item.type === "show_placeholder") return item
    // placeholders synced by an earlier version don't know their provider item yet, the next sync finds it by name
    if (!replaced.providerItemId) return replaced.name ? { ...item, replacedPlaceholder: replaced.name } : item

    const filled: ProjectShowRef = { ...item, providerItemId: replaced.providerItemId }
    if (filled.scheduleLength === undefined && replaced.scheduleLength !== undefined) filled.scheduleLength = replaced.scheduleLength
    return filled
}

/**
 * Merge freshly synced provider items into the existing project items.
 * - provider items follow the provider's order, and items removed at the provider are removed
 * - items added by the user stay behind the provider item they followed
 * - user settings on provider items (color, actions, notes, ...) are kept
 */
export function mergeProviderProjectItems(existing: ProjectShowRef[], incoming: ProjectShowRef[], options: MergeOptions): ProjectShowRef[] {
    const matches = new Map<number, number>() // incoming index -> existing index
    const matched = new Set<number>()
    function addMatch(incomingIndex: number, existingIndex: number) {
        if (incomingIndex < 0 || existingIndex < 0) return
        matches.set(incomingIndex, existingIndex)
        matched.add(existingIndex)
    }

    existing.forEach((item, i) => {
        if (!item.providerItemId) return
        addMatch(
            incoming.findIndex((a, j) => !matches.has(j) && a.providerItemId === item.providerItemId),
            i
        )
    })

    // projects synced before every item had a provider item id
    incoming.forEach((item, j) => {
        if (matches.has(j)) return
        addMatch(
            j,
            existing.findIndex((a, i) => !matched.has(i) && !a.providerItemId && isSameLegacyItem(a, item, options.providerNames))
        )
    })

    // user items, grouped by the incoming item they should follow
    const incomingIds = new Set(incoming.map((a) => a.providerItemId))
    const incomingIndexes = new Map(Array.from(matches, ([j, i]) => [i, j] as [number, number]))
    const atStart: ProjectShowRef[] = []
    const following: { [incomingIndex: number]: ProjectShowRef[] } = {}
    let anchor: number | undefined
    existing.forEach((item, i) => {
        const incomingIndex = incomingIndexes.get(i)
        if (incomingIndex !== undefined) {
            anchor = incomingIndex
            return
        }

        // removed at the provider (a second copy of an item which still exists was made by the user)
        if (item.providerItemId && !incomingIds.has(item.providerItemId)) return

        if (anchor === undefined) atStart.push(item)
        else (following[anchor] ||= []).push(item)
    })

    const merged = incoming.map((item, j) => {
        const i = matches.get(j)
        return i === undefined ? item : mergeItem(existing[i], item, options.showExists)
    })

    return [...atStart, ...merged.flatMap((item, j) => [item, ...(following[j] || [])])]
}

function isSameLegacyItem(existing: ProjectShowRef, incoming: ProjectShowRef, providerNames: MergeOptions["providerNames"]) {
    if (incoming.type === "section") return existing.type === "section" && normalizeName(existing.name) === normalizeName(incoming.name)

    // a placeholder, or what the user has put in its place
    const placeholderName = existing.type === "show_placeholder" ? existing.name : existing.replacedPlaceholder
    if (placeholderName !== undefined) {
        if (!isShow(incoming) && incoming.type !== "show_placeholder") return false
        const incomingName = normalizeName(incoming.name || providerNames[incoming.providerItemId || ""])
        return !!incomingName && normalizeName(placeholderName) === incomingName
    }

    return (existing.type || "show") === (incoming.type || "show") && existing.id === incoming.id
}

function mergeItem(previous: ProjectShowRef, incoming: ProjectShowRef, showExists: MergeOptions["showExists"]): ProjectShowRef {
    // the provider item is known from now on
    const { replacedPlaceholder: _, ...existing } = previous

    // there is no local match for the provider item, but the user has chosen something for it
    if (incoming.type === "show_placeholder" && existing.type !== "show_placeholder" && (!isShow(existing) || showExists(existing.id))) {
        return { ...existing, providerItemId: incoming.providerItemId, scheduleLength: incoming.scheduleLength ?? existing.scheduleLength }
    }

    const provided = Object.fromEntries(Object.entries(incoming).filter(([key, value]) => value !== undefined && !(key === "notes" && !value)))
    const merged: ProjectShowRef = { ...existing, ...provided }

    if (incoming.type === "section" || incoming.type === "show_placeholder") {
        merged.id = existing.id
    } else if (existing.type === "show_placeholder") {
        if (!incoming.name) delete merged.name
    } else if (merged.id !== existing.id) {
        // layouts belong to the previous show
        if (!incoming.layout) delete merged.layout
        delete merged.layoutInfo
    }

    return merged
}
