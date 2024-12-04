import { get } from "svelte/store"
import type { ID, Show, Slide, SlideData } from "../../../types/Show"
import { activeShow, showsCache } from "../../stores"
import { getExtension, getFileName, removeExtension } from "./media"

// please don't use the functions in this file!
// they are outdated, but still in use

export function splitPath(path: string) {
    const name: string = getFileName(path)
    const extension: string = getExtension(name)
    const shortName: string = removeExtension(name)
    return { path, name, extension, shortName }
}

export const GetLayout = (showID: null | ID = null, layoutID: null | ID = null): SlideData[] => {
    if (!showID) showID = get(activeShow)?.id || null
    if (!showID) return []
    const currentShow: Show = get(showsCache)[showID]
    if (!layoutID) layoutID = currentShow?.settings?.activeLayout
    const layoutSlides: SlideData[] = []
    if (currentShow?.layouts) {
        currentShow.layouts[layoutID]?.slides?.forEach((ls) => {
            if (ls && currentShow.slides[ls.id]) {
                const slide: Slide = currentShow.slides[ls.id]
                const newLS = { ...ls }
                delete newLS.children
                layoutSlides.push({ ...newLS, color: slide.color })

                if (slide.children) {
                    slide.children.forEach((id: string) => {
                        if (ls.children?.[id]) {
                            const slideData: any = ls.children[id]
                            if (slideData)
                                layoutSlides.push({
                                    id,
                                    ...slideData,
                                    color: slide.color,
                                    parent: ls.id,
                                })
                        } else layoutSlides.push({ id, color: slide.color, parent: ls.id })
                    })
                }
            }
        })
    }
    return layoutSlides
}

export const GetLayoutRef = (showID: null | ID = null, layoutID: null | ID = null): any[] => {
    if (!showID) showID = get(activeShow)!.id
    const currentShow: Show = get(showsCache)[showID]
    if (!layoutID) layoutID = currentShow.settings.activeLayout
    const layoutSlides: any[] = []
    if (currentShow) {
        currentShow.layouts[layoutID].slides.forEach((ls, i) => {
            const slide: Slide = currentShow.slides[ls.id]
            if (slide) {
                layoutSlides.push({ type: "parent", id: ls.id, index: i })
                if (slide.children) {
                    slide.children.forEach((id: string, j) => {
                        layoutSlides.push({
                            type: "child",
                            id,
                            parent: ls.id,
                            layoutIndex: i,
                            slideIndex: j,
                        })
                    })
                }
            }
        })
    }
    return layoutSlides
}
