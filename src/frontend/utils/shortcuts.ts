import { get } from "svelte/store"
import { OUTPUT } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import type { ShowType } from "../../types/Show"
import type { DrawerTabIds, TopViews } from "../../types/Tabs"
import { clearAudio } from "../audio/audioFading"
import { AudioPlayer } from "../audio/audioPlayer"
import { menuClick } from "../components/context/menuClick"
import { addItem } from "../components/edit/scripts/itemHelpers"
import { sortByName } from "../components/helpers/array"
import { copy, cut, deleteAction, duplicate, paste, selectAll } from "../components/helpers/clipboard"
import { history, redo, undo } from "../components/helpers/history"
import { getMediaStyle, getMediaType } from "../components/helpers/media"
import { getAllNormalOutputs, getFirstActiveOutput, refreshOut, setOutput, startFolderTimer, toggleOutputs } from "../components/helpers/output"
import { nextSlideIndividual, previousSlideIndividual } from "../components/helpers/showActions"
import { stopSlideRecording, updateSlideRecording } from "../components/helpers/slideRecording"
import { clearAll, clearBackground, clearSlide } from "../components/output/clear"
import { importFromClipboard } from "../converters/importHelpers"
import { addSection } from "../converters/project"
import { requestMain, sendMain } from "../IPC/main"
import { changeSlidesView } from "../show/slides"
import { activeDrawerTab, activeEdit, activeFocus, activePage, activePopup, activeSlideRecording, activeStage, contextActive, drawer, focusedArea, focusMode, guideActive, media, os, outLocked, outputs, outputSlideCache, quickSearchActive, refreshEditSlide, selected, showsCache, special, spellcheck, styles, topContextActive, videosData, volume } from "../stores"
import { audioExtensions, imageExtensions, videoExtensions } from "../values/extensions"
import { drawerTabs } from "../values/tabs"
import { activeShow } from "./../stores"
import { hideDisplay, isOutputWindow, togglePanels } from "./common"
import { send } from "./request"
import { save } from "./save"

const menus: TopViews[] = ["show", "edit", "stage", "draw", "settings"]

const ctrlKeys = {
    a: () => selectAll(),
    c: () => copy(),
    f: () => (shouldOpenReplace() ? activePopup.set("find_replace") : null),
    v: () => paste(),
    // give time for drawer to not toggle
    d: () => setTimeout(() => duplicate(get(selected))),
    x: () => cut(),
    e: () => activePopup.set("export"),
    i: (e: KeyboardEvent) => (e.altKey ? importFromClipboard() : activePopup.set("import")),
    n: () => createNew(),
    h: () => (get(activeDrawerTab) === "scripture" ? "" : activePopup.set("history")),
    m: () => volume.set(get(volume) ? 0 : 1),
    o: () => toggleOutputs(),
    s: () => save(),
    t: () => togglePanels(),
    y: () => redo(),
    z: () => undo(),
    Z: () => redo(),
    "?": () => activePopup.set("shortcuts")
}

const shiftCtrlKeys = {
    d: () => (get(activePage) === "show" && get(activeShow) && (get(activeShow)?.type || "show") === "show" ? activePopup.set("next_timer") : ""),
    // t: () => activePopup.set("translate"),
    f: () => menuClick("focus_mode"),
    n: () => activePopup.set("show"),
    v: () => changeSlidesView()
}

const altKeys = {
    Enter: () => (get(activePage) === "show" ? menuClick("cut_in_half", true, null, null, null, get(selected)) : null)
}

export const disablePopupClose = ["initialize", "cloud_method"]
const keys = {
    Escape: () => {
        // hide quick search
        if (get(quickSearchActive)) {
            quickSearchActive.set(false)
            return
        }

        // hide context menu
        if (get(contextActive) || get(topContextActive)) {
            // timeout so output does not clear
            setTimeout(() => {
                closeContextMenu()
                topContextActive.set(false)
            }, 20)
            return
        }

        const popupId = get(activePopup)

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
        }, 20)
    },
    Delete: () => (get(contextActive) ? null : deleteAction(get(selected), "remove")),
    Backspace: () => keys.Delete(),
    // give time so it don't clear slide
    F2: () => (get(focusMode) ? null : setTimeout(() => menuClick("rename", true, null, null, null, get(selected)))),
    // default menu "togglefullscreen" role not working in production on Windows/Linux
    F11: () => (get(os).platform !== "darwin" ? sendMain(Main.FULLSCREEN) : null)
}

export function shouldOpenReplace() {
    return get(activePage) === "edit" && get(activeEdit) && ((get(activeEdit).type || "show") === "show" || get(activeEdit).type === "overlay" || get(activeEdit).type === "template")
}

export function keydown(e: KeyboardEvent) {
    // don't prevent close event
    if (e.key === "F4" && e.altKey) return

    if (isOutputWindow()) {
        const currentOut = get(outputs)[Object.keys(get(outputs))[0]]?.out || {}
        const contentDisplayed = currentOut.slide?.id || currentOut.background?.path || currentOut.background?.id || currentOut.overlays?.length
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
        const drawerMenus = Object.keys(drawerTabs) as DrawerTabIds[]
        if (document.activeElement === document.body && Object.keys(drawerMenus).includes((Number(e.key) - 1).toString())) {
            activeDrawerTab.set(drawerMenus[Number(e.key) - 1])
            // open drawer
            if (get(drawer).height < 300) drawer.set({ height: get(drawer).stored || 300, stored: null })
            return
        }

        let key = e.key === "Z" ? e.key : e.key.toLowerCase()
        // include other special letter symbols (í=i)
        if (e.keyCode === 73) key = "i"

        // use default input shortcuts on supported devices
        const exeption = ["e", "i", "n", "o", "s", "a", "z", "Z", "y"]
        const macShortcutDebug = false
        if ((key === "i" && document.activeElement?.closest(".editItem")) || (document.activeElement?.classList?.contains("edit") && !exeption.includes(key) && get(os).platform !== "darwin" && !macShortcutDebug)) {
            return
        }

        if (e.shiftKey && shiftCtrlKeys[key]) {
            e.preventDefault()
            shiftCtrlKeys[key](e)
            return
        }

        const preventDefaults = ["z", "Z", "y"]
        if (ctrlKeys[key]) {
            ctrlKeys[key](e)
            if (preventDefaults.includes(key) || macShortcutDebug) {
                e.preventDefault()
                if (get(activePage) === "edit") refreshEditSlide.set(true)
            }
        }
        return
    }

    if (e.altKey) {
        if (altKeys[e.key]) {
            // if (document.activeElement?.classList.contains("edit") || document.activeElement?.tagName === "INPUT") return
            e.preventDefault()
            altKeys[e.key](e)
        }
        return
    }

    if (document.activeElement?.classList.contains("edit") && e.key !== "Escape") return

    // change tab with number keys
    if (document.activeElement === document.body && !get(special).numberKeys && Object.keys(menus).includes((Number(e.key) - 1).toString())) {
        const menu = menus[Number(e.key) - 1]
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

/// // PREVIEW /////

export const previewCtrlShortcuts = {
    l: () => outLocked.set(!get(outLocked)),
    r: () => {
        if (!get(outLocked)) refreshOut()
    }
}

export const previewShortcuts = {
    // presenter controller keys
    Escape: () => {
        // WIP if (allCleared) fullscreen = false

        setTimeout(clearAll)
    },
    ".": () => {
        if (!presentationControllersKeysDisabled()) clearAll()
    },
    F1: () => {
        if (!get(outLocked)) clearBackground()
    },
    F2: () => {
        // return if "rename" is selected
        if (get(outLocked) || (get(selected).id && get(selected).id !== "scripture" && !get(focusMode))) return false
        if (presentationControllersKeysDisabled()) return false

        clearSlide()
        return true
    },
    F3: () => {
        if (get(outLocked)) return
        setOutput("overlays", [])
        setOutput("effects", [])
    },
    F4: () => {
        if (!get(outLocked)) clearAudio("", { clearPlaylist: true, commonClear: true })
    },
    F5: () => {
        if (!presentationControllersKeysDisabled()) nextSlideIndividual(null)
        else setOutput("transition", null)
    },
    PageDown: (e: KeyboardEvent) => {
        // const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        // if (!get(showsCache)[currentShow?.id || ""]) {
        //     const outSlide = get(outputs)[getActiveOutputs(get(outputs), true, true, true)[0]]?.out?.slide
        //     if (!nooutput && outSlide?.type !== "ppt" && outSlide?.type !== "pdf") return
        // }
        if (presentationControllersKeysDisabled()) return

        e.preventDefault()
        nextSlideIndividual(e)
    },
    PageUp: (e: KeyboardEvent) => {
        // const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        // if (!get(showsCache)[currentShow?.id || ""]) {
        //     const outSlide = get(outputs)[getActiveOutputs(get(outputs), true, true, true)[0]]?.out?.slide
        //     if (!nooutput && outSlide?.type !== "ppt" && outSlide?.type !== "pdf") return
        // }
        if (presentationControllersKeysDisabled()) return

        e.preventDefault()
        previousSlideIndividual(e)
    },

    ArrowRight: (e: any) => {
        // if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(outLocked) || e.ctrlKey || e.metaKey) return
        if (!e.preview && (get(activeEdit).items.length || get(activeStage).items.length)) return
        if (get(activeSlideRecording)) return updateSlideRecording("next")

        const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(showsCache)[currentShow?.id || ""]) {
            const out = getFirstActiveOutput()?.out
            if (!out?.slide) {
                if (currentShow?.type === "overlay" && !out?.overlays?.includes(currentShow?.id)) {
                    e.preventDefault()
                    return setOutput("overlays", currentShow.id, false, "", true)
                } else if ((currentShow?.type === "video" || currentShow?.type === "image" || currentShow?.type === "player") && (out?.background?.path || out?.background?.id) !== currentShow?.id) {
                    return togglePlayingMedia(e)
                    // } else if (currentShow?.type === "folder") {
                    //     return playMedia(e)
                }
                // WIP audio
            }
        }

        nextSlideIndividual(e)
    },
    ArrowLeft: (e: any) => {
        // if (get(activeShow)?.type !== "show" && get(activeShow)?.type !== undefined) return
        if (get(outLocked) || e.ctrlKey || e.metaKey) return
        if (!e.preview && (get(activeEdit).items.length || get(activeStage).items.length)) return
        if (get(activeSlideRecording)) return updateSlideRecording("previous")

        // const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        // if (!get(showsCache)[currentShow?.id || ""]) {
        //     const out = getFirstActiveOutput()?.out
        //     if (!out?.slide) {
        //         if (currentShow?.type === "folder") {
        //             return playMedia(e, true)
        //         }
        //     }
        // }

        previousSlideIndividual(e)
    },
    " ": (e: KeyboardEvent) => {
        if (get(contextActive)) return

        const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (currentShow?.type === "ppt") return
        if (currentShow?.type === "pdf") {
            e.preventDefault()
            return nextSlideIndividual(e, true)
        }
        if (!get(showsCache)[currentShow?.id || ""]) {
            if (currentShow?.type === "overlay") {
                e.preventDefault()
                return setOutput("overlays", currentShow.id, false, "", true)
            }
            return togglePlayingMedia(e)
        }

        const outputId = getFirstActiveOutput()?.id || ""
        const currentOutput = outputId ? get(outputs)[outputId] || null : null
        const outSlide = currentOutput?.out?.slide || get(outputSlideCache)[outputId] || {}

        e.preventDefault()
        if (outSlide.id !== currentShow?.id || (currentShow && outSlide.layout !== get(showsCache)[currentShow.id || ""]?.settings.activeLayout)) {
            if (get(activeSlideRecording)) stopSlideRecording()
            nextSlideIndividual(e, true)
        } else {
            if (get(activeSlideRecording)) return updateSlideRecording("next")
            if (e.shiftKey) previousSlideIndividual(e)
            else nextSlideIndividual(e)
        }
    },
    Home: (e: KeyboardEvent) => {
        const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(showsCache)[currentShow?.id || ""]) return
        if (presentationControllersKeysDisabled()) return

        e.preventDefault()
        nextSlideIndividual(e, true)
    },
    End: (e: KeyboardEvent) => {
        const currentShow = get(focusMode) ? get(activeFocus) : get(activeShow)
        if (!get(showsCache)[currentShow?.id || ""]) return
        if (presentationControllersKeysDisabled()) return

        e.preventDefault()
        nextSlideIndividual(e, false, true)
    }
}

export function presentationControllersKeysDisabled() {
    return false // always active at the moment
    // return !!get(special).disablePresenterControllerKeys
}

export function closeContextMenu() {
    contextActive.set(false)
    spellcheck.set(null)
}

// CTRL + N
function createNew() {
    const selectId = get(selected)?.id || get(focusedArea)

    if (selectId === "slide")
        history({ id: "SLIDES" }) // show
    else if (selectId === "show")
        addSection() // project
    else if (selectId.includes("category_")) {
        // if (selectId.includes("media") || selectId.includes("audio")) sendMain(Main.OPEN_FOLDER, { channel: id, title, path })
        if (selectId.includes("scripture")) activePopup.set("import_scripture")
        else if (selectId.includes("calendar")) sendMain(Main.IMPORT, { channel: "calendar", format: { name: "Calendar", extensions: ["ics"] } })
        else history({ id: "UPDATE", location: { page: "drawer", id: selectId } })
    } else if (selectId === "overlay") history({ id: "UPDATE", location: { page: "drawer", id: "overlay" } })
    else if (selectId === "template") history({ id: "UPDATE", location: { page: "drawer", id: "template" } })
    else if (selectId === "global_timer") activePopup.set("timer")
    else if (["action", "variable", "trigger"].includes(selectId)) activePopup.set(selectId as any)
    else if (get(activePage) === "edit") addItem("text")
    else if (get(activePage) === "stage") history({ id: "UPDATE", location: { page: "stage", id: "stage" } })
    else {
        console.info("CREATE NEW:", selectId)
        activePopup.set("show")
    }
}

export function togglePlayingMedia(e: Event | null = null, back = false) {
    if (get(outLocked)) return
    // if ($focusMode || e.target?.closest(".edit") || e.target?.closest("input")) return
    const item = get(focusMode) ? get(activeFocus) : get(activeShow)

    const type: ShowType | undefined = item?.type
    if (!item || !type) return
    e?.preventDefault()

    const currentOutput = getFirstActiveOutput()
    const currentlyPlaying = currentOutput?.out?.background?.path
    const alreadyPlaying = currentlyPlaying === item.id

    if (type === "video" || type === "image" || type === "player") {
        if (alreadyPlaying) {
            // play / pause video
            // WIP duplicate of MediaControls.svelte
            const dataValues: any = {}
            const activeOutputIds = getAllNormalOutputs().map(a => a.id)
            const videoData = get(videosData)[currentOutput?.id || ""] || {}
            activeOutputIds.forEach(id => {
                dataValues[id] = { ...videoData, muted: id !== currentOutput?.id ? true : videoData.muted, paused: !videoData.paused }
            })

            send(OUTPUT, ["DATA"], dataValues)
            return
        }

        const outputStyle = get(styles)[currentOutput?.style || ""]
        const mediaData = get(media)[item.id] || {}
        const mediaStyle = getMediaStyle(mediaData, outputStyle)

        const videoType = mediaData.videoType
        const shouldLoop = videoType === "background" ? true : false
        const shouldBeMuted = videoType === "background" ? true : false

        // clear slide
        if (videoType === "foreground" || (videoType !== "background" && (type === "image" || !shouldLoop))) clearSlide()

        setOutput("background", { type, path: item.id, muted: shouldBeMuted, loop: shouldLoop, ...mediaStyle })
    } else if (type === "audio") {
        AudioPlayer.start(item.id, { name: (item as any).name || "" }, { pauseIfPlaying: true })
    } else if (type === "folder") {
        playFolder(item.id, back)
    }
}

export async function playFolder(path: string, back = false) {
    const currentOutput = getFirstActiveOutput()
    const currentlyPlaying = currentOutput?.out?.background?.path

    const mediaExtensions = [...videoExtensions, ...imageExtensions, ...audioExtensions]
    const files = await requestMain(Main.READ_FOLDER, { path })
    const folderFiles = sortByName(files.files.filter(a => mediaExtensions.includes(a.extension)).map(a => ({ path: a.path, name: a.name, type: getMediaType(a.extension), thumbnail: a.thumbnailPath })))
    if (!folderFiles.length) return

    const mediaFiles = folderFiles.filter(a => a.type !== "audio")
    const playingIndex = mediaFiles.findIndex(a => a.path === currentlyPlaying)
    const newMedia = back ? (mediaFiles[playingIndex - 1] ?? mediaFiles[mediaFiles.length - 1]) : (mediaFiles[playingIndex + 1] ?? mediaFiles[0])
    const allFilesIndex = folderFiles.findIndex(a => a.path === newMedia.path)

    // skip and play audio file
    if (!back && folderFiles[allFilesIndex - 1]?.type === "audio") {
        AudioPlayer.start(folderFiles[allFilesIndex - 1].path, { name: folderFiles[allFilesIndex - 1].name })
    }

    const outputStyle = get(styles)[currentOutput?.style || ""]
    const mediaStyle = getMediaStyle(get(media)[newMedia.path], outputStyle)

    setOutput("background", { type: newMedia.type, path: newMedia.path, muted: false, loop: false, ...mediaStyle, folderPath: path })

    startFolderTimer(path, newMedia)
}
