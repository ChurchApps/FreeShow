import type { Resolution } from "../../../types/Settings"

// contain = width & height
// fill = stretch
// fit = zoom out
// cover = zoom in
export function getStyleResolution(resolution: Resolution, width: number, height: number, fit: "contain" | "fit" | "fill" | "cover" = "contain", { zoom = 0 } = {}): string {
    let style = { width: "", height: "" }

    if (fit === "fill") style = { width: "100%", height: "100%" }
    else if (fit === "contain") {
        if (!resolution.width) style.height = "100%"
        else if (width / height > resolution.width / resolution.height) style.height = "100%"
        else style.width = "100%"
    } else if (fit === "cover") {
        if (!resolution.width) style.height = "100%"
        else if (width / height > resolution.width / resolution.height) style.width = "100%"
        else style.height = "100%"
    } else {
        if (width / height > resolution.width / resolution.height) {
            if (fit === "fit") style = { width: "", height: "100%" }
            else style.height = resolution.height + "px"
        } else {
            if (fit === "fit") style.width = "100%"
            else style.width = resolution.width + "px"
        }
    }

    // zoom
    if (zoom) {
        if (style.width) {
            const end = style.width.replace(/[0-9]/g, "")
            const width = Number(style.width.replace(/\D+/g, ""))
            style.width = width / zoom + end
        }
        if (style.height) {
            const end = style.height.replace(/[0-9]/g, "")
            const height = Number(style.height.replace(/\D+/g, ""))
            style.height = height / zoom + end
        }
    }

    return (style.width ? "width: " + style.width + ";" : "") + (style.height ? "height: " + style.height + ";" : "")
}
