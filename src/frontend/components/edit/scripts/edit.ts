import { get } from "svelte/store"
import type { Popups } from "../../../../types/Main"
import type { DrawerTabIds } from "../../../../types/Tabs"
import { activeDrawerTab, activePage, activePopup, drawer, drawerTabsData } from "../../../stores"
import { hexToRgb, splitRgb } from "../../helpers/color"
import type { EditInput } from "../values/boxes"

export function getOriginalValue(boxEdit: { [key: string]: EditInput[] }, key: string): string {
    let values: EditInput[] = []
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
    let backgroundColor = input.key === "background-color" ? input.value || "" : data["background-color"] || "rgb(0 0 0);"
    let rgb = backgroundColor.includes("rgb") ? splitRgb(backgroundColor) : hexToRgb(backgroundColor)
    let opacity = input.id === "background-opacity" ? input.value : getOldOpacity(data)
    let newColor = "rgb(" + [rgb.r, rgb.g, rgb.b].join(" ") + " / " + opacity + ");"

    input.key = "background-color"
    input.value = newColor

    return input
}

function getOldOpacity(data) {
    let backgroundValue = data["background-color"] || ""
    if (!backgroundValue.includes("rgb")) return 1

    let rgb = splitRgb(backgroundValue)
    return rgb.a
}

export function getBackgroundOpacity(itemEditValues, data) {
    let backgroundValue = data["background-color"] || ""
    let boIndex = itemEditValues.default.findIndex((a) => a.id === "background-opacity")
    if (boIndex < 0) return itemEditValues

    if (!backgroundValue.includes("rgb")) {
        itemEditValues.default[boIndex].value = 1
        return itemEditValues
    }

    let rgb = splitRgb(backgroundValue)
    itemEditValues.default[boIndex].value = rgb.a

    return itemEditValues
}

const drawerPages: { [key: string]: DrawerTabIds } = {
    timer: "functions",
    variables: "functions",
}
export function openDrawer(id: string) {
    activePage.set("show")

    // set sub tab
    let drawerPageId = drawerPages[id]
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

    // create new popup
    let popupId = id
    if (popupId === "variables") popupId = "variable"
    activePopup.set(popupId as Popups)
}
