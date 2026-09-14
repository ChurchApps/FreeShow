import { getStyles } from "../../helpers/style"

function parseInset(value: string) {
    const match = value.match(/inset\(([^)]*)\)/i)
    if (!match) return null

    const [offsetsPart = "", roundPart = "0px"] = match[1].trim().split(/\s+round\s+/)
    const nums = offsetsPart.match(/[-0-9.]+/g)?.map(Number) || [0, 0, 0, 0]
    const [t, r = t, b = t, l = r] = nums.length === 1 ? [nums[0], nums[0], nums[0], nums[0]] : nums.length === 2 ? [nums[0], nums[1], nums[0], nums[1]] : nums

    return { t, r, b, l, radius: roundPart.trim() }
}

export function parseShapeOutsideValue(value: string | undefined): string[] {
    if (!value) return []

    const inset = parseInset(value)
    if (inset) {
        const { t, r, b, l, radius } = inset
        const sizeVal = Math.max(0, (100 - t - b) / 2)
        const topVal = (100 + t - b) / 2
        const leftVal = (100 + l - r) / 2

        let rVal = 0
        const roundNum = parseFloat(radius.match(/[-0-9.]+/)?.[0] || "0")
        if (radius.includes("px")) {
            const hPx = (sizeVal / 100) * 1080
            if (hPx > 0) rVal = (roundNum / hPx) * 50
        } else if (sizeVal > 0) {
            rVal = (roundNum / sizeVal) * 50
        }

        const computedR = Math.min(50, Math.max(0, Math.round(rVal)))
        return [`${Math.round(sizeVal)}%`, `${Math.round(topVal)}%`, `${Math.round(leftVal)}%`, `${computedR}%`]
    }

    return []
}

export function getShapeOutsideStyle(size: any, top: any, left: any, radius: any, itemStyle?: string): string {
    const s = Number.isFinite(parseFloat(size)) ? parseFloat(size) : 0
    if (s <= 0) return ""

    const t = Number.isFinite(parseFloat(top)) ? parseFloat(top) : 0
    const l = Number.isFinite(parseFloat(left)) ? parseFloat(left) : 100
    const r = Number.isFinite(parseFloat(radius)) ? parseFloat(radius) : 0

    const styles = getStyles(itemStyle)
    const wPx = styles.width ? parseFloat(styles.width) * (styles.width.includes("%") ? 19.2 : 1) : 1920
    const hPx = styles.height ? parseFloat(styles.height) * (styles.height.includes("%") ? 10.8 : 1) : 1080
    const ar = hPx > 0 ? wPx / hPx : 16 / 9

    const halfH = s
    const halfW = ar > 0 ? s / ar : s

    const offTop = +(t - halfH).toFixed(2)
    const offRight = +(100 - l - halfW).toFixed(2)
    const offBottom = +(100 - t - halfH).toFixed(2)
    const offLeft = +(l - halfW).toFixed(2)

    const radiusPx = ((r / 50) * (halfH / 100) * hPx).toFixed(1)
    return `inset(${offTop}% ${offRight}% ${offBottom}% ${offLeft}% round ${radiusPx}px)`
}

export function getShapeGuideStyle(str: string | undefined): string | null {
    if (!str) return null
    const inset = parseInset(str)
    if (!inset) return null

    const { t, r, b, l, radius } = inset
    return `position: absolute; top: ${t}%; right: ${r}%; bottom: ${b}%; left: ${l}%; border-radius: ${radius}; border: 3px dashed #ff3b30; background: transparent; pointer-events: none; z-index: 100; box-sizing: border-box;`
}

export function getShapeFloatSide(str: string | undefined): "left" | "right" {
    if (!str) return "right"
    const parsed = parseShapeOutsideValue(str)
    const leftVal = parseFloat(parsed[2])
    return Number.isFinite(leftVal) && leftVal < 50 ? "left" : "right"
}

export function calculateShapeVerticalOffset(elem: HTMLElement | null | undefined, alignStyle: string | undefined): number {
    if (!elem) return 0
    const alignY = getStyles(alignStyle)["align-items"] || "center"
    if (alignY === "flex-start") return 0

    let textH = 0
    elem.querySelectorAll(".break").forEach((b) => (textH += (b as HTMLElement).offsetHeight || 0))
    if (!textH) textH = elem.scrollHeight

    const diff = elem.clientHeight - textH
    return diff > 0 ? (alignY === "flex-end" ? Math.round(diff) : Math.round(diff / 2)) : 0
}
