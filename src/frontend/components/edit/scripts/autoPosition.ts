import { get } from "svelte/store"
import type { Item } from "../../../../types/Show"
import type { StageItem } from "../../../../types/Stage"
import { activePage, activeStage } from "../../../stores"
import { getFirstOutput, getOutputResolution } from "../../helpers/output"
import { getStyles, removeText } from "../../helpers/style"

// get a position on the slide that the user likely wants
// one that has available space with a bit of margin (not touching another item)
// first try if the same size as another item fits anywhere
// otherwise either width or height should be the same as another item
export function getLikelyPosition(currentItems: (Item | StageItem)[], defaultStyleStr: string) {
    const margin = 20
    const step = 20

    const outputId = (get(activePage) === "stage" ? get(activeStage).id : getFirstOutput()?.id) || ""
    const resolution = getOutputResolution(outputId)
    const SLIDE_WIDTH = resolution.width
    const SLIDE_HEIGHT = resolution.height
    const ALIGN_THRESHOLD = 80

    const rects = (currentItems || [])
        .map((it) => {
            const style = getStyles(it.style || defaultStyleStr)
            const left = Number(removeText(style.left || "0")) || 0
            const top = Number(removeText(style.top || "0")) || 0
            const width = Number(removeText(style.width || "0")) || 0
            const height = Number(removeText(style.height || "0")) || 0
            return { left, top, width, height }
        })
        .filter((r) => r.width > 0 && r.height > 0)

    const defaultStyle = getStyles(defaultStyleStr)
    const defaultW = Number(removeText(defaultStyle.width || "0")) || 300
    const defaultH = Number(removeText(defaultStyle.height || "0")) || 200

    function overlaps(x: number, y: number, w: number, h: number) {
        for (const r of rects) {
            if (!(x + w + margin <= r.left || x >= r.left + r.width + margin || y + h + margin <= r.top || y >= r.top + r.height + margin)) return true
        }
        return false
    }

    // merge overlapping intervals helper
    function mergeIntervals(intervals: { s: number; e: number }[]) {
        if (!intervals.length) return []
        intervals.sort((a, b) => a.s - b.s)
        const out = [intervals[0]]
        for (let i = 1; i < intervals.length; i++) {
            const cur = intervals[i]
            const last = out[out.length - 1]
            if (cur.s <= last.e + 1) last.e = Math.max(last.e, cur.e)
            else out.push(cur)
        }
        return out
    }

    // returns merged blocked intervals along orthogonal axis for a given span on primary axis
    function blockedIntervalsForSpan(spanStart: number, spanEnd: number, axis: "x" | "y") {
        const intervals: { s: number; e: number }[] = []
        for (const r of rects) {
            const rStart = axis === "x" ? r.top : r.left
            const rEnd = axis === "x" ? r.top + r.height : r.left + r.width
            if (!(spanEnd + margin <= rStart || spanStart >= rEnd + margin)) {
                const s = axis === "x" ? Math.max(0, r.left - margin) : Math.max(0, r.top - margin)
                const e = axis === "x" ? Math.min(SLIDE_WIDTH, r.left + r.width + margin) : Math.min(SLIDE_HEIGHT, r.top + r.height + margin)
                intervals.push({ s, e })
            }
        }
        return mergeIntervals(intervals)
    }

    const MIN_W = 80
    const MIN_H = 40

    // unified helper: given a candidate, try to place it, snap-align if close, or find orthogonal gaps and resize to fit
    function tryPlaceCandidate(c: { x: number; y: number; w: number; h: number; axis: "x" | "y" }, r: { left: number; top: number; width: number; height: number }) {
        const cx = Math.max(margin, Math.min(SLIDE_WIDTH - c.w - margin, c.x))
        const cy = Math.max(margin, Math.min(SLIDE_HEIGHT - c.h - margin, c.y))

        const centerXOfR = r.left + Math.floor(r.width / 2)
        const centerYOfR = r.top + Math.floor(r.height / 2)

        const centeredX = Math.abs(cx + c.w / 2 - centerXOfR) <= ALIGN_THRESHOLD
        const centeredY = Math.abs(cy + c.h / 2 - centerYOfR) <= ALIGN_THRESHOLD

        // snap to exact alignment if close
        if (centeredX) {
            const alignedY = Math.max(margin, Math.min(SLIDE_HEIGHT - c.h - margin, c.y))
            if (!overlaps(cx, alignedY, c.w, c.h)) return `top:${alignedY}px;left:${cx}px;height:${c.h}px;width:${c.w}px;`
        }
        if (centeredY) {
            const alignedX = Math.max(margin, Math.min(SLIDE_WIDTH - c.w - margin, c.x))
            if (!overlaps(alignedX, cy, c.w, c.h)) return `top:${cy}px;left:${alignedX}px;height:${c.h}px;width:${c.w}px;`
        }

        if (!overlaps(cx, cy, c.w, c.h)) return `top:${cy}px;left:${cx}px;height:${c.h}px;width:${c.w}px;`

        // find orthogonal gaps and try to resize to fit
        const blocked = blockedIntervalsForSpan(c.axis === "x" ? cy : cx, c.axis === "x" ? cy + c.h : cx + c.w, c.axis)
        let last = 0
        const gaps: { s: number; e: number }[] = []
        const limit = c.axis === "x" ? SLIDE_WIDTH : SLIDE_HEIGHT
        const MIN = c.axis === "x" ? MIN_W : MIN_H
        for (const b of blocked) {
            if (b.s - last > MIN) gaps.push({ s: last + margin, e: b.s - margin })
            last = Math.max(last, b.e)
        }
        if (limit - last > MIN) gaps.push({ s: last + margin, e: limit - margin })

        if (!gaps.length) return null

        // WIP this should prioritize the center of the other items instead of just aligning to the corners often

        const centerOfR = c.axis === "x" ? centerXOfR : centerYOfR
        gaps.sort((a, b) => Math.abs((a.s + a.e) / 2 - centerOfR) - Math.abs((b.s + b.e) / 2 - centerOfR))
        for (const g of gaps) {
            const span = g.e - g.s
            if (span >= MIN) {
                if (c.axis === "x") {
                    const newW = Math.min(c.w, span)
                    const left = Math.max(g.s, Math.min(g.e - newW, centerXOfR - Math.floor(newW / 2)))
                    return `top:${cy}px;left:${Math.round(left)}px;height:${c.h}px;width:${Math.round(newW)}px;`
                } else {
                    const newH = Math.min(c.h, span)
                    const top = Math.max(g.s, Math.min(g.e - newH, centerYOfR - Math.floor(newH / 2)))
                    return `top:${Math.round(top)}px;left:${cx}px;height:${Math.round(newH)}px;width:${c.w}px;`
                }
            }
        }

        return null
    }

    // Try placements around each existing item: below/above and left/right
    for (const r of rects) {
        const desiredW = r.width || defaultW
        const desiredH = r.height || defaultH
        const candidates = [
            { x: Math.round(r.left + (r.width - desiredW) / 2), y: r.top + r.height + margin, w: desiredW, h: desiredH, axis: "x" as const },
            { x: Math.round(r.left + (r.width - desiredW) / 2), y: r.top - desiredH - margin, w: desiredW, h: desiredH, axis: "x" as const },
            { x: r.left + r.width + margin, y: Math.round(r.top + (r.height - desiredH) / 2), w: desiredW, h: desiredH, axis: "y" as const },
            { x: r.left - desiredW - margin, y: Math.round(r.top + (r.height - desiredH) / 2), w: desiredW, h: desiredH, axis: "y" as const }
        ]

        for (const c of candidates) {
            const result = tryPlaceCandidate(c, r)
            if (result) return result
        }
    }

    // fallbacks: scan full slide for exact sizes, then width/height matches, then centered default, then any spot
    const sizes: { w: number; h: number }[] = []
    rects.forEach((r) => {
        const key = `${r.width}x${r.height}`
        if (!sizes.find((s) => `${s.w}x${s.h}` === key)) sizes.push({ w: r.width, h: r.height })
    })

    function findPositionForSize(w: number, h: number) {
        const maxX = Math.max(0, SLIDE_WIDTH - w - margin)
        const maxY = Math.max(0, SLIDE_HEIGHT - h - margin)
        for (let y = margin; y <= maxY; y += step) {
            for (let x = margin; x <= maxX; x += step) {
                if (!overlaps(x, y, w, h)) return { x, y }
            }
        }
        return null
    }

    for (const s of sizes) {
        const pos = findPositionForSize(s.w, s.h)
        if (pos) return `top:${pos.y}px;left:${pos.x}px;height:${s.h}px;width:${s.w}px;`
    }
    for (const s of sizes) {
        const pos = findPositionForSize(s.w, defaultH)
        if (pos) return `top:${pos.y}px;left:${pos.x}px;height:${defaultH}px;width:${s.w}px;`
    }
    for (const s of sizes) {
        const pos = findPositionForSize(defaultW, s.h)
        if (pos) return `top:${pos.y}px;left:${pos.x}px;height:${s.h}px;width:${defaultW}px;`
    }

    // try default centered, then any spot with default size
    const centerX = Math.max(margin, Math.floor((SLIDE_WIDTH - defaultW) / 2))
    const centerY = Math.max(margin, Math.floor((SLIDE_HEIGHT - defaultH) / 2))
    if (!overlaps(centerX, centerY, defaultW, defaultH)) return `top:${centerY}px;left:${centerX}px;height:${defaultH}px;width:${defaultW}px;`

    const fallback = findPositionForSize(defaultW, defaultH)
    if (fallback) return `top:${fallback.y}px;left:${fallback.x}px;height:${defaultH}px;width:${defaultW}px;`

    return defaultStyleStr
}
