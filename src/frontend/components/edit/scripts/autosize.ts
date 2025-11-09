const DEF_FONT_SIZE = 100
export const MAX_FONT_SIZE = 800
const MIN_FONT_SIZE = 10
const CACHE_LIMIT = 500

const autosizeCache = new Map<string, number>()

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
    const min = minFontSize ?? MIN_FONT_SIZE
    const max = maxFontSize ?? MAX_FONT_SIZE
    const def = defaultFontSize ?? Math.max(min, Math.min(max, DEF_FONT_SIZE))

    if (!elem) return def

    const cacheKey = createCacheKey(elem, {
        type: type || "growToFit",
        textQuery: textQuery || "",
        defaultFontSize: def,
        maxFontSize: max,
        minFontSize: min
    })

    if (cacheKey && autosizeCache.has(cacheKey)) return autosizeCache.get(cacheKey)!

    if (min < 1) {
        console.error("Too small minimum font size!")
        return 1
    }
    if (min >= max) {
        console.error("Min font size can't be larger than max font size!")
        return max
    }

    const boxElem = virtualElem()
    if (!boxElem) return def

    const boxWidth = boxElem.clientWidth
    const boxHeight = boxElem.clientHeight

    let textChildren: HTMLElement[] | HTMLCollection = []
    if (textQuery) textChildren = boxElem.querySelectorAll(textQuery) as any
    if (!textChildren.length) textChildren = boxElem.children.length ? boxElem.children : [boxElem]

    const originalStyles: string[] = []
    const childrenArray = Array.from(textChildren) as HTMLElement[]

    // apply default size once to capture base measurement
    applyFontSize(def)

    const contentWidth = Math.max(1, boxElem.scrollWidth)
    const contentHeight = Math.max(1, boxElem.scrollHeight)

    let widthRatio = boxWidth / contentWidth
    let heightRatio = boxHeight / contentHeight

    if (!isFinite(widthRatio) || widthRatio <= 0) widthRatio = 1
    if (!isFinite(heightRatio) || heightRatio <= 0) heightRatio = 1

    let scale = Math.min(widthRatio, heightRatio)

    if (type === "shrinkToFit") scale = Math.min(1, scale)

    // allow grow beyond default when requested, but clamp to bounds
    const maxScale = max / def
    scale = Math.min(scale, maxScale)

    let fontSize = clamp(def * scale)

    applyFontSize(fontSize)

    if (isOverflowing()) fontSize = shrinkToFit(fontSize)
    else if (type !== "shrinkToFit" && fontSize < max) fontSize = growToFit(fontSize)

    // ensure the text truly fits (precision safety)
    while (fontSize > min && isOverflowing()) {
        fontSize = clamp(fontSize - 1)
        applyFontSize(fontSize)
    }

    const result = finish(fontSize)

    if (cacheKey) {
        autosizeCache.set(cacheKey, result)
        if (autosizeCache.size > CACHE_LIMIT) {
            const firstKey = autosizeCache.keys().next().value
            autosizeCache.delete(firstKey)
        }
    }

    return result

    function clamp(value: number) {
        if (!isFinite(value)) return def
        return Math.max(min, Math.min(max, value))
    }

    function shrinkToFit(current: number) {
        let low = min
        let high = Math.max(min, current)
        let best = low

        for (let i = 0; i < 12 && high - low > 0.25; i++) {
            const mid = clamp((low + high) / 2)
            applyFontSize(mid)
            if (isOverflowing()) high = mid - 0.25
            else {
                best = mid
                low = mid + 0.25
            }
        }

        applyFontSize(best)
        return clamp(best)
    }

    function growToFit(current: number) {
        let low = Math.max(min, current)
        let high = max
        let best = low

        for (let i = 0; i < 12 && high - low > 0.25; i++) {
            const mid = clamp((low + high) / 2)
            applyFontSize(mid)
            if (isOverflowing()) high = mid - 0.25
            else {
                best = mid
                low = mid + 0.25
            }
        }

        applyFontSize(best)
        return clamp(best)
    }

    function finish(value: number) {
        boxElem!.remove()
        return Math.max(min, Math.min(max, value))
    }

    function isOverflowing() {
        return boxElem!.scrollWidth > boxWidth + 1 || boxElem!.scrollHeight > boxHeight + 1
    }

    function applyFontSize(currentFontSize: number) {
        let i = 0
        for (const textElem of childrenArray) {
            if (!originalStyles[i]) originalStyles[i] = textElem.getAttribute("style") || ""
            textElem.setAttribute("style", `${originalStyles[i]};overflow:visible;font-size:${currentFontSize}px !important;`)
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
        const editElem = cloned.querySelector(".edit") as HTMLElement | null
        if (editElem) editElem.style.justifyContent = "center"

        for (const elemHide of Array.from(cloned.querySelectorAll(".hideFromAutosize"))) {
            ; (elemHide as HTMLElement).style.display = "none"
        }

        elem.after(cloned)
        return cloned
    }
}

function createCacheKey(elem: HTMLElement, { type, textQuery, defaultFontSize, maxFontSize, minFontSize }: { type: string, textQuery: string, defaultFontSize: number, maxFontSize: number, minFontSize: number }) {
    if (!elem.isConnected) return null

    const width = Math.round(elem.clientWidth)
    const height = Math.round(elem.clientHeight)

    if (!width || !height) return null

    let signature = ""
    if (textQuery) {
        const nodes = Array.from(elem.querySelectorAll(textQuery)) as HTMLElement[]
        if (!nodes.length) signature = elem.innerHTML
        else signature = nodes.map((node) => `${node.innerHTML}|${node.getAttribute("style") || ""}`).join("||")
    } else signature = elem.innerHTML

    const styleAttr = elem.getAttribute("style") || ""

    return [type, defaultFontSize, maxFontSize, minFontSize, width, height, textQuery, styleAttr, signature].join("|#|")
}
