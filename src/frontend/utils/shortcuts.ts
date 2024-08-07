import { get } from "svelte/store"
import type { TopViews } from "../../types/Tabs"
import { menuClick } from "../components/context/menuClick"
import { copy, cut, deleteAction, duplicate, paste, selectAll } from "../components/helpers/clipboard"
import { redo, undo } from "../components/helpers/history"
import { displayOutputs, getActiveOutputs, refreshOut, setOutput } from "../components/helpers/output"
import { activeDrawerTab, activePage, activePopup, activeShow, currentWindow, drawer, os, outLocked, outputs, refreshEditSlide, selected, showsCache, special, volume } from "../stores"
import { drawerTabs } from "../values/tabs"
import { hideDisplay, togglePanels } from "./common"
import { save } from "./save"
import { send } from "./request"
import { OUTPUT } from "../../types/Channels"
import { clearAll, clearBackground, clearSlide } from "../components/output/clear"
import { clearAudio } from "../components/helpers/audio"
import { nextSlide, previousSlide } from "../components/helpers/showActions"

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
        let currentOut = get(outputs)[Object.keys(get(outputs))[0]]?.out || {}
        let contentDisplayed = currentOut.slide?.id || currentOut.background?.path || currentOut.background?.id || currentOut.overlays?.length
        if (e.key === "Escape" && !contentDisplayed) return hideDisplay()

        // allow custom shortcuts through main display (could be useful in some cases when you need output over the main app)
        const allowThroughWindow = ["Escape", "ArrowRight", "ArrowLeft", " ", "PageDown", "PageUp", "Home", "End", ".", "F1", "F2", "F3", "F4", "F5"]
        if (allowThroughWindow.includes(e.key)) send(OUTPUT, ["MAIN_SHORTCUT"], { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey })

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

///// PREVIEW /////

export const previewCtrlShortcuts: any = {
    l: () => outLocked.set(!get(outLocked)),
    r: () => {
        if (!get(outLocked)) refreshOut()
    },
}

export const previewShortcuts: any = {
    // presenter controller keys
    Escape: () => {
        // WIP if (allCleared) fullscreen = false

        setTimeout(clearAll)
    },
    ".": () => {
        if (!get(special).disablePresenterControllerKeys) clearAll()
    },
    F1: () => {
        if (!get(outLocked)) clearBackground()
    },
    F2: () => {
        if (get(outLocked) || get(selected).id) return false
        if (get(special).disablePresenterControllerKeys) return false

        clearSlide()
        return true
    },
    F3: () => {
        if (!get(outLocked)) setOutput("overlays", [])
    },
    F4: () => {
        if (!get(outLocked)) clearAudio()
    },
    F5: () => {
        if (!get(special).disablePresenterControllerKeys) nextSlide(null)
        else setOutput("transition", null)
    },
    PageDown: (e: any) => {
        if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(special).disablePresenterControllerKeys) return

        e.preventDefault()
        nextSlide(e)
    },
    PageUp: (e: any) => {
        if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(special).disablePresenterControllerKeys) return

        e.preventDefault()
        previousSlide(e)
    },

    ArrowRight: (e: any) => {
        // if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(outLocked) || e.ctrlKey || e.metaKey) return
        nextSlide(e)
    },
    ArrowLeft: (e: any) => {
        // if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(outLocked) || e.ctrlKey || e.metaKey) return
        previousSlide(e)
    },
    " ": (e: any) => {
        if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        e.preventDefault()

        let allActiveOutputs = getActiveOutputs(get(outputs), true, true, true)
        let outputId = allActiveOutputs[0]
        let currentOutput: any = outputId ? get(outputs)[outputId] || {} : {}

        if (currentOutput.out?.slide?.id !== get(activeShow)?.id || (get(activeShow) && currentOutput.out?.slide?.layout !== get(showsCache)[get(activeShow)?.id || ""].settings.activeLayout)) nextSlide(e, true)
        else {
            if (e.shiftKey) previousSlide(e)
            else nextSlide(e)
        }
    },
    Home: (e: any) => {
        if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(special).disablePresenterControllerKeys) return

        e.preventDefault()
        nextSlide(e, true)
    },
    End: (e: any) => {
        if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(special).disablePresenterControllerKeys) return

        e.preventDefault()
        nextSlide(e, false, true)
    },
}
