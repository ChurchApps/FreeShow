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
