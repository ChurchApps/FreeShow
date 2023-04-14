import { get } from "svelte/store"
import { uid } from "uid"
import type { Item } from "../../../types/Show"
import { activeDays, activeEdit, activePage, activePopup, activeProject, activeShow, activeStage, alertMessage, clipboard, events, midiIn, overlays, projects, scriptures, selected, showsCache, stageShows, templates } from "../../stores"
import { removeSlide } from "../context/menuClick"
import { deleteTimer } from "../drawer/timers/timers"
import { clone } from "./array"
import { history } from "./history"
import { loadShows } from "./setShow"
import { _show } from "./shows"

export function copy({ id, data }: any = {}, getData: boolean = true) {
    let copy: any = { id, data }
    if (get(selected).id) copy = get(selected)
    else if (get(activeEdit).items.length) copy = { id: "item", data: get(activeEdit) }
    else if (window.getSelection()) navigator.clipboard.writeText(window.getSelection()!.toString())

    if (!copy || !copyActions[copy.id]) return

    let copyObj = clone(copy)
    if (getData && copyActions[copy.id]) copy.data = copyActions[copy.id](copy.data)

    if (copy.data) clipboard.set(copy)

    console.log("COPIED:", copyObj)
    console.log("CLIPBOARD:", get(clipboard))

    return copyObj
}

// pasting text in editbox is it's own function
export function paste(clip: any = null, extraData: any = {}) {
    if (!clip) clip = get(clipboard)
    let activeElem: any = document.activeElement
    console.log(activeElem?.classList)
    // activeElem.tagName !== "BODY"
    // if (clip.id === null || activeElem?.classList?.contains("edit")) {
    if (clip.id === null) {
        if (!activeElem?.classList?.contains("edit")) return
        navigator.clipboard.readText().then((clipText: string) => {
            // TODO: insert at caret pos
            // TODO: paste properly in textbox
            if (activeElem.nodeName === "INPUT" || activeElem.nodeName === "TEXTAREA") activeElem.value += clipText
            else activeElem.innerHTML += clipText
        })
        return
    }

    if (!pasteActions[clip.id]) return
    pasteActions[clip.id](clip.data, extraData)

    console.log("PASTED:", clip)
}

export function cut(data: any = {}) {
    let copyData = copy(data)
    if (!copyData) return
    deleteAction(copyData)

    console.log("CUTTED:", copyData)
}

export function deleteAction({ id, data }) {
    if (!deleteActions[id]) return false
    deleteActions[id](data)

    console.log("DELETED:", { id, data })
    return true
}

export function duplicate(data: any = {}) {
    if (duplicateActions[data.id]) {
        duplicateActions[data.id](data.data)

        console.log("DUPLICATED:", data)
        return true
    }

    let copyData = copy(data)
    if (!copyData) return false
    paste(null, { index: copyData.data[0]?.index })

    console.log("DUPLICATED:", copyData)
    return true
}

export function selectAll(data: any = {}) {
    let newSelection: any[] = []

    if (document.activeElement?.classList?.contains("edit")) {
        // TODO: select all text
        return
    }

    if (!data.id && get(selected)) data = get(selected)

    // select all slides with current group
    if (data.id === "group") {
        let ref = _show().layouts("active").ref()[0]
        data.data.forEach(({ id }: any) => {
            ref.forEach((b, i) => {
                if (b.type === "child" ? id === b.parent.id : id === b.id) newSelection.push({ index: i })
            })
        })

        selected.set({ id: "slide", data: newSelection })
        return
    }

    // select all item boxes in edit mode
    if (get(activeEdit) && get(activePage) === "edit") {
        let itemCount: number = 0

        if (!get(activeEdit).type || get(activeEdit).type === "show") {
            let ref = _show().layouts("active").ref()[0]
            let editSlide = ref[get(activeEdit).slide!]
            let items = _show().slides([editSlide.id]).get()[0].items
            console.log(_show().slides([editSlide.id]).get())
            console.log(items)
            itemCount = items.length
        } else if (get(activeEdit).id) {
            if (get(activeEdit).type === "overlay") {
                itemCount = get(overlays)[get(activeEdit).id!].items.length
            } else if (get(activeEdit).type === "template") {
                itemCount = get(templates)[get(activeEdit).id!].items.length
            }
        }

        if (!itemCount) return
        let items: number[] = [...Array(itemCount)].map((_, i) => i)

        activeEdit.set({ ...get(activeEdit), items })
        return
    }

    // select all item boxes in stage mode
    if (get(activeStage) && get(activePage) === "stage") {
        let items: string[] = Object.keys(get(stageShows)[get(activeStage).id!].items)

        activeStage.set({ ...get(activeStage), items })
        return
    }

    // select all slides in show mode
    if ((get(activeShow)?.type === "show" || get(activeShow)?.type === undefined) && get(activePage) === "show") {
        let ref = _show().layouts("active").ref()[0]
        if (!ref?.length) return
        newSelection = ref.map((_: any, index: number) => ({ index }))

        selected.set({ id: "slide", data: newSelection })
        return
    }

    // select all dates in current month
    if (get(activePage) === "calendar") {
        let currentDay = get(activeDays)[0]
        if (!currentDay) return

        let dayDate = new Date(currentDay)
        let year = dayDate.getFullYear()
        let month = dayDate.getMonth()

        let daysList: any = []
        for (let i = 1; i <= getDaysInMonth(year, month); i++) daysList.push(new Date(year, month, i).getTime())
        activeDays.set(daysList)
    }
}

// WIP duplicate of functions in Calendar.svelte
const getMonthIndex = (month: number) => (month + 1 < 12 ? month + 1 : 0)
const getDaysInMonth = (year: number, month: number) => new Date(year, getMonthIndex(month), 0).getDate()

/////

const copyActions: any = {
    item: (data: any) => {
        // data = data.sort((a: any, b: any) => a.index - b.index)
        let items: Item[] = []

        if (data.id) {
            if (data.type === "overlay") {
                items = get(overlays)[data.id!].items
            }

            if (data.type === "template") {
                items = get(templates)[data.id!].items
            }
        } else {
            let ref = _show(data.id || "active")
                .layouts("active")
                .ref()?.[0]?.[data.slide!]
            if (!ref) return null

            items = _show(data.id || "active")
                .slides([ref.id])
                .items()
                .get(null, false)[0]
        }

        items = items.filter((_a: any, i: number) => data.items.includes(i))
        return [...items]
    },
    slide: (data: any) => {
        let ref = _show().layouts("active").ref()?.[0]
        let ids = data.map((a: any) => a.id || (a.index !== undefined ? ref[a.index].id : ""))

        let slides = clone(_show().slides(ids).get())
        slides = slides.map((slide) => {
            // make children parent
            if (slide.group === null) {
                // this should never be here
                delete slide.children

                let parent = ref.find((a) => a.id === slide.id)?.parent || ""
                // check that parent is not copied
                if (ids.includes(parent)) return slide

                slide.group = ""
            }

            return slide
        })

        // TODO: copy layout (media) too

        return slides
    },
    group: (data: any) => copyActions.slide(data),
    overlay: (data: any) => {
        return data.map((id: string) => get(overlays)[id])
    },
    template: (data: any) => {
        return data.map((id: string) => get(templates)[id])
    },
}

const pasteActions: any = {
    item: (data: any) => {
        if (!data) return

        if (get(activeEdit).id) {
            if (get(activeEdit).type === "overlay") {
                let items = clone(get(overlays)[get(activeEdit).id!].items || [])
                data.forEach((item: any) => {
                    items.push(clone(item))
                })
                history({ id: "UPDATE", newData: { key: "items", data: items }, oldData: { id: get(activeEdit).id }, location: { page: "edit", id: "overlay_items" } })
                return
            }

            if (get(activeEdit).type === "template") {
                let items = clone(get(templates)[get(activeEdit).id!].items || [])
                data.forEach((item: any) => {
                    items.push(clone(item))
                })
                history({ id: "UPDATE", newData: { key: "items", data: items }, oldData: { id: get(activeEdit).id }, location: { page: "edit", id: "template_items" } })
                return
            }

            return
        }

        let ref = _show().layouts("active").ref()[0][get(activeEdit).slide!]
        let items: any[] = []
        data.forEach((item: any) => {
            items.push(clone(item))
        })
        history({ id: "UPDATE", newData: { data: items, key: "slides", keys: [ref.id], subkey: "items", index: -1 }, oldData: { id: get(activeShow)!.id }, location: { page: "edit", id: "show_key" } })
    },
    slide: (data: any, { index }: any) => {
        if (!data) return

        // clone slides
        data = clone(data)

        // get all slide ids & child ids
        let copiedIds: string[] = data.map((a: any) => a.id)
        // let childs: any[] = []
        // data.forEach((slide: any) => {
        //   copiedIds.push(slide.id)
        //   if (slide.children?.length) childs.push(...slide.children)
        // })

        let slides: any = _show().get().slides
        let ref: any[] = _show().layouts("active").ref()[0]
        let newSlides: any[] = []

        // remove children
        data.map((slide: any) => {
            // has children
            if (slide.children) {
                let children: string[] = []
                children = slide.children.filter((child: string) => copiedIds.includes(child))
                // if (JSON.stringify(children) !== JSON.stringify(slide.children)) slide.id = uid()
                if (children.length && slide.children.length > children.length) slide.children = children

                // clone children
                let clonedChildren: string[] = []
                slide.children.forEach((childId: string) => {
                    if (!slides[childId]) return
                    let childSlide: any = clone(slides[childId])
                    childSlide.id = uid()
                    clonedChildren.push(childSlide.id)
                    newSlides.push(childSlide)
                })

                slide.children = clonedChildren
            } else if (slide.group === null && !copiedIds.includes(slide.id)) {
                // is child
                let slideRef = ref.find((a) => a.id === slide.id)
                let parent: any = slides[slideRef.parent.id]
                slide.group = parent.group || ""
                slide.color = parent.color || ""
                slide.globalGroup = parent.globalGroup || ""
            }

            slide.id = uid()
            newSlides.push(slide)
        })
        // TODO: children next to each other should be grouped

        history({ id: "SLIDES", newData: { data: newSlides, index: index ? index + 1 : undefined } })
        setTimeout(() => console.log(get(showsCache)), 1000)
    },
    group: (data: any) => pasteActions.slide(data),
    overlay: (data: any) => {
        data?.forEach((slide: any) => {
            slide = JSON.parse(JSON.stringify(slide))
            slide.name += " 2"
            history({ id: "UPDATE", newData: { data: slide }, location: { page: "drawer", id: "category_overlays" } })
        })
    },
    template: (data: any) => {
        data?.forEach((slide: any) => {
            slide = JSON.parse(JSON.stringify(slide))
            slide.name += " 2"
            history({ id: "UPDATE", newData: { data: slide }, location: { page: "drawer", id: "category_templates" } })
        })
    },
}

const deleteActions = {
    item: (data) => {
        if (document.activeElement?.classList.contains("edit")) return

        let editId: string = get(activeEdit).id || ""
        if (editId) {
            // overlay / template
            let currentItems: any[] = []
            if (get(activeEdit).type === "overlay") currentItems = clone(get(overlays)[editId].items)
            if (get(activeEdit).type === "template") currentItems = clone(get(templates)[editId].items)

            get(activeEdit).items.forEach((i: number) => {
                if (currentItems[i]) currentItems.splice(i, 1)
            })

            let override = editId + "#" + get(activeEdit).items?.join(",")
            history({
                id: "UPDATE",
                oldData: { id: editId },
                newData: { key: "items", data: currentItems, indexes: get(activeEdit).items },
                location: { page: "edit", id: get(activeEdit).type + "_items", override },
            })

            return
        }

        let layout = data.layout || _show().get("settings.activeLayout")
        let slide = data.slideId || _show().layouts("active").ref()[0][data.slide].id
        history({
            id: "deleteItem",
            location: {
                page: "edit",
                show: get(activeShow)!,
                items: get(activeEdit).items,
                layout,
                slide,
            },
        })
    },
    slide: (data) => {
        removeSlide(data)
    },
    group: (data: any) => {
        history({ id: "SLIDES", oldData: { data: data.map(({ id }: any) => ({ id })) } })
    },
    timer: (data: any) => {
        data.forEach((a) => {
            let id = a.id || a.timer?.id
            deleteTimer(id)
        })
    },
    global_timer: (data: any) => deleteActions.timer(data),
    folder: (data: any) => historyDelete("UPDATE", data, { updater: "project_folder" }),
    project: (data: any) => historyDelete("UPDATE", data, { updater: "project" }),
    stage: (data: any) => historyDelete("UPDATE", data, { updater: "stage" }),
    category_shows: (data: any) => historyDelete("UPDATE", data, { updater: "category_shows" }),
    category_media: (data: any) => historyDelete("UPDATE", data, { updater: "category_media" }),
    category_audio: (data: any) => historyDelete("UPDATE", data, { updater: "category_audio" }),
    category_overlays: (data: any) => historyDelete("UPDATE", data, { updater: "category_overlays" }),
    category_templates: (data: any) => historyDelete("UPDATE", data, { updater: "category_templates" }),
    player: (data: any) => historyDelete("UPDATE", data, { updater: "player_video" }),
    overlay: (data: any) => historyDelete("UPDATE", data, { updater: "overlay" }),
    template: (data: any) => historyDelete("UPDATE", data, { updater: "template" }),
    category_scripture: (data: any) => {
        scriptures.update((a: any) => {
            data.forEach((id: string) => {
                let key: string | null = null
                Object.entries(a).forEach(([sId, value]: any) => {
                    if (value.id === id || sId === id) key = sId
                })

                if (key) delete a[key]
            })
            return a
        })
    },
    event: (data: any) => {
        history({ id: "UPDATE", newData: { id: data.id }, location: { page: "calendar", id: "event" } })
    },
    midi: (data: any) => {
        data = data[0]
        let id: string = data.id

        let key = data.type === "in" ? "receiveMidi" : "sendMidi"

        // remove from all layouts
        let ref = _show().layouts("active").ref()[0]
        ref.forEach((slideRef: any, i: number) => {
            let actions = clone(slideRef.data.actions) || {}
            if (actions[key] !== id) return
            delete actions[key]

            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [i] } })
        })

        if (data.type === "in") {
            midiIn.update((a) => {
                delete a[id]
                return a
            })
            return
        }

        // remove this
        let showMidi = _show().get("midi") || {}
        delete showMidi[id]
        _show().set({ key: "midi", value: showMidi })
    },
    show_drawer: () => {
        activePopup.set("delete_show")
    },
    // "remove"
    show: (data: any) => {
        if (!get(activeProject)) return
        let shows = get(projects)[get(activeProject)!].shows
        let indexes: number[] = []

        // don't remove private shows
        data.forEach(({ index }) => {
            let projectRef = shows[index]
            if (projectRef.type === "show" || projectRef.type === undefined) {
                let isPrivate = _show(projectRef.id).get("private")
                if (isPrivate) return
            }
            indexes.push(index)
        })

        if (get(activeShow)?.index !== undefined && indexes.includes(get(activeShow)!.index!)) {
            activeShow.update((a) => {
                delete a!.index
                return a
            })
        }

        history({ id: "UPDATE", newData: { key: "shows", data: shows.filter((_a, i) => !indexes.includes(i)) }, oldData: { id: get(activeProject) }, location: { page: "show", id: "project_key" } })
    },
    layout: (data: any) => {
        if (data.length < _show().layouts().get().length) {
            data.forEach((id: string) => {
                history({ id: "UPDATE", newData: { id: get(activeShow)?.id }, oldData: { key: "layouts", subkey: id }, location: { page: "show", id: "show_layout" } })
            })
        } else {
            alertMessage.set("error.keep_one_layout")
            activePopup.set("alert")
        }
    },
}

const duplicateActions = {
    event: (data: any) => {
        let event = clone(get(events)[data.id])
        event.name += " 2"
        event.repeat = false
        delete event.group
        delete event.repeatData

        history({ id: "UPDATE", newData: { data: event }, location: { page: "calendar", id: "event" } })
    },
    show: (data: any) => {
        if (!get(activeProject)) return
        data = data.map((a) => ({ id: a.id, type: a.type || "show" }))
        projects.update((a) => {
            a[get(activeProject)!].shows.push(...data)
            return a
        })
    },
    show_drawer: (data: any) => duplicateShows(data),
    stage: (data: any) => {
        let stageId = data[0].id
        let stage = get(stageShows)[stageId]
        history({ id: "UPDATE", newData: { data: clone(stage) }, location: { page: "stage", id: "stage" } })
    },
    layout: () => {
        let data = clone(get(showsCache)[get(activeShow)!.id].layouts[get(showsCache)[get(activeShow)!.id].settings.activeLayout])
        history({ id: "UPDATE", newData: { key: "layouts", subkey: uid(), data }, oldData: { id: get(activeShow)?.id }, location: { page: "show", id: "show_layout" } })
    },
}

// HELPER FUNCTIONS

function historyDelete(id, data, { updater } = { updater: "" }) {
    data.forEach((a: any) => history({ id, newData: { id: a.id || a }, location: { page: get(activePage) as any, id: updater || undefined } }))
}

async function duplicateShows(selected: any) {
    await loadShows(selected.map(({ id }: any) => id))
    selected.forEach(({ id }: any) => {
        let show = JSON.parse(JSON.stringify(get(showsCache)[id]))
        show.name += " 2"
        show.timestamps.modified = new Date().getTime()
        history({ id: "UPDATE", newData: { data: show, remember: { project: id === "show" ? get(activeProject) : null } }, location: { page: "show", id: "show" } })
    })
}
