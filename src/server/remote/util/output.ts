import type { Show, Slide, SlideData } from "../../../types/Show"

export function nextSlide(layout: any, currentSlide: number, previous: boolean = false): null | number {
    let index = previous ? currentSlide - 1 : currentSlide + 1

    while ((previous ? index > -1 : index < layout!.length) && (layout![index]?.disabled || (!previous && layout![index - 1]?.end))) {
        if (!previous && layout![index - 1]?.end) index = 0
        else index = previous ? index - 1 : index + 1
    }

    return layout![index] && !layout![index].disabled ? index : null
}

export const getNextSlide = (show: Show, slideIndex: number, layout: string = show.settings.activeLayout): Slide | null => {
    let index = nextSlide(GetLayout(show, layout), slideIndex)

    return index === null ? null : show.slides[GetLayout(show, layout)[slideIndex]?.id]
}

export const GetLayout = (show: Show | null, layout: string | null): SlideData[] => {
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
