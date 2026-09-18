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

    try {
        const boxWidth = boxElem.clientWidth
        const boxHeight = boxElem.clientHeight

        const rawTextChildren: HTMLElement[] = textQuery ? Array.from(boxElem.querySelectorAll(textQuery)) : boxElem.children.length ? (Array.from(boxElem.children) as HTMLElement[]) : [boxElem]

        const chordNodes: { elem: HTMLElement; ratio: number }[] = []
        boxElem.querySelectorAll<HTMLElement>("[data-chord-size-ratio]").forEach((el) => {
            const ratio = Number(el.dataset.chordSizeRatio) || 0
            if (ratio) chordNodes.push({ elem: el, ratio })
        })

        const textNodes = rawTextChildren.map((el) => {
            const style = el.getAttribute("style") || ""
            const ratio = Number(el.dataset.autosizeRatio) || 1
            const hasBaseFontSize = style.includes("var(--base-font-size)")
            return { el, style, ratio, hasBaseFontSize }
        })

        let fontSize = defaultFontSize
        addStyleToElemText(fontSize)

        if (type === "shrinkToFit" && !textIsBiggerThanBox()) {
            return defaultFontSize
        }

        let lowestValue = minFontSize
        let highestValue = maxFontSize
        let previousSize = fontSize

        if (textIsBiggerThanBox()) highestValue = fontSize - 1
        else lowestValue = fontSize

        while (highestValue - lowestValue >= PRECISION) {
            // always double/half the amount for the quickest search
            fontSize = (highestValue + lowestValue) * 0.5

            // prevent loops on sub-pixel changes
            if (Math.abs(fontSize - previousSize) < 1) break
            previousSize = fontSize

            addStyleToElemText(fontSize)

            if (textIsBiggerThanBox()) highestValue = fontSize - 1
            else lowestValue = fontSize
        }

        // prefer lowest value (due to margin)
        return Math.min(maxFontSize, lowestValue)

        function textIsBiggerThanBox() {
            return boxElem!.scrollWidth > boxWidth || boxElem!.scrollHeight > boxHeight
        }

        function addStyleToElemText(currentFontSize: number) {
            for (let i = 0; i < chordNodes.length; i++) {
                chordNodes[i].elem.style.setProperty("--font-size", `${currentFontSize}px`)
                chordNodes[i].elem.style.setProperty("--chord-size", `${currentFontSize * chordNodes[i].ratio}px`)
            }

            for (let i = 0; i < textNodes.length; i++) {
                const node = textNodes[i]
                const size = currentFontSize * node.ratio
                if (node.hasBaseFontSize) {
                    const newStyle = node.style.replace(/--base-font-size:\s*[^;]+;?/gi, `--base-font-size: ${size}px;`)
                    node.el.setAttribute("style", newStyle + ";overflow:visible;")
                } else {
                    node.el.setAttribute("style", `${node.style};overflow:visible;font-size: ${size}px !important;`)
                }
            }
        }
    } finally {
        boxElem.remove()
    }

    function virtualElem() {
        const cloned = elem.cloneNode(true) as HTMLElement
        if (!cloned) return null

        cloned.style.pointerEvents = "none"
        cloned.style.position = "absolute"
        cloned.style.opacity = "0"

        // "include" paddings
        const computedStyle = getComputedStyle(elem)
        let newWidth = elem.clientWidth - parseFloat(computedStyle.paddingRight) - parseFloat(computedStyle.paddingLeft)
        let newHeight = elem.clientHeight - parseFloat(computedStyle.paddingBottom) - parseFloat(computedStyle.paddingTop)
        cloned.style.width = `${newWidth}px`
        cloned.style.height = `${newHeight}px`
        cloned.style.padding = "0"

        cloned.style.alignItems = "flex-start"

        cloned.querySelectorAll<HTMLElement>(".hideFromAutosize").forEach((el) => (el.style.display = "none"))
        cloned.querySelectorAll<HTMLElement>(".chords").forEach((el) => (el.style.maxHeight = "65px"))

        elem.after(cloned)
        return cloned
    }
}
