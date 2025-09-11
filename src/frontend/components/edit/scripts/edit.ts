
import { get } from "svelte/store"
import type { Popups } from "../../../../types/Main"
import type { DrawerTabIds } from "../../../../types/Tabs"
import { activeDrawerTab, activePage, activePopup, drawer, drawerTabsData } from "../../../stores"
import { hexToRgb } from "../../helpers/color"

// COLOR

// Add opacity to each color stop in the gradient (hex, rgb, and rgba)
export function addOpacityToGradient(gradientValue: string, alpha: number) {
    return gradientValue.replace(
        /(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*\d*\.?\d+)?\s*\))/g,
        (color) => {
            if (color.startsWith("#")) {
                const rgb = hexToRgb(color)
                if (rgb) {
                    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
                }
            }
            // Match rgb or rgba and replace with new alpha
            const nums = color.match(/\d+\.?\d*/g)
            if (nums && nums.length >= 3) {
                return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${alpha})`
            }
            return color
        }
    )
}

// Get the first rgb(a) alpha value from a gradient string
export function getGradientOpacity(gradientValue: string): number {
    // Match rgba(...) or rgb(...)
    const match = gradientValue.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*(\d*\.?\d+))?\s*\)/)
    if (match?.[1] === undefined) return 1
    return parseFloat(match[1])
}

// valueIndex splits
export function parseShadowValue(value): string[] {
    // Handles: text-shadow: 10px 10px 4px #ff0000 65 54 / 0.47
    // Returns: [10px, 10px, 4px, #ff0000, 65, 54, /, 0.47]
    if (!value) return []

    // Regex for color (hex, rgb[a], hsl[a], named)
    const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|\b[a-zA-Z]+\b)/
    const match = value.match(colorRegex)
    if (!match) return value.split(/\s+/).filter(Boolean)

    const color = match[0]
    const before = value.slice(0, match.index).trim()
    const after = value.slice(match.index + color.length).trim()

    let arr: string[] = []
    if (before) arr = arr.concat(before.split(/\s+/).filter(Boolean))
    arr.push(color)
    if (after) arr = arr.concat(after.split(/\s+/).filter(Boolean))

    return arr
}

// DRAWER

const drawerPages: { [key: string]: DrawerTabIds } = {
    shows: "shows",
    media: "media",
    audio: "audio",
    overlays: "overlays",
    effects: "overlays",
    templates: "templates",
    scripture: "scripture",
    calendar: "calendar",
    functions: "functions",

    online: "media",
    screens: "media",
    cameras: "media",

    microphones: "audio",
    audio_streams: "audio",

    action: "calendar",

    actions: "functions",
    timer: "functions",
    variables: "functions",
    triggers: "functions"
}
export function openDrawer(id: string, openPopup = false) {
    activePage.set("show")

    // set sub tab
    const drawerPageId = drawerPages[id]
    if (!drawerPageId) return

    // first subtab
    if (id === "calendar") id = "event"
    else if (id === "functions") id = "actions"
    else if (id === "scripture")
        id = "" // Object.keys(get(scriptures))[0]
    else if (id === drawerPageId) id = "all"

    if (id) {
        drawerTabsData.update((a) => {
            if (!a[drawerPageId]) a[drawerPageId] = { enabled: true, activeSubTab: null }
            a[drawerPageId].activeSubTab = id

            return a
        })
    }

    activeDrawerTab.set(drawerPageId)

    // open drawer
    if (get(drawer).height <= 40) {
        drawer.set({ height: 300, stored: get(drawer).height })
    }

    if (!openPopup) return

    // create new popup
    let popupId = id
    if (popupId === "variables") popupId = "variable"
    activePopup.set(popupId as Popups)
}

// ADD NEW

export const newDropdown = {
    "new.timer": () => {
        openDrawer("timer", true)
    }
}