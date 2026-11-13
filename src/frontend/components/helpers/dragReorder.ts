import { writable } from "svelte/store"

/**
 * Reorders items in an array by moving activeIndices to toIndex.
 * Supports single and multiple item reordering seamlessly.
 */
export function reorderArray<T>(list: T[], activeIndices: number[], toIndex: number | null): T[] {
    if (!activeIndices?.length || toIndex === null || toIndex < 0 || !list?.length) return list

    const sorted = [...new Set(activeIndices)].sort((a, b) => a - b)
    if (sorted.includes(toIndex)) return list

    const clamped = Math.max(0, Math.min(toIndex, list.length - 1))
    const targetItem = list[clamped]
    if (!targetItem) return list

    const moving = sorted.map((i) => list[i]).filter(Boolean)
    const remaining = list.filter((_, i) => !sorted.includes(i))

    let insertAt = remaining.indexOf(targetItem)
    if (insertAt < 0) {
        insertAt = remaining.length
    } else if (clamped > sorted[sorted.length - 1]) {
        insertAt += 1
    }

    const result = [...remaining]
    result.splice(insertAt, 0, ...moving)
    return result
}

/**
 * Creates a drag-and-drop reorder controller for lists.
 */
export function createDragReorder(onReorder: (fromIndices: number[], toIndex: number) => void) {
    const draggedIndices = writable<number[]>([])
    const dragOverIndex = writable<number | null>(null)

    return {
        draggedIndices,
        dragOverIndex,
        getReorderedList<T>(list: T[], activeIndices: number[], to: number | null): T[] {
            return reorderArray(list, activeIndices, to)
        },
        onDragStart(index: number, selectedIndices: number[] = []) {
            const indices = selectedIndices.includes(index) && selectedIndices.length > 1 ? selectedIndices : [index]
            draggedIndices.set(indices)
            dragOverIndex.set(index)
        },
        onDragOver(index: number) {
            dragOverIndex.set(index)
        },
        onDrop(targetIndex?: number) {
            let indices: number[] = []
            let to: number | null = null
            draggedIndices.subscribe((v) => (indices = v))()
            dragOverIndex.subscribe((v) => (to = v))()
            const finalTo = to !== null ? to : (targetIndex ?? null)

            if (finalTo !== null && indices.length && !indices.includes(finalTo)) {
                onReorder(indices, finalTo)
            }
            draggedIndices.set([])
            dragOverIndex.set(null)
        },
        onDragEnd() {
            let indices: number[] = []
            let to: number | null = null
            draggedIndices.subscribe((v) => (indices = v))()
            dragOverIndex.subscribe((v) => (to = v))()

            // If drag ends outside a drop target, commit to the active placeholder position
            if (to !== null && indices.length && !indices.includes(to)) {
                onReorder(indices, to)
            }
            draggedIndices.set([])
            dragOverIndex.set(null)
        }
    }
}
