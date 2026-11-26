import { drawSettings } from "../../stores"
import { clone } from "../helpers/array"

export const DEFAULT_DRAW_SETTINGS: { [key: string]: any } = {
    focus: {
        color: "#000000",
        opacity: 0.8,
        size: 300,
        radius: 50,
        glow: true,
        hold: false
    },
    pointer: {
        color: "#FF0000",
        opacity: 0.8,
        size: 100,
        radius: 50,
        glow: false,
        hollow: true,
        hold: false
    },
    zoom: {
        size: 200,
        hold: false
    },
    particles: {
        color: "#1e1eb4",
        opacity: 0.8,
        size: 20,
        radius: 25,
        glow: false,
        hollow: false,
        hold: false
    },
    fill: {
        color: "#000000",
        opacity: 0.8,
        rainbow: false
    },
    paint: {
        color: "#ffffff",
        size: 10,
        straight: false,
        // not saved:
        threed: false,
        dots: false,
        link_to_slide: false,
        hold: true // always true
    }
}

export function ensureDrawSettings(tool: string) {
    const defaults = DEFAULT_DRAW_SETTINGS[tool]
    if (!defaults) return

    drawSettings.update((a) => {
        if (!a[tool]) a[tool] = clone(defaults)
        else {
            Object.entries(defaults).forEach(([key, value]) => {
                if (a[tool][key] === undefined) a[tool][key] = value
            })
        }
        return a
    })
}
