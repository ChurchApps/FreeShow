import type { StringObject } from "../../../types/Main"

const cache = new Map<string, StringObject>()
const DONT_REPLACE = ["color", "background", "text-decoration", "text-transform", "text-shadow", "box-shadow", "font-family", "transform"]

export const getStyles = (str: string | null | undefined, removeTxt = false): StringObject => {
    if (!str) return {}

    const cacheKey = `${removeTxt ? 1 : 0}_${str}`
    const cached = cache.get(cacheKey)
    if (cached) return { ...cached }

    const styles: StringObject = {}

    str.split(";").forEach((s) => {
        const colon = s.indexOf(":")
        if (colon === -1) return

        const key = s.slice(0, colon).trim()
        let style = s.slice(colon + 1).trim()

        if (removeTxt && !DONT_REPLACE.some((d) => key.includes(d))) {
            const num = removeText(style)
            if (num) style = num
        }

        if (key === "transform") Object.assign(styles, getFilters(style))
        styles[key] = style
    })

    if (cache.size > 1000) cache.clear()
    cache.set(cacheKey, styles)

    return { ...styles }
}

export function getFilters(filter: string | undefined) {
    if (!filter) return {}

    const styles: StringObject = {}
    filter.split(" ").forEach((s) => {
        const match = s.match(/^([^(]+)\(([^)]+)\)/)
        if (match) styles[match[1].trim()] = removeText(match[2].trim())
    })

    return styles
}

export function removeText(value: string): string {
    return value ? value.replace(/[^0-9.-]/g, "") : ""
}

export function getItemStyle(style: string | undefined, isCropped = false): string {
    if (!style) return ""
    if (isCropped) {
        return style
            .split(";")
            .filter((s) => {
                const k = s.split(":")[0]?.trim()
                return k && !k.startsWith("border") && k !== "box-shadow"
            })
            .join(";")
    }
    return style.includes("border-width:") && !style.includes("border-style:") ? `${style};border-style: solid;` : style
}
