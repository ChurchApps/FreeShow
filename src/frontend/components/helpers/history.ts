import { get } from "svelte/store"
import type { Slide } from "../../../types/Show"
import { activePage, historyCacheCount, shows, undoHistory } from "../../stores"
import type { ShowRef } from "./../../../types/Projects"
import { activeProject, activeShow, events, groups, projects, redoHistory, showsCache, stageShows, templates, theme, themes } from "./../../stores"
import { clone } from "./array"
import { historyActions } from "./historyActions"
import { loadShows } from "./setShow"
import { _show } from "./shows"

export type HistoryPages = "drawer" | "show" | "edit" | "stage" | "settings"
export type HistoryIDs =
    // TEMP
    | "SAVE"
    // NEW
    | "STAGE_ITEM_STYLE"
    | "UPDATE"
    | "SHOWS"
    | "SLIDES"

    // remove::::::::::::::::::::::::
    | "newItem"
    | "addLayout"
    | "deleteLayout"

    // edit
    | "textStyle"
    | "textAlign"
    | "deleteItem"
    | "setItems"
    | "setStyle"
    | "slideStyle"
    // stage
    | "stageItemAlign"
    | "stageItemStyle"
    // add
    | "addShowToProject"
    | "addLayout"
    // show
    | "updateShow"
    | "slide"
    | "changeSlide"
    | "showMedia"
    | "showAudio"
    | "changeLayoutsSlides"
    | "changeLayoutKey"
    | "changeLayout"
    | "changeLayouts"
    // other
    | "slideToOverlay"
    | "newEvent"
    | "deleteEvent"
    | "template"
    // settings
    | "theme"
    | "addTheme"
    | "addGlobalGroup"

export interface History {
    id: HistoryIDs
    oldData?: any
    newData?: any
    save?: boolean
    time?: number
    location?: {
        page: HistoryPages
        id?: string
        override?: boolean
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
const override = [
    "textAlign",
    "textStyle",
    "deleteItem",
    "setItems",
    "setStyle",
    "stageItemAlign",
    "stageItemStyle",
    "slideStyle",
    // "changeSlide",
    "changeLayout",
    "theme",
    "changeLayouts",
    "template",
    "STAGE",
]

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
    // if (undo) {
    //   let tempObj = obj
    //   obj.newData = tempObj.oldData
    //   obj.oldData = tempObj.newData
    // }

    // let page: HistoryPages = obj.location?.page || "shows"
    if (!obj.location && obj.id !== "SAVE") obj.location = { page: get(activePage) as any }
    if (!obj.oldData) obj.oldData = null
    if (!obj.newData) obj.newData = null

    if (undo === null) obj.time = new Date().getTime()

    // console.log(obj)

    let showID: any
    if (obj.location?.show?.id) showID = obj.location.show.id
    let old: any = null
    let temp: any = {}

    if (historyActions({})[obj.id]) {
        historyActions({ obj, undo })[obj.id]()
        console.log("HISTORY ACTION")
    } else {
        switch (obj.id) {
            // EDIT
            // style
            case "deleteItem":
                if (undo) _show(showID).slides([obj.location!.slide!]).items(obj.location!.items!).add(obj.newData.items)
                else old = { items: _show(showID).slides([obj.location!.slide!]).items(obj.location!.items!).remove() }
                _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
                break
            // case "textStyle":
            // TODO: wip
            // showsCache.update((s) => {
            //   console.log(obj.location!.items)

            //   obj.location!.items!.forEach((item, index) => {
            //     s[obj.location!.slide!].slides[obj.location!.slide!].items[item] = obj.newData[index]
            //   })
            //   // let items: Item[] = GetShow(obj.location?.show!).slides[obj.location?.slide!].items
            //   // obj.newData.forEach((item: Item, i: number) => {
            //   //   items[i] = item
            //   // })
            //   // items.forEach(item => {
            //   //   item = obj.newData
            //   // });
            //   // GetShow(obj.location.show!).slides[obj.location.slide!].items[obj.location.item!] = obj.newData
            //   return s
            // })
            // break
            // set items
            case "textStyle":
            case "textAlign":
                console.log("TEXT STYLE", obj.newData.style)
                // TODO: get old data (not getting first value....)
                old = {
                    style: _show(showID)
                        .slides([obj.location!.slide!])
                        .items(obj.location!.items!)
                        .lines(obj.location!.lines! || [])
                        .set(obj.newData.style),
                }
                console.log(old.style)
                if (!undo && _show(showID).get("settings.template")) old.template = { key: "settings.template", value: null }
                if (old.template) _show(showID).set(old.template)
                console.log(old)
                // _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
                break
            case "setItems":
            case "setStyle":
                old = { style: _show(showID).slides([obj.location!.slide!]).items(obj.location!.items!).set(obj.newData.style) }
                if (!undo && _show(showID).get("settings.template")) old.template = { key: "settings.template", value: null }
                if (old.template) _show(showID).set(old.template)
                console.log(old)
                // _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
                break
            case "stageItemStyle":
            case "stageItemAlign":
                stageShows.update((s) => {
                    obj.location!.items!.forEach((item, index) => {
                        s[obj.location!.slide!].items[item][obj.id === "stageItemStyle" ? "style" : "align"] = obj.newData[index]
                    })
                    return s
                })
                // _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
                break
            case "slideStyle":
                old = { style: _show(showID).slides([obj.location?.slide!]).set({ key: "settings", value: obj.newData.style }) }
                if (!undo && _show(showID).get("settings.template")) old.template = { key: "settings.template", value: null }
                if (old.template) _show(showID).set(old.template)
                // showsCache.update((s) => {
                //   let slide: Slide = GetShow(obj.location?.show!).slides[obj.location?.slide!]
                //   slide.settings = obj.newData
                //   return s
                // })
                // _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
                break
            //
            // MOVE
            // case "project": // projecList
            //   projects.update((p) => {
            //     p[get(activeProject)!].shows = obj.newData
            //     // TODO: p[obj.location!.project].shows = obj.newData
            //     return p
            //   })
            //   break
            case "slide":
                // if (undo) {
                // } else {
                old = {
                    slides: _show(showID).set({ key: "slides", value: obj.newData.slides }),
                    layout: _show(showID).layouts([obj.location!.layout!]).set({ key: "slides", value: obj.newData.layout })[0].value,
                }
                // }

                // if (undo) old = null
                // showsCache.update((a) => {
                //   a[showID].slides = obj.newData.slides
                //   a[showID].layouts[obj.location!.layout!].slides = obj.newData.layout
                //   return a
                // })
                break
            // show
            case "changeSlide":
                old = { key: obj.newData.key, value: _show(showID).slides([obj.location!.slide!]).set(obj.newData)[0] }

                // showsCache.update((a) => {
                //   if (!obj.oldData) obj.oldData = {}
                //   let slide: any = a[showID].slides[obj.location!.slide!]
                //   Object.entries(obj.newData).forEach(([key, value]: any) => {
                //     if (undo) slide[key] = obj.newData[key]
                //     else {
                //       obj.oldData[key] = slide[key] || null
                //       slide[key] = value
                //     }
                //   })
                //   return a
                // })
                break
            case "updateShow":
                // TODO: showsCache
                showsCache.update((a: any) => {
                    if (!obj.oldData) obj.oldData = { key: obj.newData.key, values: [] }
                    obj.location!.shows!.forEach((b, i) => {
                        if (obj.newData.values[i] !== undefined && obj.oldData.values[i] === undefined) obj.oldData.values[i] = a[b.id][obj.newData.key]
                        a[b.id][obj.newData.key] = obj.newData.values[i] === undefined ? obj.newData.values[0] : obj.newData.values[i]
                    })
                    return a
                })
                if (["name", "category", "timestamps", "private"].includes(obj.newData.key)) {
                    shows.update((a: any) => {
                        obj.location!.shows!.forEach((b, i) => {
                            a[b.id][obj.newData.key] = obj.newData.values[i] === undefined ? obj.newData.values[0] : obj.newData.values[i]
                        })
                        return a
                    })
                }
                break
            case "newItem":
                // TODO: undo
                showsCache.update((a) => {
                    let slide: Slide = a[showID].slides[obj.location!.slide!]
                    if (undo) {
                        slide.items.splice(obj.newData.index, 1)
                    } else {
                        old = { index: slide.items.length }
                        slide.items.push(obj.newData)
                    }
                    return a
                })
                break

            // delete
            case "deleteLayout":
                if (undo) {
                    old = { id: _show(showID).get("settings.activeLayout") }
                    // _show(showIDs).layouts().set({ key: obj.oldData.id, value: obj.newData.layout })
                    _show(showID).layouts().add(obj.newData.id, obj.newData.layout)
                    _show(showID).set({ key: "settings.activeLayout", value: obj.newData.id })

                    // set active layout in project
                    if (get(activeShow)?.index !== undefined && get(activeProject) && get(projects)[get(activeProject)!].shows[get(activeShow)!.index!]) {
                        projects.update((a) => {
                            a[get(activeProject)!].shows[get(activeShow)!.index!].layout = obj.newData.id
                            return a
                        })
                    }
                } else {
                    obj.newData.active = _show(showID).get("settings.activeLayout")
                    obj.oldData = { id: obj.newData.id, layout: _show(showID).layouts([obj.newData.id]).get()[0] }
                    _show(showID).layouts().remove(obj.newData.id)

                    // change layout if current is deleted
                    if (obj.newData.active === obj.newData.id) {
                        obj.newData.active = Object.keys(get(showsCache)[showID].layouts)[0]
                        _show(showID).set({ key: "settings.activeLayout", value: obj.newData.active })
                    }
                }
                break

            // ADD
            case "addShowToProject":
                projects.update((p) => {
                    if (undo) {
                        p[obj.location!.project!].shows = JSON.parse(obj.newData.shows)
                    } else {
                        if (!obj.oldData?.shows) obj.oldData = { shows: JSON.stringify(p[obj.location!.project!].shows) }
                        if (obj.newData.id) p[obj.location!.project!].shows.push(obj.newData)
                        else p[obj.location!.project!].shows = obj.newData.shows
                    }
                    return p
                })
                break
            case "addLayout":
                if (undo) {
                    _show(showID).set({ key: "settings.activeLayout", value: obj.newData.id })
                    _show(showID).layouts().remove(obj.oldData.id)
                } else {
                    old = { id: _show(showID).get("settings.activeLayout") }
                    // _show(showIDs).layouts().set({ key: obj.oldData.id, value: obj.newData.layout })
                    _show(showID).layouts().add(obj.newData.id, obj.newData.layout)
                    _show(showID).set({ key: "settings.activeLayout", value: obj.newData.id })

                    // set active layout in project
                    if (get(activeShow)?.index !== undefined && get(activeProject) && get(projects)[get(activeProject)!].shows[get(activeShow)!.index!]) {
                        projects.update((a) => {
                            a[get(activeProject)!].shows[get(activeShow)!.index!].layout = obj.newData.id
                            return a
                        })
                    }
                }
                // showsCache.update((a) => {
                //   if (undo) {
                //     delete a[showID].layouts[obj.oldData.id]
                //     a[showID].settings.activeLayout = obj.newData.id
                //   } else {
                //     obj.oldData = { id: a[showID].settings.activeLayout }
                //     a[showID].layouts[obj.newData.id] = obj.newData.layout
                //     a[showID].settings.activeLayout = obj.newData.id
                //   }
                //   return a
                // })
                break

            case "showMedia":
                let bgid: null | string = null
                if (obj.newData.id)
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
                    if (!bgid) bgid = _show(showID).media().add(obj.newData)

                    let ref = _show(showID).layouts([obj.location!.layout!]).ref()[0][obj.location!.layoutSlide!]
                    // let layoutSlide = _show(showIDs).layouts([obj.location!.layout!]).slides([ref.index]).get()[0]
                    if (ref.type === "parent") _show(showID).layouts([obj.location!.layout!]).slides([ref.index]).set({ key: "background", value: bgid })
                    else _show(showID).layouts([obj.location!.layout!]).slides([ref.parent.index]).children([ref.id]).set({ key: "background", value: bgid })
                }

                // showsCache.update((a) => {
                //   let id: null | string = null
                //   Object.entries(a[showID].backgrounds).forEach(([id, a]: any) => {
                //     if (a.path === obj.newData.path) id = id
                //   })
                //   if (undo) {
                //     delete a[showID].backgrounds[id!]
                //     delete a[showID].layouts[obj.location!.layout!].slides[obj.location!.layoutSlide!].background
                //   } else {
                //     if (!id) {
                //       id = uid()
                //       a[showID].backgrounds[id] = { ...obj.newData }
                //     }

                //     let ref = GetLayoutRef(obj.location!.show!.id, obj.location!.layout!)[obj.location!.layoutSlide!]
                //     let layoutSlide = a[showID].layouts[obj.location!.layout!].slides[ref.index]
                //     if (ref.type === "parent") layoutSlide.background = id
                //     else {
                //       if (!layoutSlide.children) layoutSlide.children = []
                //       layoutSlide.children[ref.index].background = id
                //     }
                //     // a[showID].layouts[obj.location!.layout!].slides[obj.location!.layoutSlide!].background = id
                //   }
                //   return a
                // })
                break
            case "showAudio":
                // get existing show media id
                let audioId: null | string = null
                if (obj.newData.path) {
                    _show(showID)
                        .media()
                        .get()
                        .forEach((media: any) => {
                            if (media.path === obj.newData.path) audioId = media.key
                        })
                }

                // layout audio
                let audio =
                    _show(showID)
                        .layouts([obj.location!.layout!])
                        .slides([[obj.location!.layoutSlide!]])
                        .get()[0]?.[0]?.audio || []

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
                    if (!audioId) audioId = _show(showID).media().add(obj.newData)

                    if (!audio.includes(audioId)) {
                        audio.push(audioId)

                        let ref = _show(showID).layouts([obj.location!.layout!]).ref()[0][obj.location!.layoutSlide!]
                        if (ref.type === "parent") _show(showID).layouts([obj.location!.layout!]).slides([ref.index]).set({ key: "audio", value: audio })
                        else _show(showID).layouts([obj.location!.layout!]).slides([ref.parent.index]).children([ref.id]).set({ key: "audio", value: audio })
                    }
                }
                break
            case "changeLayoutsSlides":
                old = []
                obj.location!.layouts!.forEach((layout: string, i: number) => {
                    old.push(_show(showID).layouts([layout]).set({ key: "slides", value: obj.newData[i] })[0].value)
                })
                break
            case "changeLayoutKey":
                old = _show(showID).layouts([obj.location!.layout!]).set(obj.newData)[0]
                break
            case "changeLayout":
                let ref = _show(showID).layouts([obj.location!.layout!]).ref()[0][obj.location!.layoutSlide!]
                if (ref.type === "parent") old = _show(showID).layouts([obj.location!.layout!]).slides([ref.index]).set(obj.newData)
                else old = _show(showID).layouts([obj.location!.layout!]).slides([ref.parent.index]).children([ref.id]).set(obj.newData)
                // showsCache.update((a) => {
                //   let ref: any[] = GetLayoutRef(obj.location!.show!.id, obj.location!.layout!)
                //   let index = obj.location!.layoutSlide!
                //   let slides = a[showID].layouts[obj.location!.layout!].slides
                //   let slide: any
                //   if (ref[index].type === "child") slide = slides[ref[index].layoutIndex].children[ref[index].id]
                //   else slide = slides[ref[index].index]
                //   if (!obj.oldData) obj.oldData = { key: obj.newData.key, value: slide[obj.newData.key] || null }
                //   if (obj.newData.value) slide[obj.newData.key] = obj.newData.value
                //   else delete slide[obj.newData.key]
                //   return a
                // })
                break
            case "changeLayouts":
                const updateValue = (a: any) => {
                    if (!obj.newData.value) delete a[obj.newData.key]
                    else if (obj.newData.action === "keys") {
                        Object.entries(obj.newData.value).forEach(([key, value]: any) => {
                            if (!a[obj.newData.key]) a[obj.newData.key] = {}
                            a[obj.newData.key][key] = value
                        })
                    } else a[obj.newData.key] = obj.newData.value
                    return a
                }
                // TODO: store previous value....
                if (!obj.oldData) obj.oldData = { key: obj.newData.key }
                showsCache.update((a: any) => {
                    let slides = a[showID].layouts[obj.location!.layout!].slides
                    slides.forEach((l: any) => {
                        l = updateValue(l)
                        let children: string[] = a[showID].slides[l.id]?.children
                        if (children?.length) {
                            if (!l.children) l.children = {}
                            children.forEach((child) => {
                                l.children[child] = updateValue(l.children[child] || {})
                            })
                        }
                    })
                    return a
                })
                break
            // other
            // case "slideToOverlay":
            //   overlays.update((a: any) => {
            //     if (undo) {
            //       let id: string = obj.oldData.id
            //       // remove outputted
            //       if (!isOutCleared("overlays")) {
            //         outputs.update((a) => {
            //           Object.entries(a).forEach(([outputId, output]: any) => {
            //             if (output.out?.overlays?.includes(id)) {
            //               a[outputId].out!.overlays = a[outputId].out!.overlays!.filter((a) => a !== id)
            //             }
            //           })
            //           return a
            //         })
            //       }

            //       delete a[id]
            //     } else a[obj.newData.id] = obj.newData.slide
            //     return a
            //   })
            //   break
            case "newEvent":
                events.update((a) => {
                    if (undo) {
                        if (!obj.newData) delete a[obj.oldData.id]
                        else a[obj.oldData.id] = obj.newData
                    } else a[obj.newData.id] = obj.newData.data
                    return a
                })
                break
            case "deleteEvent":
                events.update((a) => {
                    if (undo) {
                        a[obj.newData.id] = obj.newData.data
                    } else {
                        obj.oldData = obj.newData
                        if (!obj.oldData.data) obj.oldData.data = get(events)[obj.newData.id]
                        delete a[obj.newData.id]
                    }
                    return a
                })
                break
            case "template":
                showsCache.update((a) => {
                    if (undo) {
                        a[showID].slides = obj.newData.slides
                        a[showID].settings.template = obj.newData.template
                    } else {
                        console.log(a[showID]?.slides)

                        let slides: any = a[showID].slides
                        if (!obj.oldData) obj.oldData = { template: a[showID].settings.template, slides: JSON.parse(JSON.stringify(slides)) }
                        if (obj.location!.layoutSlide === undefined) a[showID].settings.template = obj.newData.template
                        else a[showID].settings.template = null
                        let template = clone(get(templates)[obj.newData.template])
                        if (template?.items.length) {
                            let slideId = obj.location!.layoutSlide === undefined ? null : _show(obj.location!.show!.id).layouts([obj.location!.layout]).ref()[0][obj.location!.layoutSlide!].id
                            Object.entries(slides).forEach(([id, slide]: any) => {
                                if (!slideId || id === slideId) {
                                    template.items.forEach((item: any, i: number) => {
                                        if (slide.items[i]) {
                                            slide.items[i].style = item.style || ""
                                            slide.items[i].align = item.align || ""
                                            slide.items[i].lines?.forEach((line: any, j: number) => {
                                                let templateLine = item.lines?.[j] || item.lines?.[0]
                                                line.align = templateLine?.align || ""
                                                line.text.forEach((text: any, k: number) => {
                                                    text.style = templateLine?.text[k] ? templateLine.text[k].style || "" : templateLine?.text[0]?.style || ""
                                                })
                                            })
                                        } else if (obj.newData.createItems) {
                                            // remove text
                                            if (item.lines) item.lines = item.lines.map((line) => ({ align: line.align, text: [{ style: line.text?.[0]?.style, value: "" }] }))
                                            slide.items.push(item)
                                        }
                                    })

                                    slide.items.forEach((item: any, i: number) => {
                                        // remove item if template don't have it and it's empty
                                        if (i < template.items.length) return
                                        let text: number = item.lines?.reduce((value, line) => (value += line.text?.reduce((value, text) => (value += text.value.length), 0)), 0)
                                        if (text) return
                                        slide.items.splice(i, 1)

                                        // item.style = template.items[i] ? template.items[i].style || "" : template.items[0].style || ""
                                        // item.lines?.forEach((line: any, j: number) => {
                                        //     line.text.forEach((text: any, k: number) => {
                                        //     text.style = template.items[i].lines?.[j]?.text[k] ? template.items[i].lines?.[j].text[k].style || "" : template.items[i].lines?.[0].text[0].style || ""
                                        //     })
                                        // })
                                    })
                                }
                                a[showID].slides[id] = clone(slide)
                            })
                            // } else {
                            //   alertMessage.set("Empty template")
                            //   activePopup.set("alert")
                        }
                    }
                    return a
                })
                break
            // settings
            case "theme":
                themes.update((a: any) => {
                    if (!obj.oldData) {
                        obj.oldData = { ...obj.newData }
                        if (obj.newData.id) obj.oldData.value = a[obj.location!.theme!][obj.newData.key][obj.newData.id]
                        else obj.oldData.value = a[obj.location!.theme!][obj.newData.key]
                        if (obj.newData.key === "name" && a[obj.location!.theme!].default) obj.oldData.default = true
                    }
                    // if (obj.newData.default) a[obj.location!.theme!].default = true
                    // else if (a[obj.location!.theme!].default) delete a[obj.location!.theme!].default
                    if (obj.newData.id) a[obj.location!.theme!][obj.newData.key][obj.newData.id] = obj.newData.value
                    else a[obj.location!.theme!][obj.newData.key] = obj.newData.value
                    if (obj.newData.key === "name" && a[obj.location!.theme!].default) delete a[obj.location!.theme!].default
                    // TODO: remove default if name change; if (a[obj.location!.theme!].default) groupValue
                    let key = obj.newData.id || obj.newData.key
                    if (obj.newData.key === "font") key = obj.newData.key + "-" + key
                    document.documentElement.style.setProperty("--" + key, obj.newData.value)
                    return a
                })
                break
            case "addTheme":
                themes.update((a: any) => {
                    if (obj.newData) {
                        // name exists
                        // let index = 0
                        // while (Object.values(a).find((a: any) => a.name === obj.newData.name + (index > 0 ? " " + index : ""))) index++
                        // obj.newData.name = obj.newData.name + (index > 0 ? " " + index : "")
                        a[obj.location!.theme!] = obj.newData
                        theme.set(obj.location!.theme!)
                    } else {
                        if (get(theme) === obj.location!.theme!) theme.set("default")
                        delete a[obj.location!.theme!]
                    }
                    return a
                })
                break
            case "addGlobalGroup":
                groups.update((a: any) => {
                    if (obj.newData?.data) a[obj.newData!.id!] = obj.newData.data
                    else {
                        // obj.newData.data = a[obj.oldData!.id!]
                        delete a[obj.oldData!.id!]
                    }
                    return a
                })
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

    if (obj.id === "SAVE") {
        // if (undo === null) {
        //     // // remove all history "SAVE" in redo when saving
        //     // redoHistory.set(get(redoHistory).filter((a) => a.id !== "SAVE"))
        //     // return if exact match
        //     if (JSON.stringify(get(undoHistory).at(-1)?.newData) === JSON.stringify(obj.newData)) return
        // }
    } else {
        // TODO: go to location
        if (obj.location!.page === "drawer") {
            // TODO: open drawer
        } else activePage.set(obj.location!.page)

        // TODO: slide text edit, dont override different style keys!
    }

    if (undo) {
        redoHistory.update((rh: History[]) => {
            rh.push(obj)
            return rh
        })
    } else {
        undoHistory.update((uh: History[]) => {
            // if id and location is equal push new data to previous stored
            // not: project | newProject | newFolder | addShowToProject | slide
            if (undo === null && (override.includes(obj.id) || obj.location?.override) && uh[uh.length - 1]?.id === obj.id && JSON.stringify(Object.values(uh[uh.length - 1]?.location || {})) === JSON.stringify(Object.values(obj.location || {}))) {
                // override, but keep previousData!!!
                let newestData = obj.newData
                if (newestData.previousData) newestData.previousData = uh[uh.length - 1].newData.previousData
                uh[uh.length - 1].newData = newestData
            } else {
                // add to start if redo
                // if (undo === false) uh = [obj, ...uh]
                // else uh.push(obj)
                uh.push(obj)
            }
            return uh
        })
    }

    // delete oldest if more than set value
    undoHistory.set(get(undoHistory).slice(-get(historyCacheCount)))
    // redoHistory.set(get(redoHistory).slice(-get(historyCacheCount)))

    console.log("UNDO: ", [...get(undoHistory)])
    console.log("REDO: ", [...get(redoHistory)])
}

export const undo = () => {
    if (!get(undoHistory).length) return

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
