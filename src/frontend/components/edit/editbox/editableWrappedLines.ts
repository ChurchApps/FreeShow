import { copyPart, measureRows } from "../../slide/wrappedLines"
import type { WrapOptions } from "../../slide/wrappedLines"

let nextId = 0

// Paint outside contenteditable: neither display nodes nor derived styles enter saved text or native undo.
export function editableWrappedLines(node: HTMLElement, initial: WrapOptions) {
    const id = String(++nextId)
    const doc = node.ownerDocument
    const layer = doc.createElement("div")
    const sheet = doc.createElement("style")
    sheet.dataset.editWrapStyle = ""
    layer.dataset.editWrapLayer = ""
    layer.setAttribute("aria-hidden", "true")
    layer.inert = true
    layer.style.cssText = "position:absolute;inset:0;pointer-events:none;user-select:none;"
    let options = initial
    let frame = 0

    function clear() {
        delete node.dataset.editWrap
        sheet.remove()
        layer.remove()
    }

    function draw() {
        frame = 0
        const host = node.parentElement
        if (!options.enabled || !host || !node.clientWidth) {
            clear()
            return
        }

        node.dataset.editWrap = id
        if (layer.parentElement !== host) host.prepend(layer, sheet)
        sheet.textContent = ""
        layer.replaceChildren()
        const scale = host.getBoundingClientRect().width / host.offsetWidth || 1
        const gap = Math.max(0, Number(options.gap) || 0)
        const selector = `[data-edit-wrap="${id}"]`
        const lines = Array.from(node.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains("break"))
        const rules = [`${selector}{position:relative;z-index:1;}`, `${selector}>.break{background:transparent!important;border-radius:0!important;margin-top:${-gap / 2}px;margin-bottom:${-gap / 2}px;}`]

        // Add only the requested gap to native line boxes, then remove outer half-leading.
        // The editable HTML and its inline styles remain unchanged.
        lines.forEach((line, lineIndex) => {
            Array.from(line.children).forEach((source, textIndex) => {
                if (!(source instanceof HTMLElement)) return
                const style = getComputedStyle(source)
                let height = parseFloat(style.lineHeight)
                if (!Number.isFinite(height)) {
                    const probe = doc.createElement("div")
                    const span = doc.createElement("span")
                    probe.style.cssText = "position:absolute;font-size:0;line-height:0;visibility:hidden;"
                    span.style.font = style.font
                    span.style.lineHeight = "normal"
                    span.textContent = "M"
                    probe.append(span)
                    layer.append(probe)
                    height = probe.getBoundingClientRect().height / scale
                    probe.remove()
                }
                rules.push(`${selector}>.break:nth-child(${lineIndex + 1})>:nth-child(${textIndex + 1}){line-height:${height + gap}px!important;}`)
            })
        })

        // Capture original typography before the derived line-height rules take effect.
        const typography = new Map<HTMLElement, { fontSize: string; lineHeight: string }>()
        lines.forEach((line) =>
            Array.from(line.children).forEach((source) => {
                if (!(source instanceof HTMLElement)) return
                const style = getComputedStyle(source)
                typography.set(source, {
                    fontSize: style.fontSize,
                    lineHeight: style.lineHeight
                })
            })
        )
        sheet.textContent = rules.join("\n")
        const hostRect = host.getBoundingClientRect()

        lines.forEach((line) => {
            const rows = measureRows(line)
            rows.forEach((row) => {
                if (!row.parts.length) return
                const box = doc.createElement("div")
                box.style.cssText = "position:absolute;font-size:0;line-height:normal;white-space:pre-wrap;text-wrap:nowrap;"
                box.style.width = `${line.clientWidth}px`
                box.style.textAlign = getComputedStyle(line).textAlign
                row.parts.forEach((part) => {
                    const copy = copyPart(part)
                    const style = typography.get(part.source)!
                    copy.style.fontSize = style.fontSize
                    copy.style.lineHeight = style.lineHeight
                    copy.style.visibility = "hidden"
                    box.append(copy)
                })
                if (!box.textContent?.replace(/[\u200b-\u200d\u2060\ufeff]/g, "").trim()) return
                layer.append(box)
                const measured = measureRows(box)[0]
                if (!measured) {
                    box.remove()
                    return
                }
                const bounds = box.getBoundingClientRect()
                box.style.top = `${(row.top - measured.top + bounds.top - hostRect.top) / scale}px`
                box.style.left = `${(line.getBoundingClientRect().left - hostRect.left) / scale}px`
                box.style.height = `${bounds.height / scale}px`
                box.style.background = options.background || ""
                box.style.borderRadius = `${Math.max(0, Number(options.radius) || 0)}px`
                box.dataset.editWrapRow = ""
            })
        })
    }

    function schedule() {
        if (!frame) frame = requestAnimationFrame(draw)
    }
    const resize = new ResizeObserver(schedule)
    resize.observe(node)
    const mutations = new MutationObserver((records) => {
        if (records.some((record) => record.target !== node || record.attributeName !== "data-edit-wrap")) schedule()
    })
    mutations.observe(node, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
    })
    doc.fonts?.addEventListener("loadingdone", schedule)
    schedule()

    return {
        update(next: WrapOptions) {
            options = next
            schedule()
        },
        destroy() {
            cancelAnimationFrame(frame)
            resize.disconnect()
            mutations.disconnect()
            doc.fonts?.removeEventListener("loadingdone", schedule)
            clear()
        }
    }
}
