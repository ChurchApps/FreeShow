import type { Resolution } from "../../../types/Settings"

// contain = width & height
// fill = stretch
// fit = zoom out
// cover = zoom in
export function getStyleResolution(resolution: Resolution, width: any, height: any, fit: "contain" | "fit" | "fill" | "cover" = "contain", { zoom = 0 } = {}): string {
    let style: any = { width: null, height: null }

    if (fit === "fill") style = { width: "100%", height: "100%" }
    else if (fit === "cover" || fit === "contain") {
        if (resolution.width < resolution.height) style.height = "100%"
        else style.width = "100%"
        if (resolution.width && resolution.width === resolution.height && height < width) style = { width: null, height: "100%" }
    } else {
        if (width / height > resolution.width / resolution.height) {
            if (fit === "fit") style = { width: null, height: "100%" }
            else style.height = resolution.height + "px"
        } else {
            if (fit === "fit") style.width = "100%"
            else style.width = resolution.width + "px"
        }
    }

    console.log(style)

    // zoom
    if (zoom) {
        if (style.width) {
            let end = style.width.replace(/[0-9]/g, "")
            let width = style.width.replace(/\D+/g, "")
            style.width = width / zoom + end
        }
        if (style.height) {
            let end = style.height.replace(/[0-9]/g, "")
            let height = style.height.replace(/\D+/g, "")
            style.height = height / zoom + end
        }
    }

    return style.width ? "width: " + style.width + ";" : "" + style.height ? "height: " + style.height + ";" : ""
}
