import { get } from "svelte/store"
import type { TopViews } from "../../types/Tabs"
import { menuClick } from "../components/context/menuClick"
import { copy, cut, deleteAction, duplicate, paste, selectAll } from "../components/helpers/clipboard"
import { redo, undo } from "../components/helpers/history"
import { displayOutputs } from "../components/helpers/output"
import { activeDrawerTab, activePage, activePopup, currentWindow, drawer, os, refreshEditSlide, selected, volume } from "../stores"
import { drawerTabs } from "../values/tabs"
import { hideDisplay, togglePanels } from "./common"
import { save } from "./save"

const menus: TopViews[] = ["show", "edit", "stage", "draw", "settings"]

const ctrlKeys: any = {
    a: () => selectAll(),
    c: () => copy(),
    v: () => paste(),
    // give time for drawer to not toggle
    d: () => setTimeout(() => duplicate(get(selected))),
    x: () => cut(),
    e: () => activePopup.set("export"),
    i: () => activePopup.set("import"),
    n: () => activePopup.set("show"),
    h: () => activePopup.set("history"),
    m: () => volume.set(get(volume) ? 0 : 1),
    o: () => displayOutputs(),
    q: () => togglePanels(),
    s: () => save(),
    y: () => redo(),
    z: () => undo(),
    Z: () => redo(),
    "?": () => activePopup.set("shortcuts"),
}

export const disablePopupClose = ["initialize", "cloud_method"]
const keys: any = {
    Escape: () => {
        let popupId = get(activePopup)

        // blur focused elements
        if (document.activeElement !== document.body) {
            ;(document.activeElement as HTMLElement).blur()

            if (!popupId && get(selected).id) setTimeout(() => selected.set({ id: null, data: [] }))
            return
        }

        if (disablePopupClose.includes(popupId || "")) return

        // give time so output don't clear also
        setTimeout(() => {
            if (popupId) activePopup.set(null)
            else if (get(selected).id) selected.set({ id: null, data: [] })
        })
    },
    Delete: () => deleteAction(get(selected), "remove"),
    Backspace: () => keys.Delete(),
    // give time so it don't clear slide
    F2: () => setTimeout(() => menuClick("rename", true, null, null, null, get(selected))),
}

export function keydown(e: any) {
    if (get(currentWindow) === "output") {
        if (e.key === "Escape") hideDisplay()
        return
    }

    if (e.ctrlKey || e.metaKey) {
        let drawerMenus: any[] = Object.keys(drawerTabs)
        if (document.activeElement === document.body && Object.keys(drawerMenus).includes((e.key - 1).toString())) {
            activeDrawerTab.set(drawerMenus[e.key - 1])
            // open drawer
            if (get(drawer).height < 300) drawer.set({ height: get(drawer).stored || 300, stored: null })
            return
        }

        // use default input shortcuts on supported devices
        const exeption = ["e", "i", "n", "o", "s", "a", "z", "Z", "y"]
        if ((e.key === "i" && document.activeElement?.closest(".editItem")) || (document.activeElement?.classList?.contains("edit") && !exeption.includes(e.key) && get(os).platform !== "darwin")) {
            return
        }

        const preventDefaults = ["z", "Z", "y"]
        if (ctrlKeys[e.key]) {
            ctrlKeys[e.key](e)
            if (preventDefaults.includes(e.key)) {
                e.preventDefault()
                if (get(activePage) === "edit") refreshEditSlide.set(true)
            }
        }
        return
    }

    if (e.altKey) return
    if (document.activeElement?.classList.contains("edit") && e.key !== "Escape") return
    if (document.activeElement === document.body && Object.keys(menus).includes((e.key - 1).toString())) activePage.set(menus[e.key - 1])

    if (keys[e.key]) {
        e.preventDefault()
        keys[e.key](e)
    }
}
