import type { LayoutRef } from "../../../types/Show"

export function getUpcomingGroupIndex(ref: LayoutRef[], slideIndex: number): number | undefined {
    const currentSlide = ref[slideIndex]
    if (!currentSlide) return undefined

    const currentGroupIndex = currentSlide.parent?.layoutIndex ?? slideIndex
    for (let index = slideIndex + 1; index < ref.length; index++) {
        const slide = ref[index]
        const groupIndex = slide.parent?.layoutIndex ?? index
        if (groupIndex !== currentGroupIndex && !slide.data?.disabled) return groupIndex
    }
}
