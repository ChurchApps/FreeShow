import { get } from "svelte/store"
import { activePage, driveData, historyCacheCount, undoHistory } from "../../stores"
import type { ShowRef } from "./../../../types/Projects"
import { redoHistory } from "./../../stores"
import { clone } from "./array"
import { historyActions } from "./historyActions"
import { deselect } from "./select"
import { loadShows } from "./setShow"
import { _show } from "./shows"

export type HistoryPages = "none" | "drawer" | "show" | "edit" | "calendar" | "draw" | "stage" | "settings"
export type HistoryIDs =
    // NEW
    | "UPDATE"
    | "SHOWS"
    | "SLIDES"
    | "TEMPLATE"
    | "SHOW_LAYOUT"
    | "SHOW_ITEMS"

    // TODO: remove/update these:
    // edit
    | "textStyle"
    | "textAlign"
    | "deleteItem"
    | "setItems"
    | "setStyle"
    | "slideStyle"
    // show
    | "slide"
    | "showMedia"
    | "showAudio"

export interface History {
    id: HistoryIDs
    oldData?: any
    newData?: any
    save?: boolean
    time?: number
    location?: {
        page: HistoryPages
        id?: string
        override?: boolean | string
        project?: null | string
        folder?: string
        show?: ShowRef
        shows?: any[]
        layout?: string
        layouts?: string[]
        layoutSlide?: number
        slide?: string
        items?: any[]
        theme?: string
        lines?: number[]
    }
}

// override previous history
const override = ["textAlign", "textStyle", "deleteItem", "setItems", "setStyle", "slideStyle", "STAGE"]

export async function historyAwait(s: string[], obj: History) {
    loadShows(s)
        .then(() => {
            history(obj)
        })
        .catch((e) => {
            console.error(e)
        })
}

export function history(obj: History, undo: null | boolean = null) {
    // let page: HistoryPages = obj.location?.page || "shows"
    if (!obj.location) obj.location = { page: get(activePage) as any }
    if (!obj.oldData) obj.oldData = null
    if (!obj.newData) obj.newData = null

    if (undo === null) obj.time = new Date().getTime()

    let showID: any
    if (obj.location?.show?.id) showID = obj.location.show.id
    let old: any = null
    let temp: any = {}

    if (historyActions({})[obj.id]) {
        historyActions({ obj, undo })[obj.id]()
    } else {
        switch (obj.id) {
            // EDIT
            // style
            case "deleteItem":
                if (undo) _show(showID).slides([obj.location!.slide!]).items(obj.location!.items!).add(obj.newData.items)
                else old = { items: _show(showID).slides([obj.location!.slide!]).items(obj.location!.items!).remove() }
                _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
                break
            // set items
            case "textStyle":
            case "textAlign":
                old = {
                    style: _show(showID)
                        .slides([obj.location!.slide!])
                        .items(obj.location!.items!)
                        .lines(obj.location!.lines! || [])
                        .set(obj.newData.style),
                }
                // CSS text style
                // if (obj.newData?.style?.key === "text-style" && old.style.values?.[0]?.[0]) old.style.values = old.style.values[0]

                if (!undo && _show(showID).get("settings.template")) old.template = { key: "settings.template", value: null }
                if (old.template) _show(showID).set(old.template)
                break
            case "setItems":
            case "setStyle":
                old = { style: _show(showID).slides([obj.location!.slide!]).items(obj.location!.items!).set(obj.newData.style) }
                if (!undo && _show(showID).get("settings.template")) old.template = { key: "settings.template", value: null }
                if (old.template) _show(showID).set(old.template)
                break
            case "slideStyle":
                old = { style: _show(showID).slides([obj.location?.slide!]).set({ key: "settings", value: obj.newData.style }) }
                break
            case "slide":
                old = {
                    slides: _show(showID).set({ key: "slides", value: obj.newData.slides }),
                    layout: _show(showID).layouts([obj.location!.layout!]).set({ key: "slides", value: obj.newData.layout })[0]?.value,
                    media: _show(showID).set({ key: "media", value: obj.newData.media }),
                }
                break

            // show
            case "showMedia":
                let bgid: null | string = null
                if (obj.newData?.id)
                    _show(showID)
                        .media()
                        .get()
                        .forEach((media: any) => {
                            if (media.id === obj.newData.id) bgid = media.key
                        })

                if (undo) {
                    if (bgid) _show(showID).media([bgid]).remove()
                    _show(showID)
                        .layouts([obj.location!.layout!])
                        .slides([[obj.location!.layoutSlide!]])
                        .remove("background")
                } else {
                    let ref = _show(showID).layouts([obj.location!.layout!]).ref()?.[0]?.[obj.location!.layoutSlide!]
                    if (ref) {
                        let cloudId = get(driveData).mediaId
                        if (ref.data.background && cloudId && cloudId !== "default") {
                            bgid = ref.data.background
                            _show(showID).media().add(obj.newData, bgid!)
                        } else {
                            // look for existing media
                            let existing = _show(showID)
                                .media()
                                .get()
                                .find((a) => a.path === obj.newData.path)
                            if (existing) bgid = existing.key
                        }
                        if (!bgid) bgid = _show(showID).media().add(obj.newData)

                        // let layoutSlide = _show(showIDs).layouts([obj.location!.layout!]).slides([ref.index]).get()[0]
                        if (ref.type === "parent") _show(showID).layouts([obj.location!.layout!]).slides([ref.index]).set({ key: "background", value: bgid })
                        else _show(showID).layouts([obj.location!.layout!]).slides([ref.parent.index]).children([ref.id]).set({ key: "background", value: bgid })
                    }
                }
                break
            case "showAudio":
                // get existing show media id
                let audioId: null | string = null
                if (!obj.newData) return

                if (obj.newData.path) {
                    _show(showID)
                        .media()
                        .get()
                        .forEach((media: any) => {
                            if (media.path === obj.newData.path) audioId = media.key
                        })
                }

                // layout audio
                let ref = _show(showID).layouts([obj.location!.layout!]).ref()[0][obj.location!.layoutSlide!]
                let audio = ref?.data?.audio || []
                if (!ref) return

                if (undo) {
                    _show(showID).media([obj.newData.path]).remove()
                    if (audioId) {
                        audio.splice(audioId, 1)
                        _show(showID)
                            .layouts([obj.location!.layout!])
                            .slides([[obj.location!.layoutSlide!]])
                            .set({ key: "audio", value: audio })
                    }
                } else {
                    // WIP add audio at index
                    // let cloudId = get(driveData).mediaId
                    // if (audio[0] && cloudId && cloudId !== "default") {
                    //     _show(showID).media().add(obj.newData)
                    //     audioId = audio[0]
                    //     _show(showID).media().add(obj.newData)
                    // }
                    if (!audioId) audioId = _show(showID).media().add(obj.newData)

                    if (!audio.includes(audioId)) {
                        audio.push(audioId)

                        if (ref.type === "parent") _show(showID).layouts([obj.location!.layout!]).slides([ref.index]).set({ key: "audio", value: audio })
                        else _show(showID).layouts([obj.location!.layout!]).slides([ref.parent.index]).children([ref.id]).set({ key: "audio", value: audio })
                    }
                }
                break

            default:
                console.log(obj)
                break
        }
    }

    if (temp.obj) obj = temp.obj

    // set old
    if (old && !undo && !obj.oldData) obj.oldData = old

    if (obj.save === false) return
    if (undo === null) redoHistory.set([])

    // TODO: remove history obj if oldData is exactly the same as newdata

    // if (obj.id !== "SAVE") {
    // TODO: go to location
    if (obj.location!.page === "drawer") {
        // TODO: open drawer
    } else if (obj.location!.page !== "none") {
        // this makes more sense
        if ((get(activePage) === "show" || get(activePage) === "edit") && (obj.location!.page === "show" || obj.location!.page === "edit")) {
            // dont do anything
        } else activePage.set(obj.location!.page)
    }

    // TODO: slide text edit, dont override different style keys!
    // }

    if (undo) {
        redoHistory.update((rh: History[]) => {
            rh.push(obj)

            // delete oldest if more than set value
            // rh = rh.slice(-get(historyCacheCount))

            return rh
        })
    } else {
        undoHistory.update((uh: History[]) => {
            // if id and location is equal push new data to previous stored
            // not: project | newProject | newFolder | addShowToProject | slide
            if (undo === null && (override.includes(obj.id) || obj.location?.override) && uh[uh.length - 1]?.id === obj.id && JSON.stringify(Object.values(uh[uh.length - 1]?.location || {})) === JSON.stringify(Object.values(obj.location || {}))) {
                // override, but keep previousData!!!
                let newestData = obj.newData
                if (newestData?.previousData) newestData.previousData = uh[uh.length - 1].newData.previousData
                uh[uh.length - 1].newData = newestData
                uh[uh.length - 1].time = Date.now()
            } else {
                // add to start if redo
                // if (undo === false) uh = [obj, ...uh]
                // else uh.push(obj)
                uh.push(obj)
            }

            // delete oldest if more than set value
            uh = uh.slice(-get(historyCacheCount))

            return uh
        })
    }

    // deselect selected
    // not when changing multiple selected slides OR changing slide transition
    if (obj.location?.page !== "edit" && obj.id !== "SHOW_LAYOUT") {
        deselect()
    }

    console.log("UNDO: ", [...get(undoHistory)])
    console.log("REDO: ", [...get(redoHistory)])
}

export const undo = () => {
    if (!get(undoHistory).length) return
    if (document.activeElement?.classList?.contains("edit") && !document.activeElement?.closest(".editItem")) return

    let lastUndo: History
    undoHistory.update((uh: History[]) => {
        lastUndo = uh.pop()!
        return uh
    })

    let oldData: any = clone(lastUndo!.oldData)
    lastUndo!.oldData = clone(lastUndo!.newData)
    lastUndo!.newData = oldData

    console.log("UNDO", [...get(undoHistory)], [...get(redoHistory)])

    history(lastUndo!, true)
}

export const redo = () => {
    if (!get(redoHistory).length) return
    if (document.activeElement?.classList?.contains("edit") && !document.activeElement?.closest(".editItem")) return

    let lastRedo: History
    redoHistory.update((rh: History[]) => {
        lastRedo = rh.pop()!
        return rh
    })

    let oldData: any = clone(lastRedo!.oldData)
    lastRedo!.oldData = clone(lastRedo!.newData)
    lastRedo!.newData = oldData

    console.log("REDO", [...get(undoHistory)], [...get(redoHistory)])

    history(lastRedo!, false)
}

// {
//   action: "moveSlide",
//   fromState: 2,
//   page: "shows",
// },
