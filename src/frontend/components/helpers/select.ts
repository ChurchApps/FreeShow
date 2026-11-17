import { get } from "svelte/store"
import type { Selected, SelectIds } from "../../../types/Main"
import { selected } from "../../stores"
import { removeDuplicates } from "./array"

export function select(id: SelectIds, data: any) {
    selected.update((sel) => {
        if (!Array.isArray(data)) data = [data]
        if (sel.id === id) sel.data = removeDuplicates([...sel.data, ...data])
        else sel = { id, data }
        return sel
    })
}

export function getSelected(hasToBeId: SelectIds | null, index: null | number = null, updater: Selected = get(selected)) {
    const sel = updater
    if (hasToBeId && sel.id !== hasToBeId) return null
    if (index === null) return sel.data
    return sel.data[index]
}

export function deselect() {
    selected.set({ id: null, data: [] })
}

// SHIFT RANGE

// The item last clicked without Shift (any list). A plain click on e.g. a slide plays it instead of selecting it,
// so the selection is empty when the user then Shift+clicks another one: the range starts here instead.
let shiftAnchor: { id: string; data: any } | null = null
export function setShiftAnchor(id: string, data: any) {
    shiftAnchor = { id, data }
}
export function getShiftAnchor() {
    return shiftAnchor
}
// any edit can move items around, so an index-based anchor might point to another item afterwards
export function clearShiftAnchor() {
    shiftAnchor = null
}

const sameData = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Where a Shift+click range starts when nothing in the list is selected yet.
 * A plain click on e.g. a slide plays it without selecting it, so the last plain-clicked item (`anchor`) is used instead.
 * Returns the anchor data to select first, or null when the existing selection (or nothing) should be used.
 */
export function getShiftRangeStart(selection: Selected, anchor: { id: string; data: any } | null, listId: string, clicked: any, shiftRange: any[] = []) {
    if (selection.id === listId && selection.data?.length) return null
    if (!anchor || anchor.id !== listId) return null
    if (sameData(anchor.data, clicked)) return null

    // the anchor must still be in this list (e.g. not a slide from another show)
    const inList = shiftRange.length ? shiftRange.some((a) => sameData(a, anchor.data)) : anchor.data?.index !== undefined
    return inList ? anchor.data : null
}
