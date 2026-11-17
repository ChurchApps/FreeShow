export type WrapOptions = { enabled: boolean; gap?: number; background?: string; radius?: number }
type Point = { node: Node; offset: number }
type Part = { source: HTMLElement; start: Point; end: Point }
type Row = { top: number; bottom: number; parts: Part[]; blankSource?: HTMLElement }

// Keep Svelte's original spans in place: only disposable display copies are split.
export function copyPart({ source, start, end }: Part): HTMLElement {
    const copy = source.cloneNode(true) as HTMLElement
    const locate = (point: Point): Point => {
        const path: number[] = []
        let current = point.node
        while (current !== source) {
            path.unshift(Array.from(current.parentNode!.childNodes).indexOf(current as ChildNode))
            current = current.parentNode!
        }
        let node: Node = copy
        for (const index of path) node = node.childNodes[index]
        return { node, offset: point.offset }
    }
    const from = locate(start)
    const to = locate(end)
    const range = source.ownerDocument.createRange()
    range.selectNodeContents(copy)
    range.setStart(to.node, to.offset)
    range.deleteContents()
    range.selectNodeContents(copy)
    range.setEnd(from.node, from.offset)
    range.deleteContents()
    return copy
}

export function measureRows(node: HTMLElement): Row[] {
    const rows: Row[] = []
    let row: Row | undefined
    let breakBeforeNext = false
    const range = node.ownerDocument.createRange()
    for (const source of Array.from(node.children).filter((child): child is HTMLElement => child instanceof HTMLElement && (child.classList.contains("textContainer") || child.hasAttribute("data-freeshow-text")))) {
        const walker = node.ownerDocument.createTreeWalker(source, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
        let child: Node | null
        while ((child = walker.nextNode())) {
            if (child.nodeName === "BR") {
                if (!row || breakBeforeNext) rows.push({ top: 0, bottom: 0, parts: [], blankSource: source })
                breakBeforeNext = true
                continue
            }
            if (child.nodeType !== Node.TEXT_NODE) continue
            // ponytail: O(n) glyph measurements on content/layout changes, coalesced per frame;
            // use run-level binary search if long documents become a measured bottleneck.
            for (let offset = 0; offset < (child.textContent?.length || 0); offset++) {
                range.setStart(child, offset)
                range.setEnd(child, offset + 1)
                const rect = range.getBoundingClientRect()
                if (!rect.height) continue
                const overlap = row ? Math.min(row.bottom, rect.bottom) - Math.max(row.top, rect.top) : 0
                if (!row || breakBeforeNext || overlap < Math.min(row.bottom - row.top, rect.height) / 2) {
                    row = { top: rect.top, bottom: rect.bottom, parts: [] }
                    rows.push(row)
                }
                breakBeforeNext = false
                row.top = Math.min(row.top, rect.top)
                row.bottom = Math.max(row.bottom, rect.bottom)
                const last = row.parts[row.parts.length - 1]
                if (last?.source === source) last.end = { node: child, offset: offset + 1 }
                else row.parts.push({ source, start: { node: child, offset }, end: { node: child, offset: offset + 1 } })
            }
        }
    }
    return rows
}

function renderWrappedLine(node: HTMLElement, options: WrapOptions) {
    let display = node.querySelector<HTMLElement>(":scope > [data-wrap-rows]")
    delete node.dataset.wrapEnabled
    if (display) display.style.display = "none"
    if (!node.clientWidth) {
        if (display) display.style.display = "flex"
        node.dataset.wrapEnabled = ""
        return
    }
    const rows = measureRows(node)
    if (!display) {
        display = node.ownerDocument.createElement("div")
        display.dataset.wrapRows = ""
        display.style.cssText = "display:flex;flex-direction:column;width:100%;"
        node.append(display)
    }
    display.style.gap = `${Math.max(0, Number(options.gap) || 0)}px`
    const justify = getComputedStyle(node).textAlign === "justify"
    display.replaceChildren(
        ...rows.map((row, index) => {
            const element = node.ownerDocument.createElement("div")
            element.dataset.wrapRow = ""
            element.style.cssText = "width:100%;white-space:pre-wrap;text-wrap:nowrap;"
            if (justify && index < rows.length - 1) element.style.textAlignLast = "justify"
            for (const part of row.parts) element.append(copyPart(part))
            if (row.blankSource) {
                const blank = row.blankSource.cloneNode(false) as HTMLElement
                blank.append(node.ownerDocument.createElement("br"))
                element.append(blank)
            }
            if (element.textContent?.replace(/[\u200b-\u200d\u2060\ufeff]/g, "").trim()) {
                element.style.background = options.background || ""
                element.style.borderRadius = `${Math.max(0, Number(options.radius) || 0)}px`
            }
            return element
        })
    )
    display.style.display = "flex"
    node.dataset.wrapEnabled = ""
}

// Autosize clones do not run Svelte actions, so refresh their display rows synchronously.
export function refreshWrappedLines(root: HTMLElement, options?: WrapOptions) {
    root.querySelectorAll<HTMLElement>(options?.enabled ? ".break:not(.chords)" : "[data-wrap-options]").forEach((node) => {
        if (options?.enabled) node.dataset.wrapOptions = JSON.stringify(options)
        renderWrappedLine(node, JSON.parse(node.dataset.wrapOptions!))
    })
}

export function wrappedLines(node: HTMLElement, initial: WrapOptions) {
    let options = initial
    let frame = 0
    let destroyed = false
    const observe = () => observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true })
    const render = () => {
        frame = 0
        if (!options.enabled || destroyed) return
        observer.disconnect()
        renderWrappedLine(node, options)
        observe()
    }
    const schedule = () => {
        if (options.enabled && !destroyed && !frame) frame = requestAnimationFrame(render)
    }
    const observer = new MutationObserver(schedule)
    const resize = new ResizeObserver(schedule)
    const fonts = node.ownerDocument.fonts
    const update = (next: WrapOptions) => {
        options = next
        observer.disconnect()
        resize.disconnect()
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        if (!options.enabled) {
            delete node.dataset.wrapOptions
            delete node.dataset.wrapEnabled
            node.querySelector(":scope > [data-wrap-rows]")?.remove()
            return
        }
        node.dataset.wrapOptions = JSON.stringify(options)
        render()
        resize.observe(node)
    }
    fonts?.addEventListener("loadingdone", schedule)
    fonts?.ready.then(schedule)
    update(initial)
    return {
        update,
        destroy() {
            destroyed = true
            observer.disconnect()
            resize.disconnect()
            fonts?.removeEventListener("loadingdone", schedule)
            if (frame) cancelAnimationFrame(frame)
        }
    }
}
