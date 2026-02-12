import type { LayoutRef, Line, Show } from "../../../types/Show"
import { clone, keysToID } from "./helpers"

export function getLayoutRef(currentShow: Show, layoutId: string = "") {
    let ref: LayoutRef[] = []
    if (!currentShow) return ref

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
                data: layoutSlide.children?.[childId] || {}
            })
        })
    })

    return ref
}

// get group number (dynamic counter)
export function getGroupName({ show, showId }: { show: Show; showId: string }, slideID: string, groupName: string | null, layoutIndex: number, addHTML: boolean = false) {
    let name = groupName
    if (name === null) return name // child slide

    if (!name?.length) name = "—"
    // if (!get(groupNumbers)) return name

    // sort by order when just one layout
    let slides = keysToID(clone(show.slides || {}))
    if (Object.keys(show.layouts || {}).length < 2) {
        let layoutSlides =
            Object.values(show.layouts || {})[0]
                ?.slides?.filter(Boolean)
                ?.map(({ id }) => id) || []
        slides = slides.sort((a, b) => layoutSlides.indexOf(a.id) - layoutSlides.indexOf(b.id))
    }

    // different slides with same name
    let currentSlide = show.slides?.[slideID] || {}
    let allSlidesWithSameGroup = slides.filter((a) => a.group === currentSlide.group)
    let currentIndex = allSlidesWithSameGroup.findIndex((a) => a.id === slideID)
    let currentGroupNumber = allSlidesWithSameGroup.length > 1 ? " " + (currentIndex + 1) : ""
    name += currentGroupNumber

    // same group - count
    let layoutRef = getLayoutRef(show, showId)
    let allGroupLayoutSlides = layoutRef.filter((a) => a.id === slideID)
    let currentGroupLayoutIndex = allGroupLayoutSlides.findIndex((a) => a.layoutIndex === layoutIndex)
    let currentLayoutNumberHTML = allGroupLayoutSlides.length > 1 ? '<span class="group_count">' + (currentGroupLayoutIndex + 1) + "</span>" : ""
    let currentLayoutNumber = allGroupLayoutSlides.length > 1 ? " (" + (currentGroupLayoutIndex + 1) + ")" : ""
    name += addHTML ? currentLayoutNumberHTML : currentLayoutNumber

    return name
}

export const VIRTUAL_BREAK_CHAR = "[_VB]"
export function createVirtualBreaks(lines: Line[], skip: boolean = false) {
    if (!lines?.length) return []

    const replaceWith = skip ? "" : "<br>"
    lines.forEach((line) => {
        if (!Array.isArray(line?.text)) return

        line.text.forEach((text) => {
            text.value = replaceVirtualBreaks(text.value, replaceWith)
        })
    })

    return lines
}
export function replaceVirtualBreaks(line: string, replaceWith: string = "<br>") {
    // replace & remove spaces
    return line.replaceAll(VIRTUAL_BREAK_CHAR, replaceWith).replace(/\s*<br>\s*/g, "<br>")
}
