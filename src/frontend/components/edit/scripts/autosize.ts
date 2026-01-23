const DEF_FONT_SIZE = 100
export const MAX_FONT_SIZE = 800
const MIN_FONT_SIZE = 10
const PRECISION = 5

// shrinkToFit: text is set font size by default, but can shrink if the text does not fit in the textbox
// growToFit: text will grow to fill the entire textbox, but maximum the set font size

export type AutosizeTypes = "shrinkToFit" | "growToFit" | "none"
type Options = {
    type?: AutosizeTypes // "shrinkToFit"
    textQuery?: string // all children by default (or self)
    defaultFontSize?: number // 50
    maxFontSize?: number // 800
    minFontSize?: number // 10
    isList?: boolean // whether this is a list item (affects measurement)
}

export default function autosize(elem: HTMLElement, { type, textQuery, defaultFontSize, maxFontSize, minFontSize, isList }: Options = {}) {
    // set default values
    if (!minFontSize) minFontSize = MIN_FONT_SIZE
    if (!maxFontSize) maxFontSize = MAX_FONT_SIZE
    if (!defaultFontSize) defaultFontSize = Math.max(minFontSize, Math.min(maxFontSize, DEF_FONT_SIZE))

    if (!elem) return defaultFontSize

    if (minFontSize < 1) {
        console.error("Too small minimum font size!")
        return 1
    }
    if (minFontSize >= maxFontSize) {
        console.error("Min font size can't be larger than max font size!")
        return maxFontSize
    }

    const boxElem = virtualElem()
    if (!boxElem) return defaultFontSize

    const boxWidth = boxElem.clientWidth
    const boxHeight = boxElem.clientHeight

    let textChildren: HTMLElement[] | HTMLCollection = []
    if (textQuery) textChildren = boxElem.querySelectorAll(textQuery) as any
    if (!textChildren.length) textChildren = boxElem.children.length ? boxElem.children : [boxElem]

    let fontSize = defaultFontSize // maxFontSize * 0.5
    const styles: string[] = []
    addStyleToElemText(fontSize)

    if (type === "shrinkToFit") {
        if (!textIsBiggerThanBox()) {
            // don't change the font size
            return finish(defaultFontSize)
        }
        // shrinkToFit is same as growToFit if text is larger
    }

    let lowestValue = minFontSize
    let highestValue = maxFontSize
    let previousSize = 0

    size()

    const finalResult = Math.min(maxFontSize, lowestValue)

    // prefer lowest value (due to margin)
    return finish(finalResult)

    function finish(value: number) {
        boxElem!.remove()
        return value
    }

    function size() {
        if (textIsBiggerThanBox()) highestValue = fontSize - 1
        else lowestValue = fontSize

        // if difference is less than 2px margin, return early
        if (highestValue - lowestValue < PRECISION) return

        // always double/half the amount for the quickest search
        fontSize = (highestValue + lowestValue) * 0.5

        // prevent loops
        if (Math.abs(fontSize - previousSize) < 1) return
        previousSize = fontSize

        addStyleToElemText(fontSize)
        size()
    }

    function textIsBiggerThanBox() {
        return boxElem!.scrollWidth > boxWidth || boxElem!.scrollHeight > boxHeight
    }

    function addStyleToElemText(currentFontSize: number) {
        let i = 0
        for (const textElem of Array.from(textChildren)) {
            if (!styles[i]) styles[i] = textElem.getAttribute("style") || ""
            textElem.setAttribute("style", styles[i] + `;overflow:visible;font-size: ${currentFontSize}px !important;`)
            i++
        }
    }

    function virtualElem() {
        const cloned = elem.cloneNode(true) as HTMLElement
        if (!cloned) return null

        cloned.style.pointerEvents = "none"
        cloned.style.position = "absolute"
        cloned.style.opacity = "0"
        // overflow = hidden...

        // "include" paddings
        const computedStyle = getComputedStyle(elem)
        const newWidth = elem.clientWidth - parseFloat(computedStyle.paddingRight) - parseFloat(computedStyle.paddingLeft)
        const newHeight = elem.clientHeight - parseFloat(computedStyle.paddingBottom) - parseFloat(computedStyle.paddingTop)
        cloned.style.width = `${newWidth}px`
        cloned.style.height = `${newHeight}px`
        cloned.style.padding = "0"

        // "align-items: flex-end;" does not work with auto size
        cloned.style.alignItems = "center"
        if (cloned.querySelector(".edit")) (cloned.querySelector(".edit") as HTMLElement).style.justifyContent = "center"

        for (const elemHide of Array.from(cloned.querySelectorAll(".hideFromAutosize"))) {
            ;(elemHide as HTMLElement).style.display = "none"
        }

        // CRITICAL FIX FOR LIST ITEMS:
        // List items have font-size on both the parent .break div AND the inner span elements
        // This causes double font-size application during measurement
        // We need to remove font-size from .break divs so only the spans (selected by textQuery) control sizing
        if (isList) {
            const breakElements = cloned.querySelectorAll('.break')
            for (const breakElem of Array.from(breakElements)) {
                const htmlBreak = breakElem as HTMLElement
                const currentStyle = htmlBreak.getAttribute('style') || ''
                const newStyle = currentStyle.replace(/font-size:\s*[^;]+;?/gi, '')
                htmlBreak.setAttribute('style', newStyle)
            }
        }

        elem.after(cloned)
        return cloned
    }
}
