import type { LayoutRef } from "../../../types/Show"

export function getSlideProgress(layoutRef: Pick<LayoutRef, "data">[], currentIndex: number) {
    const hasCurrentSlide = !!layoutRef[currentIndex]
    let currentSlideNumber = 0
    let slidesLength = 0

    layoutRef.forEach((slide, index) => {
        if (slide.data?.disabled) return

        slidesLength++
        if (hasCurrentSlide && index <= currentIndex) currentSlideNumber++
    })

    return { currentSlideNumber, slidesLength }
}
