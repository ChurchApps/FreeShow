import { get } from "svelte/store"
import type { Popups } from "../../../../types/Main"
import type { DrawerTabIds } from "../../../../types/Tabs"
import { activeDrawerTab, activePage, activePopup, drawer, drawerTabsData } from "../../../stores"
import { hexToRgb, splitRgb } from "../../helpers/color"
import type { EditInput } from "../values/boxes"

export function getOriginalValue(boxEdit: { [key: string]: EditInput[] }, key: string): string {
    const values: EditInput[] = []
    Object.values(boxEdit).forEach((inputs) => {
        inputs.forEach((input) => {
            if (input.key === key) values.push(input)
        })
    })

    if (!values.length) return ""
    if (values.length === 1) return (values[0].value || "").toString()
    return values
        .sort((a, b) => ((a.valueIndex || 0) > (b.valueIndex || 0) ? 1 : -1))
        .map((a) => a.value + (a.extension || ""))
        .join(" ")
}

export function removeExtension(value: string | number | boolean, extension: string | undefined): string | number | boolean {
    if (!extension || typeof value !== "string") return value
    return value.replace(/[^0-9.-]/g, "")
}

// export function editValue(id: "box" | "media", key: string, value) {

// }

// BACKGROUND COLOR (with opacity)

export function setBackgroundColor(input: any, data: any) {
    const backgroundColor = input.key === "background-color" ? input.value || "" : data["background-color"] || "rgb(0 0 0);"
    const rgb = backgroundColor.includes("rgb") ? splitRgb(backgroundColor) : hexToRgb(backgroundColor)
    const opacity = input.id === "background-opacity" ? input.value : getOldOpacity(data)
    const newColor = "rgb(" + [rgb.r, rgb.g, rgb.b].join(" ") + " / " + opacity + ");"

    input.key = "background-color"
    input.value = newColor

    return input
}

function getOldOpacity(data) {
    const backgroundValue = data["background-color"] || ""
    if (!backgroundValue.includes("rgb")) return 1

    const rgb = splitRgb(backgroundValue)
    return rgb.a
}

export function getBackgroundOpacity(itemEditValues, data) {
    const backgroundValue = data["background-color"] || ""
    const boIndex = itemEditValues.default.findIndex((a) => a.id === "background-opacity")
    if (boIndex < 0) return itemEditValues

    if (!backgroundValue.includes("rgb")) {
        itemEditValues.default[boIndex].value = 1
        return itemEditValues
    }

    const rgb = splitRgb(backgroundValue)
    itemEditValues.default[boIndex].value = rgb.a

    return itemEditValues
}

const drawerPages: { [key: string]: DrawerTabIds } = {
    online: "media",
    screens: "media",
    cameras: "media",

    microphones: "audio",
    audio_streams: "audio",

    actions: "functions",
    timer: "functions",
    variables: "functions",
    triggers: "functions",
}
export function openDrawer(id: string, openPopup = false) {
    activePage.set("show")

    // set sub tab
    const drawerPageId = drawerPages[id]
    if (!drawerPageId) return

    drawerTabsData.update((a) => {
        if (!a[drawerPageId]) a[drawerPageId] = { enabled: true, activeSubTab: null }
        a[drawerPageId].activeSubTab = id

        return a
    })

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
