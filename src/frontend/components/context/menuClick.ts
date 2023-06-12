import { get } from "svelte/store"
import { uid } from "uid"
import { MAIN, OUTPUT, STAGE } from "../../../types/Channels"
import type { Slide } from "../../../types/Show"
import { changeSlideGroups } from "../../show/slides"
import {
    activeDrawerTab,
    activeEdit,
    activePage,
    activePopup,
    activeRename,
    activeShow,
    currentOutputSettings,
    dictionary,
    drawerTabsData,
    eventEdit,
    events,
    forceClock,
    media,
    outLocked,
    outputs,
    overlays,
    popupData,
    previousShow,
    projectView,
    projects,
    saved,
    scriptures,
    selected,
    settingsTab,
    shows,
    showsCache,
    slidesOptions,
    stageShows,
    styles,
} from "../../stores"
import { send } from "../../utils/request"
import { save } from "../../utils/save"
import { playPauseGlobal } from "../drawer/timers/timers"
import { addChords } from "../edit/scripts/chords"
import { exportProject } from "../export/project"
import { clone } from "../helpers/array"
import { copy, cut, deleteAction, duplicate, paste, selectAll } from "../helpers/clipboard"
import { GetLayoutRef } from "../helpers/get"
import { history, redo, undo } from "../helpers/history"
import { getExtension, getFileName, getMediaType, removeExtension } from "../helpers/media"
import { getActiveOutputs, setOutput } from "../helpers/output"
import { select } from "../helpers/select"
import { sendMidi } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import { OPEN_FOLDER } from "./../../../types/Channels"
import { activeProject } from "./../../stores"
import { newToast } from "../../utils/messages"

export function menuClick(id: string, enabled: boolean = true, menu: any = null, contextElem: any = null, actionItem: any = null, sel: any = {}) {
    let obj = { sel, actionItem, enabled, contextElem, menu }
    console.log("MENU CLICK: " + id, obj)
    if (actions[id]) return actions[id](obj)
    console.log("MISSING CONTEXT: ", id)
}

const actions: any = {
    // file
    save: () => save(),
    import: () => activePopup.set("import"),
    export_more: () => activePopup.set("export"),
    settings: () => activePage.set("settings"),
    quit: () => {
        if (get(saved)) send(MAIN, ["CLOSE"])
        else activePopup.set("unsaved")
    },
    // view
    fullscreen: () => send(MAIN, ["FULLSCREEN"]),
    // edit
    undo: () => undo(),
    redo: () => redo(),
    history: () => activePopup.set("history"),
    cut: () => cut(),
    copy: () => copy(),
    paste: () => paste(),
    // view
    // help
    docs: () => window.api.send(MAIN, { channel: "URL", data: "https://freeshow.app/docs" }),
    shortcuts: () => activePopup.set("shortcuts"),
    about: () => activePopup.set("about"),
    // main
    rename: (obj: any) => {
        if (obj.sel.id === "slide" || obj.sel.id === "group" || obj.sel.id === "overlay" || obj.sel.id === "template") activePopup.set("rename")
        else if (obj.sel.id === "show") activeRename.set("show_" + obj.sel.data[0].id + "#" + obj.sel.data[0].index)
        else if (obj.sel.id === "show_drawer") activeRename.set("show_drawer_" + obj.sel.data[0].id)
        else if (obj.sel.id === "project") activeRename.set("project_" + obj.sel.data[0].id)
        else if (obj.sel.id === "folder") activeRename.set("folder_" + obj.sel.data[0].id)
        else if (obj.sel.id === "layout") activeRename.set("layout_" + obj.sel.data[0])
        else if (obj.sel.id === "player") activeRename.set("player_" + obj.sel.data[0])
        else if (obj.sel.id === "stage") activeRename.set("stage_" + obj.sel.data[0].id)
        else if (obj.sel.id?.includes("category")) activeRename.set("category_" + get(activeDrawerTab) + "_" + obj.sel.data[0])
        else console.log("Missing rename", obj)
    },
    remove: (obj: any) => {
        if (deleteAction(obj.sel)) return

        console.error("COULD NOT REMOVE", obj)
    },
    recolor: (obj: any) => {
        if (obj.sel.id === "slide" || obj.sel.id === "group" || obj.sel.id === "overlay" || obj.sel.id === "template") activePopup.set("color")
    },
    remove_group: (obj: any) => removeGroup(obj.sel.data),
    remove_slide: (obj: any) => removeSlide(obj.sel.data, "remove"),
    delete_slide: (obj: any) => {
        let ref: any[] = _show().layouts("active").ref()[0]
        let slideId: string = ref[obj.sel.data[0].index].id
        obj.sel = { id: "group", data: [{ id: slideId }] }

        actions.delete(obj)
    },
    delete: (obj: any) => {
        if (deleteAction(obj.sel)) return

        if (obj.contextElem?.classList.value.includes("#edit_box")) {
            deleteAction({ id: "item", data: { slide: get(activeEdit).slide } })
            return
        }
        if (obj.contextElem?.classList.value.includes("#event")) {
            deleteAction({ id: "event", data: { id: obj.contextElem.id } })
            return
        }

        console.error("COULD NOT DELETE", obj)
    },
    delete_all: (obj: any) => {
        if (obj.contextElem?.classList.value.includes("#event")) {
            let group: any = get(events)[obj.contextElem.id].group
            if (!group) return

            let eventIds: string[] = []
            Object.entries(get(events)).forEach(([id, event]: any) => {
                if (event.group === group) eventIds.push(id)
            })

            history({ id: "UPDATE", newData: { id: "keys" }, oldData: { keys: eventIds }, location: { page: "calendar", id: "event" } })
        }
    },
    duplicate: (obj: any) => {
        if (duplicate(obj.sel)) return

        if (obj.contextElem?.classList.value.includes("#event")) {
            duplicate({ id: "event", data: { id: obj.contextElem.id } })
            return
        }
    },
    // drawer
    enabled_drawer_tabs: (obj: any) => {
        let m = { hide: false, enabled: !obj.enabled }
        drawerTabsData.update((a) => {
            a[obj.menu.id!].enabled = !obj.enabled
            return a
        })
        return m
    },
    addToProject: (obj: any) => {
        if ((obj.sel.id !== "show" && obj.sel.id !== "show_drawer" && obj.sel.id !== "player" && obj.sel.id !== "media" && obj.sel.id !== "audio") || !get(activeProject)) return

        if (obj.sel.id === "player") obj.sel.data = obj.sel.data.map((id: string) => ({ id, type: "player" }))
        else if (obj.sel.id === "audio") obj.sel.data = obj.sel.data.map(({ path, name }: any) => ({ id: path, name, type: "audio" }))
        else if (obj.sel.id === "media")
            obj.sel.data = obj.sel.data.map(({ path, name }: any) => ({
                id: path,
                name,
                type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length)),
            }))

        projects.update((a) => {
            a[get(activeProject)!].shows.push(...obj.sel.data)
            return a
        })
    },
    toggle_clock: () => {
        forceClock.set(!get(forceClock))
    },

    // output
    force_output: () => {
        let enabledOutputs: any[] = getActiveOutputs(get(outputs), false)
        enabledOutputs.forEach((id) => {
            let output: any = { id, ...get(outputs)[id] }
            // , force: e.ctrlKey || e.metaKey
            send(OUTPUT, ["DISPLAY"], { enabled: true, output, force: true })
        })
    },
    toggle_output: (obj: any) => {
        let id: string = obj.contextElem.id
        send(OUTPUT, ["DISPLAY"], { enabled: "toggle", one: true, output: { id, ...get(outputs)[id] } })
    },
    move_to_front: (obj: any) => {
        send(OUTPUT, ["TO_FRONT"], obj.contextElem.id)
    },

    // new
    newShowPopup: () => activePopup.set("show"),

    newShow: () => history({ id: "UPDATE", newData: { remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } }),
    newPrivateShow: () => history({ id: "UPDATE", newData: { replace: { private: true }, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } }),
    newProject: (obj: any) => {
        let parent: string = obj.sel.data[0]?.id || obj.contextElem.id || "/" // obj.contextElem.getAttribute("data-parent")
        history({ id: "UPDATE", newData: { replace: { parent } }, location: { page: "show", id: "project" } })
    },
    newFolder: (obj: any) => {
        if (obj.contextElem.classList.contains("#folder__projects") || obj.contextElem.classList.contains("#projects")) {
            let parent = obj.sel.data[0]?.id || obj.contextElem.id || "/"
            history({ id: "UPDATE", newData: { replace: { parent } }, location: { page: "show", id: "project_folder" } })
            return
        }

        if (obj.contextElem.classList.contains("#category_media_button__category_media")) {
            window.api.send(OPEN_FOLDER, { channel: "MEDIA", title: get(dictionary).new?.folder })
            return
        }

        if (obj.contextElem.classList.contains("#category_audio")) {
            window.api.send(OPEN_FOLDER, { channel: "AUDIO", title: get(dictionary).new?.folder })
            return
        }
    },
    newSlide: () => {
        history({ id: "SLIDES" })
    },
    newCategory: (obj: any) => {
        let classList = obj.contextElem.classList?.value || ""
        let index = classList.indexOf("#category")
        let id = classList.slice(index + 1, classList.indexOf(" ", index))
        id = id.split("__")[1] || id
        history({ id: "UPDATE", location: { page: "drawer", id } })
    },
    newScripture: () => activePopup.set("import_scripture"),

    // scripture collection
    createCollection: (obj: any) => {
        if (obj.sel.id !== "category_scripture") return
        let versions: string[] = obj.sel.data
        // remove collections
        versions = versions.filter((id) => !Object.entries(get(scriptures)).find(([tabId, a]) => (tabId === id || a.id === id) && a.collection !== undefined))
        console.log(versions)
        if (versions.length < 2) return

        console.log(get(scriptures))

        let name = ""
        versions.forEach((id, i) => {
            if (i > 0) name += " + "
            let bibleName: string = Object.values(get(scriptures)).find((a) => a.id === id)?.name || ""
            // shorten
            bibleName = bibleName.replace(/[^a-zA-Z ]+/g, "").trim()
            if (bibleName.split(" ").length < 2) bibleName = bibleName.slice(0, 3)
            else bibleName = bibleName.split(" ").reduce((current, word) => (current += word[0]), "")
            name += bibleName
        })

        scriptures.update((a) => {
            a[uid()] = { name, collection: { versions } }
            return a
        })
    },

    // project
    export: (obj: any) => {
        if (!obj.contextElem.classList.value.includes("project")) return
        if (obj.sel.id !== "project" && !get(activeProject)) return
        let projectId: string = obj.sel.data[0]?.id || get(activeProject)
        exportProject(get(projects)[projectId])
    },
    close: (obj: any) => {
        if (obj.contextElem.classList.contains("media")) {
            if (get(previousShow)) {
                activeShow.set(JSON.parse(get(previousShow)))
                previousShow.set(null)
            }
            return
        }

        // project
        if (obj.contextElem.classList.contains("#projectTab")) {
            activeProject.set(null)
            projectView.set(true)
            return
        }

        // shows
        if (!obj.contextElem.closest(".center")) return
        activeShow.set(null)
    },
    private: (obj: any) => {
        showsCache.update((a: any) => {
            obj.sel.data.forEach((b: any) => {
                if (!a[b.id]) return
                a[b.id].private = !a[b.id].private
            })
            return a
        })
        shows.update((a: any) => {
            obj.sel.data.forEach((b: any) => {
                if (a[b.id].private) delete a[b.id].private
                else a[b.id].private = true
            })
            return a
        })
    },
    section: (obj) => {
        let index: number = obj.sel.data[0] ? obj.sel.data[0].index + 1 : get(projects)[get(activeProject)!]?.shows?.length || 0
        history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: get(activeProject) }, location: { page: "show", id: "section" } })
    },

    // slide views
    view_grid: () => {
        slidesOptions.set({ ...get(slidesOptions), mode: "grid" })
    },
    view_list: () => {
        slidesOptions.set({ ...get(slidesOptions), mode: "list" })
    },
    view_lyrics: () => {
        slidesOptions.set({ ...get(slidesOptions), mode: "lyrics" })
    },
    view_text: () => {
        slidesOptions.set({ ...get(slidesOptions), mode: "text" })
    },

    // show
    disable: (obj: any) => {
        if (obj.sel.id === "slide") {
            showsCache.update((a) => {
                obj.sel.data.forEach((b: any) => {
                    let ref = GetLayoutRef()[b.index]
                    let slides = a[get(activeShow)!.id].layouts[a[get(activeShow)!.id].settings.activeLayout].slides
                    if (ref.type === "child") {
                        if (!slides[ref.layoutIndex].children) slides[ref.layoutIndex].children = {}
                        slides[ref.layoutIndex].children[ref.id] = { ...slides[ref.layoutIndex].children[ref.id], disabled: !obj.enabled }
                    } else slides[ref.index].disabled = !obj.enabled
                })
                return a
            })
            return
        }
        if (obj.sel.id === "group") {
            let ref = _show().layouts("active").ref()[0]
            let groupIds: string[] = obj.sel.data.map(({ id }) => id)
            let disabled = !ref.find((a) => a.id === groupIds[0]).data.disabled
            let allGroupSlidesInLayout = ref.filter((a) => groupIds.includes(a.parent?.id || a.id))

            allGroupSlidesInLayout.forEach((slideRef) => {
                if (slideRef.type === "child") {
                    _show().layouts("active").slides([slideRef.parent.index]).children([slideRef.id]).set({ key: "disabled", value: disabled })
                    return
                }

                _show().layouts("active").slides([slideRef.index]).set({ key: "disabled", value: disabled })
            })
        }
        if (obj.sel.id === "stage") {
            // history({ id: "changeStage", newData: {key: "disabled", value: }, location: { page: "stage", slide: obj.sel.data.map(({id}: any) => (id)) } })
            stageShows.update((a) => {
                let value: boolean = !a[obj.sel.data[0].id].disabled
                obj.sel.data.forEach((b: any) => {
                    a[b.id].disabled = value
                })
                return a
            })
        }
    },

    edit: (obj: any) => {
        if (obj.sel.id === "slide") {
            activeEdit.set({ slide: obj.sel.data[0].index, items: [] })
            activePage.set("edit")
        } else if (obj.sel.id === "media") {
            activeEdit.set({ type: "media", id: obj.sel.data[0].path, items: [] })
            activePage.set("edit")
        } else if (["overlay", "template", "effect"].includes(obj.sel.id)) {
            activeEdit.set({ type: obj.sel.id, id: obj.sel.data[0], items: [] })
            activePage.set("edit")
        } else if (obj.sel.id === "global_group") {
            settingsTab.set("groups")
            activePage.set("settings")
        } else if (obj.sel.id === "timer") {
            activePopup.set("timer")
        } else if (obj.sel.id === "global_timer") {
            select("timer", { id: obj.sel.data[0].id })
            activePopup.set("timer")
        } else if (obj.sel.id === "midi") {
            popupData.set(obj.sel.data[0])
            activePopup.set("midi")
        } else if (obj.contextElem?.classList.value.includes("#event")) {
            eventEdit.set(obj.contextElem.id)
            activePopup.set("edit_event")
        } else if (obj.contextElem?.classList.value.includes("output_button")) {
            currentOutputSettings.set(obj.contextElem.id)
            settingsTab.set("outputs")
            activePage.set("settings")
        }
    },

    // chords
    custom_key: (obj: any) => {
        let data = obj.sel.data[0]
        selected.set(obj.sel)

        if (!data.chord) {
            // create chord
            let item = _show().slides([data.slideId]).items([data.itemIndex]).get()[0][0]
            addChords(item, { showId: get(activeShow)!.id, id: data.slideId }, data.itemIndex)
        }

        activePopup.set("rename")
    },

    // change slide group
    slide_groups: (obj: any) => changeSlideGroups(obj),

    actions: (obj: any) => changeSlideAction(obj, obj.menu.id),
    remove_media: (obj: any) => {
        let type: "image" | "overlays" | "music" = obj.menu.icon
        let slide: number = obj.sel.data[0].index
        let newData: any = null

        let layoutSlide = _show().layouts("active").ref()[0][slide].data
        if (type === "image") {
            newData = { key: "background", data: null, indexes: [slide] }
        } else if (type === "overlays") {
            let ol = layoutSlide.overlays
            // remove clicked
            ol.splice(ol.indexOf(obj.menu.id), 1)
            newData = { key: "overlays", data: ol, dataIsArray: true, indexes: [slide] }
        } else if (type === "music") {
            let audio = layoutSlide.audio
            // remove clicked
            audio.splice(audio.indexOf(obj.menu.id), 1)
            newData = { key: "audio", data: audio, dataIsArray: true, indexes: [slide] }
        }

        if (newData) history({ id: "SHOW_LAYOUT", newData })
    },
    keys: (obj: any) => {
        if (get(selected).id !== "chord") return
        let data = get(selected).data[0]

        let item: any = _show().slides([data.slideId]).items([data.itemIndex]).get()[0][0]

        let newLines: any = [...item.lines!]
        if (data.chord) {
            let currentChordIndex = newLines[data.index].chords.findIndex((a) => a.id === data.chord.id)
            newLines[data.index].chords[currentChordIndex].key = obj.menu.id
        } else {
            if (!newLines[0].chords) newLines[0].chords = []
            newLines[0].chords.push({ id: uid(), pos: 0, key: obj.menu.id })
        }

        _show()
            .slides([data.slideId])
            .items([data.itemIndex])
            .set({ key: "lines", values: [newLines] })
    },

    // media
    preview: (obj: any) => {
        let path: string = obj.sel.data[0].path || obj.sel.data[0].id
        if (!path) return

        activeEdit.set({ id: path, type: "media", items: [] })
        let name = removeExtension(getFileName(path))
        let type = getMediaType(getExtension(path))
        activeShow.set({ id: path, name, type })
    },
    play: (obj: any) => {
        if (obj.sel.id === "midi") {
            sendMidi(obj.sel.data[0])
            return
        }

        if (obj.sel.id.includes("timer")) {
            obj.sel.data.forEach((data) => {
                playPauseGlobal(data.id, data)
            })
            return
        }

        // video
        let path = obj.sel.data[0].path || obj.sel.data[0].id
        if (!path) return
        let filter: string = ""
        Object.entries(get(media)[path]?.filter || {}).forEach(([id, a]: any) => (filter += ` ${id}(${a})`))
        if (!get(outLocked)) setOutput("background", { path, filter })
    },
    play_no_filters: (obj: any) => {
        let path = obj.sel.data[0].path || obj.sel.data[0].id
        if (!path) return
        if (!get(outLocked)) setOutput("background", { path })
    },
    favourite: (obj: any) => {
        let favourite: boolean = get(media)[obj.sel.data[0].path || obj.sel.data[0].id]?.favourite !== true
        obj.sel.data.forEach((card: any) => {
            let path = card.path || card.id
            media.update((a) => {
                if (!a[path]) a[path] = { filter: "" }
                if (obj.sel.id === "audio") a[path].audio = true
                a[path].favourite = favourite
                return a
            })
        })
    },

    // overlays
    lock_to_output: (obj: any) => {
        if (obj.sel.id !== "overlay") return
        let setLocked: boolean = !get(overlays)[obj.sel.data[0]]?.locked

        overlays.update((a) => {
            obj.sel.data.forEach((id: string) => {
                a[id].locked = setLocked
            })
            return a
        })
    },

    // stage
    move_connections: (obj: any) => {
        console.log(obj)
        let stageId = obj.sel.data[0].id
        console.log(stageId)
        window.api.send(STAGE, { channel: "SWITCH", data: { id: stageId } })
    },

    // drawer navigation
    changeIcon: () => activePopup.set("icon"),

    selectAll: (obj: any) => selectAll(obj.sel),

    // formats
    uppercase: (obj: any) => format("uppercase", obj),
    lowercase: (obj: any) => format("lowercase", obj),
    capitalize: (obj: any) => format("capitalize", obj),
    trim: (obj: any) => format("trim", obj),
}

function changeSlideAction(obj: any, id: string) {
    let layoutSlide: number = obj.sel.data[0]?.index || 0
    let ref = _show().layouts("active").ref()[0]

    if (id.includes("Midi")) {
        let midiId: string = uid()
        let actions = clone(ref[layoutSlide].data.actions) || {}

        if (actions[id]) midiId = actions[id]
        else actions[id] = midiId

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [layoutSlide] } })

        let data: any = { id: midiId }
        // sendMidi | receiveMidi
        if (id === "receiveMidi") data = { id: midiId, type: "in", index: layoutSlide }

        popupData.set(data)
        activePopup.set("midi")

        return
    }

    if (id === "outputStyle") {
        let actions = clone(ref[layoutSlide]?.data?.actions) || {}
        let styleId: string = actions[id] || Object.keys(get(styles))[0]

        if (!styleId) {
            newToast("No styles")
            return
        }

        if (!actions[id]) actions[id] = styleId

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [layoutSlide] }, location: { page: "show", override: "change_style_slide" } })

        let data: any = { id: styleId, index: layoutSlide }

        popupData.set(data)
        activePopup.set("choose_style")

        return
    }

    let indexes: number[] = obj.sel.data.map(({ index }) => index)

    // this is old and has to be stored as this
    if (id === "loop") {
        let loop = ref[layoutSlide]?.data?.end || false
        // WIP this does not work with multiple for some reason
        history({ id: "SHOW_LAYOUT", newData: { key: "end", data: !loop, indexes } })

        return
    }

    let actionsList: any[] = []
    indexes.forEach((index: number) => {
        let actions: any = ref[index]?.data?.actions || {}
        actions[id] = !actions[id]
        actionsList.push(actions)
    })

    history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actionsList, indexes } })
}

export function removeGroup(data: any) {
    // TODO: add new slide, and only remove the selected one

    let ref = _show().layouts("active").ref()[0]
    let firstSlideId = ref[0].id

    let removeSlideIds: any[] = []
    data.forEach((slideRef) => {
        if (!slideRef.index) return
        let refSlide = ref.find((a) => a.layoutIndex === slideRef.index)
        if (refSlide?.type === "child" || refSlide?.id === firstSlideId) return

        removeSlideIds.push(refSlide.id)
    })
    removeSlideIds = [...new Set(removeSlideIds)]
    if (!removeSlideIds.length) return

    let newParentIds: any = {}

    // remove from layout
    let activeLayout = _show().get("settings.activeLayout")
    let layout = clone(_show().layouts([activeLayout]).get("slides")[0])
    let newLayoutSlides: any[] = []
    layout.forEach((layoutRef, i: number) => {
        if (!removeSlideIds.includes(layoutRef.id)) {
            newLayoutSlides.push(layoutRef)
            return
        }

        let currentIndex = newLayoutSlides.length - 1
        let layoutIndex = ref.find((a) => a.id === layoutRef.id && a.index === i)?.layoutIndex
        let isSelected = data.find((a) => a.index === layoutIndex)
        if (isSelected) newParentIds[layoutRef.id] = newLayoutSlides[currentIndex].id

        if (!Object.keys(layoutRef).length) return

        if (!newLayoutSlides[currentIndex].children) newLayoutSlides[currentIndex].children = {}
        let id = layoutRef.id
        delete layoutRef.id
        newLayoutSlides[currentIndex].children[id] = layoutRef
    })

    let slides = clone(_show().get("slides"))
    Object.keys(slides).forEach((slideId) => {
        let slide: Slide = slides[slideId]
        let willChange = removeSlideIds.includes(slideId)
        if (!willChange) return

        let newParent: string = newParentIds[slideId]
        if (!newParent) return

        let children = slide.children || []
        if (!slides[newParent].children) slides[newParent].children = []

        slides[newParent].children = [...slides[newParent].children, slideId, ...children]
        delete slides[slideId].children

        delete slides[slideId].globalGroup
        slides[slideId].group = null
        slides[slideId].color = null
    })

    let newData = { slides, layout: newLayoutSlides }
    history({ id: "slide", newData, location: { layout: activeLayout, page: "show", show: get(activeShow)! } })
}

export function removeSlide(data: any, type: "delete" | "remove" = "delete") {
    let ref = _show().layouts("active").ref()[0]
    let parents: any[] = []
    let childs: any[] = []

    // remove parents and delete childs
    data.forEach(({ index }: any) => {
        if (!ref[index]) return

        if (type === "remove") {
            index = ref[index].parent?.layoutIndex ?? index
            parents.push({ index: ref[index].index, id: ref[index].id })
            return
        }

        if (ref[index].type === "parent") parents.push({ index: ref[index].index, id: ref[index].id })
        else childs.push({ id: ref[index].id })
    })

    let slides = parents
    // don't do anything with the children if it's removing parents
    if (type === "remove") slides = [...new Set(slides)]
    else slides.push(...childs)

    if (!slides.length) return

    history({ id: "SLIDES", oldData: { type, data: slides } })
}

function format(id: string, obj: any) {
    let slides: any[] = []
    let ref: any = _show().layouts("active").ref()[0]
    if (obj.sel.id?.includes("slide")) {
        slides = obj.sel.data.map((a: any) => ref[a.index].id)
    } else {
        slides = [
            _show()
                .slides([ref[get(activeEdit).slide!].id])
                .get()[0].id,
        ]
    }

    slides.forEach((slide) => {
        let items: any = _show().slides([slide]).items(get(activeEdit).items).get()[0]
        let newData: any = { style: { values: [] } }

        let newItems: any[] = []
        items.forEach((item: any) => {
            item.lines?.forEach((line: any, j: number) => {
                line.text?.forEach((text: any, k: number) => {
                    item.lines[j].text[k].value = formatting[id](text.value)
                })
            })
            newItems.push(item)
        })
        newData.style.values = newItems

        history({ id: "setItems", newData, location: { page: get(activePage) as any, show: get(activeShow)!, items: get(activeEdit).items, slide: slide } })
    })
}

const formatting: any = {
    uppercase: (t: string) => t.toUpperCase(),
    lowercase: (t: string) => t.toLowerCase(),
    capitalize: (t: string) => (t.length > 1 ? t[0].toUpperCase() + t.slice(1, t.length) : t.toUpperCase()),
    trim: (t: string) =>
        t
            .trim()
            .trim()
            .replace(/[.,!]*$/g, "")
            .trim(),
}
