import { tick } from "svelte"

export async function centerZoom(zoom: number, zoomOrigin: { x: number; y: number } | null, scrollElem: HTMLElement | undefined, selector: string = ".droparea") {
    if (zoom >= 1) return
    if (!scrollElem) return

    const elem = selector ? (scrollElem.querySelector(selector) as HTMLElement) : scrollElem
    const slide = elem?.querySelector(".slide") as HTMLElement
    if (!elem || !slide) return

    const origin = zoomOrigin

    let contentX = 0
    let contentY = 0
    const oldSlideWidth = slide.offsetWidth
    const oldSlideHeight = slide.offsetHeight

    if (origin) {
        const slideRect = slide.getBoundingClientRect()
        contentX = origin.x - slideRect.left
        contentY = origin.y - slideRect.top
    }

    await tick()

    const newElem = selector ? (scrollElem.querySelector(selector) as HTMLElement) : scrollElem
    const newSlide = newElem?.querySelector(".slide") as HTMLElement
    if (!newElem || !newSlide) return

    if (origin && oldSlideWidth && oldSlideHeight) {
        const ratioX = contentX / oldSlideWidth
        const ratioY = contentY / oldSlideHeight

        const newContentX = newSlide.offsetWidth * ratioX
        const newContentY = newSlide.offsetHeight * ratioY

        const targetSlideLeft = origin.x - newContentX
        const targetSlideTop = origin.y - newContentY

        const dropRect = newElem.getBoundingClientRect()
        newElem.scrollTo({
            left: dropRect.left - targetSlideLeft,
            top: dropRect.top - targetSlideTop
        })
    } else {
        const centerX = (newElem.scrollWidth - newElem.clientWidth) / 2
        const centerY = (newElem.scrollHeight - newElem.clientHeight) / 2
        newElem.scrollTo({ left: centerX, top: centerY })
    }
}
