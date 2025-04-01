import { get } from "svelte/store"
import type { LayoutRef, Show, Shows } from "../../../types/Show"
import { awaitRequest } from "../util/socket"
import { showsCache } from "../util/stores"

export function getLayoutRef(showId: string, layoutId: string = "", _updater?: Shows | Show) {
    let ref: LayoutRef[] = []

    let currentShow = get(showsCache)[showId]
    if (!currentShow) return []

    if (!layoutId) layoutId = currentShow.settings.activeLayout
    if (!Array.isArray(currentShow?.layouts?.[layoutId]?.slides)) return []

    let layoutIndex: number = -1
    currentShow.layouts[layoutId].slides.forEach((layoutSlide, index) => {
        if (!currentShow.slides[layoutSlide.id]) return

        layoutIndex++
        let slide = currentShow.slides[layoutSlide.id]
        let children = slide?.children || []

        ref.push({ type: "parent", layoutId, index, layoutIndex, id: layoutSlide.id, children, data: layoutSlide })
        if (!Array.isArray(children)) return

        children.forEach((childId: string, jndex: number) => {
            layoutIndex++

            // array bug
            if (Array.isArray(childId)) childId = childId[0]

            ref.push({
                type: "child",
                layoutId,
                index: jndex,
                layoutIndex,
                id: childId,
                parent: { id: layoutSlide.id, index, layoutIndex: layoutIndex - jndex - 1 },
                data: layoutSlide.children?.[childId] || {},
            })
        })
    })

    return ref
}

let cached: { [key: string]: string } = {}
export function getDynamicValue(value: string) {
    return cached[value] || value
}
export async function replaceDynamicValues(value: string, _updater: number = 0) {
    const newValue = await awaitRequest("API:get_dynamic_value", { value, ref: { type: "stage" } })
    if (newValue) cached[value] = newValue
    return newValue ?? cached[value] ?? value
}
