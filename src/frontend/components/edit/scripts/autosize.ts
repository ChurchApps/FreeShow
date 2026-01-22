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
}

export default function autosize(elem: HTMLElement, { type, textQuery, defaultFontSize, maxFontSize, minFontSize }: Options = {}) {
    // DEBUG: console.debug(`[DEBUG] autosize() ENTRY`, JSON.stringify({ type, textQuery, inputDefaultFontSize: defaultFontSize, inputMaxFontSize: maxFontSize, inputMinFontSize: minFontSize, DEF_FONT_SIZE, MAX_FONT_SIZE, MIN_FONT_SIZE }, null, 2))

    // set default values
    if (!minFontSize) minFontSize = MIN_FONT_SIZE
    if (!maxFontSize) maxFontSize = MAX_FONT_SIZE
    if (!defaultFontSize) defaultFontSize = Math.max(minFontSize, Math.min(maxFontSize, DEF_FONT_SIZE))

    // DEBUG: console.debug(`[DEBUG] autosize() after defaults`, JSON.stringify({ type, minFontSize, maxFontSize, defaultFontSize }, null, 2))

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

    // DEBUG: console.debug(`[DEBUG] autosize() box dimensions`, JSON.stringify({ boxWidth, boxHeight }, null, 2))

    let textChildren: HTMLElement[] | HTMLCollection = []
    if (textQuery) textChildren = boxElem.querySelectorAll(textQuery) as any
    if (!textChildren.length) textChildren = boxElem.children.length ? boxElem.children : [boxElem]

    let fontSize = defaultFontSize // maxFontSize * 0.5
    const styles: string[] = []
    addStyleToElemText(fontSize)

    if (type === "shrinkToFit") {
        if (!textIsBiggerThanBox()) {
            // don't change the font size
            // DEBUG: console.debug(`[DEBUG] autosize() shrinkToFit - text fits`, JSON.stringify({ defaultFontSize }, null, 2))
            return finish(defaultFontSize)
        }
        // shrinkToFit is same as growToFit if text is larger
    }

    let lowestValue = minFontSize
    let highestValue = maxFontSize
    let previousSize = 0

    // DEBUG: console.debug(`[DEBUG] autosize() starting binary search`, JSON.stringify({ type, lowestValue, highestValue, minFontSize, maxFontSize }, null, 2))

    size()

    const finalResult = Math.min(maxFontSize, lowestValue)
    // DEBUG: console.debug(`[DEBUG] autosize() FINAL RESULT`, JSON.stringify({ type, lowestValue, maxFontSize, finalResult }, null, 2))

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

        elem.after(cloned)
        return cloned
    }
}
