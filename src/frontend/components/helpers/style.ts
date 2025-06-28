import type { StringObject } from "../../../types/Main"

export const getStyles = (str: string | null | undefined, removeTxt = false) => {
    let styles: StringObject = {}
    if (!str?.length) return styles

    str.split(";").forEach((s) => {
        if (!s.length) return

        const key: string = s.slice(0, s.indexOf(":")).trim()
        let style: string = s.slice(s.indexOf(":") + 1, s.length).trim()

        const replaced: string = removeText(style)

        const dontReplace: string[] = ["text-decoration", "text-transform", "text-shadow", "box-shadow", "font-family", "transform"]

        // remove text
        if (!key.includes("color") && !key.includes("background") && !dontReplace.includes(key) && removeTxt && style.length > replaced.length && replaced.length > 0) style = replaced

        if (key === "transform") styles = { ...styles, ...getFilters(style) }

        styles[key] = style
    })

    return styles
}

export function getFilters(filter: string) {
    const styles: StringObject = {}
    if (!filter) return styles

    filter.split(" ").forEach((s) => {
        if (s.length) {
            const key: string = s.slice(0, s.indexOf("(")).trim()
            let style: string = s.slice(s.indexOf("(") + 1, s.indexOf(")")).trim()
            style = removeText(style)
            styles[key] = style
        }
    })

    return styles
}

export function removeText(value: string): string {
    // .replace(/\D.+/g, "")
    return value?.replace(/[^0-9.-]/g, "")
}
