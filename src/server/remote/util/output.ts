import type { Slide, SlideData } from "../../../types/Show"
import { send } from "./socket"
import { _get, _set } from "./stores"

export function next() {
    if (!_get("layout")) {
        if (_get("activeTab") === "show" && _get("activeShow")) {
            // play slide
            send("OUT", { id: _get("activeShow").id, index: 0, layout: _get("activeShow").settings.activeLayout })
            _set("outShow", _get("activeShow"))
        }
        return
    }

    // WIP don't play next when reached end!

    let index = nextSlide(_get("layout"), _get("outSlide") ?? -1)
    if (index !== null) send("OUT", { id: _get("outShow").id, index, layout: _get("outShow").settings.activeLayout })
    else {
        // go to next show in project
        let currentProjectShows = _get("projects").find((a) => a.id === _get("project"))?.shows || []
        let currentProjectShowIndex = currentProjectShows.findIndex((showRef: any) => showRef.id === _get("activeShow").id)

        let newIndex = currentProjectShowIndex + 1
        let newProjectShow: any = { type: "." }
        while (newProjectShow && (newProjectShow.type || "show") !== "show") {
            newProjectShow = currentProjectShows[newIndex]
            newIndex++
        }

        if (!newProjectShow) return

        send("SHOW", newProjectShow.id)
        _set("activeTab", "show")

        // play slide
        setTimeout(() => {
            send("OUT", { id: newProjectShow.id, index: 0, layout: _get("activeShow")?.settings?.activeLayout })
            _set("outShow", _get("activeShow"))
        }, 100)
    }
}

export function previous() {
    if (!_get("layout")) return

    // WIP go to previous show & play last slide

    let index = nextSlide(_get("layout"), _get("outSlide") ?? _get("layout")?.length, true)
    if (index !== null) send("OUT", { id: _get("outShow").id, index, layout: _get("outShow").settings.activeLayout })
}

export function nextSlide(layout: any, currentSlide: number, previous: boolean = false): null | number {
    let index = previous ? currentSlide - 1 : currentSlide + 1

    while ((previous ? index > -1 : index < layout!.length) && (layout![index]?.disabled || (!previous && layout![index - 1]?.end))) {
        if (!previous && layout![index - 1]?.end) index = 0
        else index = previous ? index - 1 : index + 1
    }

    return layout![index] && !layout![index].disabled ? index : null
}

export const getNextSlide = (show: any, slideIndex: number, layout: string = show.settings.activeLayout): Slide => {
    let index = nextSlide(GetLayout(show, layout), slideIndex)

    return index === null ? null : show.slides[GetLayout(show, layout)[slideIndex]?.id]
}

export const GetLayout = (show: any, layout: string): SlideData[] => {
    let layoutSlides: SlideData[] = []
    if (show && layout) {
        show.layouts?.[layout]?.slides.forEach((ls: any) => {
            let slide: Slide = show.slides[ls.id]
            if (!slide) return

            layoutSlides.push({ ...ls, color: slide.color })
            if (slide.children) {
                slide.children.forEach((id) => {
                    if (ls.children?.[id]) {
                        let slideData: any = ls.children[id]
                        if (slideData) layoutSlides.push({ id, ...slideData, color: slide.color, parent: ls.id })
                    } else layoutSlides.push({ id, color: slide.color, parent: ls.id })
                })
            }
        })
    }
    return layoutSlides
}
