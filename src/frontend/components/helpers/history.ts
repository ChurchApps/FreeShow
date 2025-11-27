import { get } from "svelte/store"
import type { History, HistoryNew, HistoryTypes } from "../../../types/History"
import { activePage, driveData, historyCacheCount, undoHistory } from "../../stores"
import { redoHistory } from "./../../stores"
import { clone } from "./array"
import { historyActions } from "./historyActions"
import { deselect } from "./select"
import { loadShows } from "./setShow"
import { _show } from "./shows"
import { removeTemplatesFromShow } from "./show"
import { createStore, createStoreHistory, deleteStore, deleteStoreHistory, updateStore, updateStoreHistory } from "./historyStores"

// override previous history
const override = ["textAlign", "textStyle", "deleteItem", "setItems", "setStyle", "slideStyle", "STAGE"]

export function historyAwait(s: string[], obj: History) {
    loadShows(s)
        .then(() => {
            history(obj)
        })
        .catch(e => {
            console.error(e)
        })
}

export function history(obj: History, shouldUndo: null | boolean = null) {
    // let page: HistoryPages = obj.location?.page || "shows"
    if (!obj.location) obj.location = { page: get(activePage) as any }
    if (!obj.oldData) obj.oldData = null
    if (!obj.newData) obj.newData = null

    if (shouldUndo === null) obj.time = new Date().getTime()

    let showID: string | undefined
    if (obj.location?.show?.id) showID = obj.location.show.id
    let old: any = null
    const temp: any = {}

    if (historyActions({})[obj.id]) {
        historyActions({ obj, undo: shouldUndo })[obj.id]()
    } else {
        switch (obj.id) {
            // EDIT
            // style
            case "deleteItem":
                if (shouldUndo) _show(showID).slides([obj.location.slide!]).items(obj.location.items).add(obj.newData.items)
                else old = { items: _show(showID).slides([obj.location.slide!]).items(obj.location.items).remove() }
                _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
                break
            // set items
            case "textStyle":
            case "textAlign":
                old = {
                    style: _show(showID)
                        .slides([obj.location.slide!])
                        .items(obj.location.items)
                        .lines(obj.location.lines! || [])
                        .set(obj.newData.style)
                }
                // CSS text style
                // if (obj.newData?.style?.key === "text-style" && old.style.values?.[0]?.[0]) old.style.values = old.style.values[0]

                // remove templates because slide has manual updates
                if (!shouldUndo) removeTemplatesFromShow(showID || "")
                break
            case "setItems":
            case "setStyle":
                old = {
                    style: _show(showID)
                        .slides([obj.location?.slide || ""])
                        .items(obj.location.items)
                        .set(obj.newData.style)
                }

                // remove templates because slide has manual updates
                if (!shouldUndo) removeTemplatesFromShow(showID || "")
                break
            case "slideStyle":
                old = {
                    style: _show(showID)
                        .slides([obj.location?.slide || ""])
                        .set({ key: "settings", value: obj.newData.style })
                }
                break
            case "slide":
                old = {
                    slides: _show(showID).set({ key: "slides", value: obj.newData.slides }),
                    layout: _show(showID).layouts([obj.location.layout!]).set({ key: "slides", value: obj.newData.layout })[0]?.value,
                    media: _show(showID).set({ key: "media", value: obj.newData.media || _show(showID).get("media") })
                }
                break

            // show
            case "showMedia":
                let bgid: null | string = null
                if (obj.newData?.id)
                    _show(showID)
                        .media()
                        .get()
                        .forEach(media => {
                            if (media.id === obj.newData.id) bgid = media.key
                        })

                if (shouldUndo) {
                    if (bgid) _show(showID).media([bgid]).remove()
                    _show(showID)
                        .layouts([obj.location.layout!])
                        .slides([[obj.location.layoutSlide!]])
                        .remove("background")
                } else {
                    const layoutRefSlide = _show(showID).layouts([obj.location.layout!]).ref()[0]?.[obj.location.layoutSlide!]
                    if (layoutRefSlide) {
                        const cloudId = get(driveData).mediaId
                        if (layoutRefSlide.data.background && cloudId && cloudId !== "default") {
                            bgid = layoutRefSlide.data.background
                            _show(showID).media().add(obj.newData, bgid)
                        } else {
                            // look for existing media
                            const existing = _show(showID)
                                .media()
                                .get()
                                .find(a => a.path === obj.newData.path)
                            if (existing) bgid = existing.key
                        }
                        if (!bgid) bgid = _show(showID).media().add(obj.newData)

                        // let layoutSlide = _show(showIDs).layouts([obj.location!.layout!]).slides([ref.index]).get()[0]
                        if (layoutRefSlide.type === "parent") _show(showID).layouts([obj.location.layout!]).slides([layoutRefSlide.index]).set({ key: "background", value: bgid })
                        else _show(showID).layouts([obj.location.layout!]).slides([layoutRefSlide.parent?.index]).children([layoutRefSlide.id]).set({ key: "background", value: bgid })
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
                        .forEach(media => {
                            if (media.path === obj.newData.path) audioId = media.key
                        })
                }

                // layout audio
                const ref = _show(showID).layouts([obj.location.layout!]).ref()[0]?.[obj.location.layoutSlide!]
                const audio = ref?.data?.audio || []
                if (!ref) return

                if (shouldUndo) {
                    _show(showID).media([obj.newData.path]).remove()
                    if (audioId) {
                        audio.splice(audioId, 1)
                        _show(showID)
                            .layouts([obj.location.layout!])
                            .slides([[obj.location.layoutSlide!]])
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

                        if (ref.type === "parent") _show(showID).layouts([obj.location.layout!]).slides([ref.index]).set({ key: "audio", value: audio })
                        else _show(showID).layouts([obj.location.layout!]).slides([ref.parent?.index]).children([ref.id]).set({ key: "audio", value: audio })
                    }
                }
                break

            default:
                console.info("Missing history:", obj)
                break
        }
    }

    if (temp.obj) obj = temp.obj

    // set old
    if (old && !shouldUndo && !obj.oldData) obj.oldData = old

    if (obj.save === false) return
    if (shouldUndo === null) redoHistory.set([])

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

    if (shouldUndo) {
        redoHistory.update(rh => {
            rh.push(obj)

            // delete oldest if more than set value
            // rh = rh.slice(-get(historyCacheCount))

            return rh
        })
    } else {
        undoHistory.update((uh: any) => {
            // if id and location is equal push new data to previous stored
            // not: project | newProject | newFolder | addShowToProject | slide
            if (shouldUndo === null && (override.includes(obj.id) || obj.location?.override) && uh[uh.length - 1]?.id === obj.id && JSON.stringify(Object.values(uh[uh.length - 1]?.location || {})) === JSON.stringify(Object.values(obj.location || {}))) {
                // override, but keep previousData!!!
                const newestData = obj.newData
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
    if (obj.location?.page !== "edit" && obj.id !== "SHOW_LAYOUT" && obj.id !== "setItems") {
        deselect()
    }

    console.info("UNDO: ", [...get(undoHistory)])
    console.info("REDO: ", [...get(redoHistory)])
}

export function historyNew(type: HistoryTypes, value: any) {
    if (type === "store_create") {
        createStoreHistory(value.id, value.value, value.key)
    } else if (type === "store_update") {
        // @ts-ignore
        updateStoreHistory(value.id, value.key, value.value)
    } else if (type === "store_delete") {
        deleteStoreHistory(value.id, value.key)
    } else {
        console.error("Invalid history type")
        return
    }

    const historyValue: HistoryNew = { version: 1, time: Date.now(), type, value }
    undoHistory.update(a => {
        a.push(historyValue)
        return a
    })
}

export const undo = () => {
    if (!get(undoHistory).length) return
    if (document.activeElement?.classList?.contains("edit") && !document.activeElement?.closest(".editItem")) return

    let lastUndo: any
    undoHistory.update(uh => {
        lastUndo = uh.pop()!
        return uh
    })

    if (lastUndo.version === 1) {
        if (lastUndo.type === "store_create") {
            deleteStore(lastUndo.value.id, lastUndo.value.key, false)
        } else if (lastUndo.type === "store_update") {
            // @ts-ignore
            updateStore(lastUndo.value.id, lastUndo.value.key, lastUndo.value.oldValue, false)
        } else if (lastUndo.type === "store_delete") {
            createStore(lastUndo.value.id, lastUndo.value.oldValue, lastUndo.value.key, false)
        }

        redoHistory.update(rh => {
            rh.push(lastUndo)
            return rh
        })
        return
    }

    const oldData: any = clone(lastUndo!.oldData)
    lastUndo!.oldData = clone(lastUndo!.newData)
    lastUndo!.newData = oldData

    console.info("UNDO", [...get(undoHistory)], [...get(redoHistory)])

    history(lastUndo!, true)
}

export const redo = () => {
    if (!get(redoHistory).length) return
    if (document.activeElement?.classList?.contains("edit") && !document.activeElement?.closest(".editItem")) return

    let lastRedo: any
    redoHistory.update(rh => {
        lastRedo = rh.pop()!
        return rh
    })

    if (lastRedo.version === 1) {
        if (lastRedo.type === "store_create") {
            createStore(lastRedo.value.id, lastRedo.value.value, lastRedo.value.key, false)
        } else if (lastRedo.type === "store_update") {
            // @ts-ignore
            updateStore(lastRedo.value.id, lastRedo.value.key, lastRedo.value.value, false)
        } else if (lastRedo.type === "store_delete") {
            deleteStore(lastRedo.value.id, lastRedo.value.key, false)
        }

        undoHistory.update(a => {
            // a[a.length - 1].time = Date.now()
            lastRedo.time = Date.now()
            a.push(lastRedo)
            return a
        })
        return
    }

    const oldData: any = clone(lastRedo!.oldData)
    lastRedo!.oldData = clone(lastRedo!.newData)
    lastRedo!.newData = oldData

    console.info("REDO", [...get(undoHistory)], [...get(redoHistory)])

    history(lastRedo!, false)
}

// {
//   action: "moveSlide",
//   fromState: 2,
//   page: "shows",
// },
