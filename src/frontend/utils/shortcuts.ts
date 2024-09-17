import { get } from "svelte/store"
import { IMPORT, OUTPUT } from "../../types/Channels"
import type { ShowType } from "../../types/Show"
import type { TopViews } from "../../types/Tabs"
import { menuClick } from "../components/context/menuClick"
import { addItem } from "../components/edit/scripts/itemHelpers"
import { clearAudio, playAudio } from "../components/helpers/audio"
import { copy, cut, deleteAction, duplicate, paste, selectAll } from "../components/helpers/clipboard"
import { history, redo, undo } from "../components/helpers/history"
import { displayOutputs, getActiveOutputs, refreshOut, setOutput } from "../components/helpers/output"
import { nextSlideIndividual, previousSlideIndividual } from "../components/helpers/showActions"
import { clearAll, clearBackground, clearSlide } from "../components/output/clear"
import { addSection } from "../converters/project"
import {
    activeDrawerTab,
    activeEdit,
    activeFocus,
    activePage,
    activePopup,
    activeProject,
    currentWindow,
    drawer,
    focusedArea,
    focusMode,
    guideActive,
    os,
    outLocked,
    outputs,
    projects,
    quickSearchActive,
    refreshEditSlide,
    selected,
    showsCache,
    special,
    volume,
} from "../stores"
import { drawerTabs } from "../values/tabs"
import { activeShow } from "./../stores"
import { hideDisplay, togglePanels } from "./common"
import { send } from "./request"
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
    n: () => createNew(),
    h: () => activePopup.set("history"),
    m: () => volume.set(get(volume) ? 0 : 1),
    o: () => displayOutputs(),
    s: () => save(),
    t: () => togglePanels(),
    y: () => redo(),
    z: () => undo(),
    Z: () => redo(),
    "?": () => activePopup.set("shortcuts"),
}

export const disablePopupClose = ["initialize", "cloud_method"]
const keys: any = {
    Escape: () => {
        if (get(quickSearchActive)) {
            quickSearchActive.set(false)
            return
        }

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

    if (get(guideActive)) return

    // clicking e.g. "Show" tab button will focus that making number tab change not work
    if (document.activeElement?.nodeName === "BUTTON") (document.activeElement as any).blur()

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

    // change tab with number keys
    if (document.activeElement === document.body && !get(special).numberKeys && Object.keys(menus).includes((e.key - 1).toString())) {
        let menu = menus[e.key - 1]
        activePage.set(menu)

        // open edit
        if (menu === "edit" && !get(activeEdit)?.id) {
            activeEdit.set({ slide: 0, items: [], showId: get(activeShow)?.id })
        }
    }

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
        if (!get(special).disablePresenterControllerKeys) nextSlideIndividual(null)
        else setOutput("transition", null)
    },
    PageDown: (e: any) => {
        let currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(showsCache)[currentShow?.id || ""] && get(outputs)[getActiveOutputs(get(outputs), true, true, true)[0]]?.out?.slide?.type !== "ppt") return
        if (get(special).disablePresenterControllerKeys) return

        e.preventDefault()
        nextSlideIndividual(e)
    },
    PageUp: (e: any) => {
        let currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(showsCache)[currentShow?.id || ""] && get(outputs)[getActiveOutputs(get(outputs), true, true, true)[0]]?.out?.slide?.type !== "ppt") return
        if (get(special).disablePresenterControllerKeys) return

        e.preventDefault()
        previousSlideIndividual(e)
    },

    ArrowRight: (e: any) => {
        // if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(outLocked) || e.ctrlKey || e.metaKey) return
        if (get(activeEdit).items.length) return

        nextSlideIndividual(e)
    },
    ArrowLeft: (e: any) => {
        // if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(outLocked) || e.ctrlKey || e.metaKey) return
        if (get(activeEdit).items.length) return

        previousSlideIndividual(e)
    },
    " ": (e: any) => {
        let currentShow: any = get(focusMode) ? get(activeFocus) : get(activeShow)
        console.log(currentShow)

        if (currentShow?.type === "ppt") return
        if (currentShow?.type === "pdf") {
            e.preventDefault()
            return nextSlideIndividual(e, true)
        }
        if (!get(showsCache)[currentShow?.id || ""]) {
            e.preventDefault()
            return playMedia(e)
        }

        let allActiveOutputs = getActiveOutputs(get(outputs), true, true, true)
        let outputId = allActiveOutputs[0]
        let currentOutput: any = outputId ? get(outputs)[outputId] || {} : {}

        e.preventDefault()
        if (currentOutput.out?.slide?.id !== currentShow?.id || (currentShow && currentOutput.out?.slide?.layout !== get(showsCache)[currentShow.id || ""].settings.activeLayout)) nextSlideIndividual(e, true)
        else {
            if (e.shiftKey) previousSlideIndividual(e)
            else nextSlideIndividual(e)
        }
    },
    Home: (e: any) => {
        let currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(showsCache)[currentShow?.id || ""]) return
        if (get(special).disablePresenterControllerKeys) return

        e.preventDefault()
        nextSlideIndividual(e, true)
    },
    End: (e: any) => {
        let currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(showsCache)[currentShow?.id || ""]) return
        if (get(special).disablePresenterControllerKeys) return

        e.preventDefault()
        nextSlideIndividual(e, false, true)
    },
}

// CTRL + N
function createNew() {
    let selectId = get(selected)?.id || get(focusedArea)

    if (selectId === "slide") history({ id: "SLIDES" }) // show
    else if (selectId === "show") addSection() // project
    else if (selectId.includes("category_")) {
        // if (selectId.includes("media") || selectId.includes("audio")) send(MAIN, ["OPEN_FOLDER"], { channel: id, title, path })
        if (selectId.includes("scripture")) activePopup.set("import_scripture")
        else if (selectId.includes("calendar")) send(IMPORT, ["calendar"], { format: { name: "Calendar", extensions: ["ics"] } })
        else history({ id: "UPDATE", location: { page: "drawer", id: selectId } })
    } else if (selectId === "overlay") history({ id: "UPDATE", location: { page: "drawer", id: "overlay" } })
    else if (selectId === "template") history({ id: "UPDATE", location: { page: "drawer", id: "template" } })
    else if (selectId === "global_timer") activePopup.set("timer")
    else if (["action", "variable", "trigger"].includes(selectId)) activePopup.set(selectId as any)
    else if (get(activePage) === "edit") addItem("text")
    else if (get(activePage) === "stage") history({ id: "UPDATE", location: { page: "stage", id: "stage" } })
    else {
        console.log("CREATE NEW", selectId)
        activePopup.set("show")
    }
}

function playMedia(e: Event) {
    if (get(outLocked) || !get(focusMode)) return
    let projectItem: any = get(projects)[get(activeProject) || ""]?.shows?.[get(activeFocus).index!]

    let type: ShowType = projectItem.type
    if (!type) return
    e.preventDefault()

    if (type === "video" || type === "image" || type === "player") {
        // , ...mediaStyle
        setOutput("background", { type: projectItem.type, path: projectItem.id, muted: false, loop: false })
    } else if (type === "audio") {
        playAudio({ path: projectItem.id, name: projectItem.name })
    }
}
