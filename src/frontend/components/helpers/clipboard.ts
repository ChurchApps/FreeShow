import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../../types/IPC/Main"
import type { Clipboard } from "../../../types/Main"
import type { Folder, Project } from "../../../types/Projects"
import type { Item } from "../../../types/Show"
import { sendMain } from "../../IPC/main"
import {
    activeDays,
    activeDrawerTab,
    activePage,
    activePopup,
    activeProject,
    activeShow,
    activeStage,
    audioFolders,
    audioPlaylists,
    audioStreams,
    categories,
    clipboard,
    currentOutputSettings,
    dictionary,
    drawerTabsData,
    events,
    focusedArea,
    folders,
    media,
    mediaFolders,
    midiIn,
    outputs,
    overlayCategories,
    overlays,
    projects,
    refreshEditSlide,
    scriptures,
    selectAllAudio,
    selectAllMedia,
    selected,
    shows,
    showsCache,
    stageShows,
    styles,
    templateCategories,
    templates,
    themes,
    timers,
    triggers,
    variables,
    videoMarkers,
} from "../../stores"
import { newToast, triggerFunction } from "../../utils/common"
import { removeSlide } from "../context/menuClick"
import { deleteTimer } from "../drawer/timers/timers"
import { setCaret } from "../edit/scripts/textStyle"
import { activeEdit } from "./../../stores"
import { clone, keysToID, removeDeleted, removeDuplicates } from "./array"
import { pasteText } from "./caretHelper"
import { history } from "./history"
import { getFileName, removeExtension } from "./media"
import { loadShows } from "./setShow"
import { checkName, getLayoutRef } from "./show"
import { _show } from "./shows"

export function copy(clip: Clipboard | null = null, getData: boolean = true, duplicate: boolean = false) {
    let copy: Clipboard | null = clip

    if (window.getSelection()?.toString()) {
        navigator.clipboard.writeText(window.getSelection()!.toString())
        return
    }

    if (get(selected).id) copy = get(selected)
    else if (get(activeEdit).items.length) copy = { id: "item", data: get(activeEdit) }

    if (!copy?.id || !copyActions[copy.id]) return

    let copyObj = clone(copy)
    if (getData && copyActions[copy.id]) copy.data = copyActions[copy.id](copy.data)

    if (duplicate) {
        return { id: null, data: copy, index: copyObj.data?.[0]?.index }
    }

    if (copy.data) clipboard.set(copy)

    console.log("COPIED:", copyObj)
    console.log("CLIPBOARD:", get(clipboard))

    return copyObj
}

// pasting text in editbox is it's own function
export function paste(clip: Clipboard | null = null, extraData: any = {}, customElem: HTMLElement | null = null) {
    if (!clip) clip = get(clipboard)
    let activeElem = document.activeElement

    // activeElem.tagName !== "BODY"
    // if (clip.id === null || activeElem?.classList?.contains("edit")) {

    // edit item has its own paste function
    if (activeElem?.closest(".editItem")) return

    if (customElem?.closest(".edit")) activeElem = customElem
    if (activeElem?.closest(".edit")) {
        pasteText(activeElem)
        return
    }

    if (clip.id === null) return

    if (!pasteActions[clip.id]) return
    pasteActions[clip.id](clip.data, extraData)

    console.log("PASTED:", clip)
}

export function cut(clip: Clipboard | null = null) {
    let copyData = copy(clip)
    if (!copyData) return
    deleteAction(copyData)

    console.log("CUTTED:", copyData)
}

export function deleteAction(clip: Clipboard | { id: null; data: Clipboard; index: any }, type: string = "delete") {
    console.log("DELETE", clip.id, clip.data)
    if (!clip?.id) return false
    if (!deleteActions[clip.id]) return false

    let deleted = deleteActions[clip.id](clip.data, type)

    console.log("DELETED:", clip)
    if (deleted !== false) selected.set({ id: null, data: [] })
    return true
}

export function duplicate(clip: Clipboard | null = null) {
    if (clip?.id && duplicateActions[clip.id]) {
        duplicateActions[clip.id](clip.data)

        console.log("DUPLICATED:", clip)
        return true
    }

    let copyData = copy(clip, true, true)
    if (!copyData?.data) return false
    paste(copyData.data, { index: (copyData as any).index })

    console.log("DUPLICATED:", copyData)
    return true
}

export function selectAll(data: any = {}) {
    let activeElem = document.activeElement
    if (activeElem?.nodeName === "INPUT" || activeElem?.nodeName === "TEXTAREA") {
        ;(activeElem as HTMLInputElement).select()
        return
    }

    if (activeElem?.classList?.contains("edit")) {
        setCaret(document.activeElement, { line: 0, pos: 0 }, true)
        return
    }

    let selectId = data.id || get(selected)?.id || get(focusedArea)
    if (!selectId) {
        if (get(activeEdit) && get(activePage) === "edit") selectId = "edit_items"
        else if (get(activeStage) && get(activePage) === "stage") selectId = "stage_items"
        else if (get(activeDrawerTab) === "calendar" && get(drawerTabsData).calendar?.activeSubTab !== "timers") selectId = "events"
        else if ((get(activeShow)?.type === "show" || get(activeShow)?.type === undefined) && get(activePage) === "show") selectId = "slide"
        else return
    }

    data = get(selected)?.data || []

    if (selectId === "group" && !data?.length) selectId = "slide"
    if (selectId === "folder" && !data?.length) selectId = "project"

    if (selectActions[selectId]) selectActions[selectId](data)
    else console.log("MISSING SELECT:", selectId)

    // NOT IN USE
    // category_calendar
    // media, player, cameram, microphone, audio
}

// WIP duplicate of functions in Calendar.svelte
const getMonthIndex = (month: number) => (month + 1 < 12 ? month + 1 : 0)
const getDaysInMonth = (year: number, month: number) => new Date(year, getMonthIndex(month), 0).getDate()

/////

const selectActions = {
    show_drawer: () => {
        let data: string[] = []

        let activeTab = get(drawerTabsData).shows?.activeSubTab
        if (!activeTab) return

        let showsList: string[] = Object.keys(get(shows)).filter((id) => !get(shows)[id].private)
        if (!showsList.length) return

        if (activeTab === "all") {
            data = showsList
        } else {
            data = showsList.filter((id) => {
                let show = get(shows)[id]
                if (!show) return false
                if (activeTab === show.category) return true
                if (activeTab !== "unlabeled") return false
                if (show.category === null || !get(categories)[show.category]) return true
                return false
            })
        }

        selected.set({ id: "show_drawer", data: data.map((id) => ({ id })) })
    },
    group: (data: any) => {
        let newSelection: any[] = []
        let ref = getLayoutRef()

        data.forEach(({ id }) => {
            ref.forEach((b, i) => {
                if (b.type === "child" ? id === b.parent?.id : id === b.id) newSelection.push({ index: i, showId: get(activeShow)?.id })
            })
        })

        selected.set({ id: "slide", data: newSelection })
        return
    },
    edit_items: () => {
        let itemCount: number = 0

        if (!get(activeEdit).type || get(activeEdit).type === "show") {
            let ref = getLayoutRef()
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
    },
    stage_items: () => {
        let items: string[] = Object.keys(get(stageShows)[get(activeStage).id!].items)

        activeStage.set({ ...get(activeStage), items })
        return
    },
    events: () => {
        let currentDay = get(activeDays)[0]
        if (!currentDay) return

        let dayDate = new Date(currentDay)
        let year = dayDate.getFullYear()
        let month = dayDate.getMonth()

        let daysList: number[] = []
        for (let i = 1; i <= getDaysInMonth(year, month); i++) daysList.push(new Date(year, month, i).getTime())
        activeDays.set(daysList)
    },
    slide: () => {
        let newSelection: any[] = []
        let ref = getLayoutRef()
        if (!ref?.length) return

        newSelection = ref.map((_, index) => ({ index, showId: get(activeShow)?.id }))

        selected.set({ id: "slide", data: newSelection })
    },
    category_shows: () => {
        let newSelection: any[] = Object.keys(get(categories))
        selected.set({ id: "category_shows", data: newSelection })
    },
    category_media: () => {
        let newSelection: any[] = Object.keys(get(mediaFolders))
        selected.set({ id: "category_media", data: newSelection })
    },
    category_audio: () => {
        let newSelection: any[] = Object.keys(get(audioFolders))
        selected.set({ id: "category_audio", data: newSelection })
    },
    category_overlays: () => {
        let newSelection: any[] = Object.keys(get(overlayCategories))
        selected.set({ id: "category_overlays", data: newSelection })
    },
    category_templates: () => {
        let newSelection: any[] = Object.keys(get(templateCategories))
        selected.set({ id: "category_templates", data: newSelection })
    },
    category_scripture: () => {
        let newSelection: any[] = Object.values(get(scriptures)).map(({ id }) => id)
        selected.set({ id: "category_scripture", data: newSelection })
    },
    scripture: () => triggerFunction("scripture_selectAll"),
    stage: () => {
        let newSelection: any[] = Object.keys(get(stageShows))
        newSelection = newSelection.map((id) => ({ id }))
        selected.set({ id: "stage", data: newSelection })
    },
    folder: () => {
        let newSelection: any[] = Object.keys(get(folders)).map((id) => ({ type: "folder", id }))
        selected.set({ id: "folder", data: newSelection })
    },
    project: () => {
        let newSelection: any[] = removeDeleted(keysToID(get(projects))).map(({ id }) => ({ type: "project", id }))
        selected.set({ id: "project", data: newSelection })
    },
    show: () => {
        if (!get(activeProject)) return

        let newSelection: any[] = get(projects)[get(activeProject)!]?.shows.map((a, index) => ({ ...a, name: a.name || removeExtension(getFileName(a.id)), index }))
        selected.set({ id: "show", data: newSelection })
    },
    overlay: () => {
        let selectedCategory = get(drawerTabsData).overlays?.activeSubTab || ""

        let newSelection: any[] = Object.entries(get(overlays)).map(([id, a]) => ({ ...a, id }))
        if (selectedCategory !== "all") newSelection = newSelection.filter((a) => (selectedCategory === "unlabeled" ? !a.category : a.category === selectedCategory))
        newSelection = newSelection.map(({ id }) => id)

        selected.set({ id: "overlay", data: newSelection })
    },
    template: () => {
        let selectedCategory = get(drawerTabsData).templates?.activeSubTab || ""

        let newSelection: any[] = Object.entries(get(templates)).map(([id, a]) => ({ ...a, id }))
        if (selectedCategory !== "all") newSelection = newSelection.filter((a) => (selectedCategory === "unlabeled" ? !a.category : a.category === selectedCategory))
        newSelection = newSelection.map(({ id }) => id)

        selected.set({ id: "template", data: newSelection })
    },
    media: () => selectAllMedia.set(true),
    audio: () => selectAllAudio.set(true),
}

const copyActions = {
    item: (data: any) => {
        // data = data.sort((a, b) => a.index - b.index)
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

        items = items.filter((_a, i) => data.items.includes(i))
        return [...items]
    },
    slide: (data: any, fullGroup: boolean = false) => {
        let ref = getLayoutRef()
        let layouts: any[] = []
        let media: any = {}

        // dont know why this is like this when ctrl + c
        if (data.slides) data = data.slides

        let sortedData = data.sort((a, b) => (a.index < b.index ? -1 : 1))

        let ids = sortedData.map((a) => {
            // get layout
            if (a.index !== undefined) layouts.push(ref[a.index].data)

            return a.id || (a.index !== undefined ? ref[a.index].id : "")
        })

        if (fullGroup) {
            // select all children of group
            let allSlides = _show().get("slides")
            let newIds: string[] = []
            ids.forEach((id: string) => {
                let children = allSlides[id]?.children || []
                newIds.push(id, ...children)
            })
            ids = removeDuplicates(newIds)
        }

        let slides = clone(_show().slides(ids).get())
        slides = slides.map((slide) => {
            if (slide.group !== null) return slide

            // make children parent
            // this should never be here
            delete slide.children

            let parent = ref.find((a) => a.id === slide.id)?.parent || ""
            // check that parent is not copied
            if (ids.includes(parent)) return slide

            // slide.group = ""
            slide.oldChild = slide.id

            return slide
        })

        let layoutMedia = layouts.filter((a) => a.background || a.audio?.length)
        let showMedia = _show().get().media
        layoutMedia.forEach((layoutData) => {
            let mediaIds: string[] = []
            if (layoutData.background) mediaIds.push(layoutData.background)
            if (layoutData.audio?.length) mediaIds.push(...layoutData.audio)

            mediaIds.forEach((mediaId) => {
                let m = showMedia[mediaId]
                if (m) media[mediaId] = m
            })
        })

        return { slides, layouts, media }
    },
    group: (data: any) => copyActions.slide(data, true),
    overlay: (data: any) => {
        return data.map((id: string) => clone(get(overlays)[id]))
    },
    template: (data: any) => {
        return data.map((id: string) => clone(get(templates)[id]))
    },
}

const pasteActions = {
    item: (data: any) => {
        if (!data || get(activePage) !== "edit") return

        if (get(activeEdit).id) {
            if (get(activeEdit).type === "overlay") {
                let items = clone(get(overlays)[get(activeEdit).id!].items || [])
                data.forEach((item) => {
                    items.push(clone(item))
                })
                history({ id: "UPDATE", newData: { key: "items", data: items }, oldData: { id: get(activeEdit).id }, location: { page: "edit", id: "overlay_items" } })
                return
            }

            if (get(activeEdit).type === "template") {
                let items = clone(get(templates)[get(activeEdit).id!].items || [])
                data.forEach((item) => {
                    items.push(clone(item))
                })
                history({ id: "UPDATE", newData: { key: "items", data: items }, oldData: { id: get(activeEdit).id }, location: { page: "edit", id: "template_items" } })
                return
            }

            return
        }

        let ref = getLayoutRef()[get(activeEdit).slide!]
        let items: any[] = []
        data.forEach((item) => {
            items.push(clone(item))
        })
        history({ id: "UPDATE", newData: { data: items, key: "slides", keys: [ref.id], subkey: "items", index: -1 }, oldData: { id: get(activeShow)!.id }, location: { page: "edit", id: "show_key" } })
    },
    slide: (data: any, { index }: any = {}) => {
        if (!data) return

        // clone slides
        data = clone(data)

        // WIP update media id if already existing

        // data.slides.reverse()
        // if (data.layouts) data.layouts.reverse()

        // get all slide ids & child ids
        let copiedIds: string[] = data.slides.map((a) => a.id)
        // let childs = []
        // data.forEach((slide) => {
        //   copiedIds.push(slide.id)
        //   if (slide.children?.length) childs.push(...slide.children)
        // })

        // TODO: duplicate each individual slide as their own

        // let slides = clone(_show().get().slides)
        // let ref = getLayoutRef()
        let newSlides: any[] = []

        let layouts: any[] = []

        let addedChildren: string[] = []

        // remove children
        data.slides.forEach((slide, i) => {
            // dont add child if it is already copied
            if (slide.group === null && addedChildren.includes(slide.id)) return

            slide.id = uid()
            newSlides.push(slide)

            // has children
            if (slide.children) {
                // let children: string[] = []
                // children = slide.children.filter((child: string) => copiedIds.includes(child))
                // if (children.length && slide.children.length > children.length) slide.children = children

                // clone selected children
                let clonedChildren: string[] = []
                slide.children.forEach((childId: string) => {
                    // !slides[childId]
                    if (!copiedIds.includes(childId)) return
                    let childSlide: any = clone(data.slides.find((a) => a.id === childId))
                    if (!childSlide) return

                    addedChildren.push(childId)

                    childSlide.id = uid()
                    delete childSlide.oldChild
                    clonedChildren.push(childSlide.id)
                    newSlides.push(childSlide)
                })

                slide.children = clonedChildren
                // } else if (slide.group === null && !copiedIds.includes(slide.id)) {
                //     // is child
                //     let slideRef = ref.find((a) => a.id === slide.id)
                //     let parent = slides[slideRef.parent.id]
                //     slide.group = parent.group || ""
                //     slide.color = parent.color || ""
                //     slide.globalGroup = parent.globalGroup || ""
            }

            // add layout
            let layout = data.layouts?.[i]
            if (!layout) return
            layouts[i] = layout
        })
        // TODO: children next to each other should be grouped

        console.log(newSlides)

        // TODO: undo/redo this is buggy

        // media
        if (data.media) {
            let showMedia = _show().get().media
            _show().set({ key: "media", value: { ...showMedia, ...data.media } })
        }

        history({ id: "SLIDES", newData: { data: newSlides, layouts, index: index !== undefined ? index + 1 : undefined } })
        setTimeout(() => console.log(get(showsCache)), 1000)
    },
    group: (data: any) => pasteActions.slide(data),
    overlay: (data: any) => {
        data?.forEach((slide) => {
            let newSlide = clone(slide)
            newSlide.name += " 2"
            history({ id: "UPDATE", newData: { data: newSlide }, location: { page: "drawer", id: "overlay" } })
        })
    },
    template: (data: any) => {
        data?.forEach((slide) => {
            let newSlide = clone(slide)
            newSlide.name += " 2"
            history({ id: "UPDATE", newData: { data: newSlide }, location: { page: "drawer", id: "template" } })
        })
    },
}

const deleteActions = {
    item: (data) => {
        if (document.activeElement?.classList.contains("edit")) return

        let editId: string = get(activeEdit).id || ""
        if (editId) {
            // overlay / template
            let currentItems: Item[] = []
            if (get(activeEdit).type === "overlay") currentItems = clone(get(overlays)[editId].items)
            if (get(activeEdit).type === "template") currentItems = clone(get(templates)[editId].items)

            get(activeEdit).items.forEach((i: number) => {
                if (currentItems[i]) currentItems.splice(i, 1)
            })

            let override = editId + "_delete#" + get(activeEdit).items?.join(",")
            history({
                id: "UPDATE",
                oldData: { id: editId },
                newData: { key: "items", data: currentItems },
                location: { page: "edit", id: get(activeEdit).type + "_items", override },
            })

            return finish()
        }

        let layout = data.layout || _show().get("settings.activeLayout")
        let slide = data.slideId || getLayoutRef()[data.slide].id
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

        finish()
        function finish() {
            refreshEditSlide.set(true)
            activeEdit.set({ ...get(activeEdit), items: [] })
        }
    },
    slide: (data, type: "delete" | "remove" = "delete") => {
        removeSlide(data, type)
        if (get(activePage) === "edit") refreshEditSlide.set(true)
    },
    group: (data: any) => {
        history({ id: "SLIDES", oldData: { type: "delete_group", data: data.map(({ id }: any) => ({ id })) } })
    },
    action: (data: any) => {
        // WIP history
        data.forEach((selData) => {
            midiIn.update((a) => {
                delete a[selData.id]
                return a
            })

            sendMain(Main.CLOSE_MIDI, { id: selData.id })
        })
    },
    timer: (data: any) => {
        data.forEach((a) => {
            let id = a.id || a.timer?.id
            deleteTimer(id)
        })
    },
    global_timer: (data: any) => deleteActions.timer(data),
    // TODO: history
    variable: (data: any) => {
        variables.update((a) => {
            data.forEach(({ id }) => {
                delete a[id]
            })

            return a
        })
    },
    trigger: (data: any) => {
        triggers.update((a) => {
            data.forEach(({ id }) => {
                delete a[id]
            })

            return a
        })
    },
    audio_stream: (data: any) => {
        audioStreams.update((a) => {
            data.forEach(({ id }) => {
                delete a[id]
            })

            return a
        })
    },
    audio: (data: any) => {
        // remove audio from playlist
        let activePlaylist = get(drawerTabsData).audio?.activeSubTab || ""
        if (!activePlaylist) return

        audioPlaylists.update((a) => {
            let songs = clone(a[activePlaylist]?.songs || [])
            data.forEach((song) => {
                let currentSongIndex = songs.findIndex((a) => a === song.path)
                if (currentSongIndex >= 0) songs.splice(currentSongIndex, 1)
            })

            a[activePlaylist].songs = songs

            return a
        })
    },
    folder: (data: any) => historyDelete("UPDATE", data, { updater: "project_folder" }),
    project: (data: any) => historyDelete("UPDATE", data, { updater: "project" }),
    project_template: (data: any) => historyDelete("UPDATE", data, { updater: "project_template" }),
    stage: (data: any) => historyDelete("UPDATE", data, { updater: "stage" }),
    category_shows: (data: any) => historyDelete("UPDATE", data, { updater: "category_shows" }),
    category_media: (data: any) => historyDelete("UPDATE", data, { updater: "category_media" }),
    category_audio: (data: any) => {
        if (get(audioPlaylists)[data[0]]) historyDelete("UPDATE", data, { updater: "audio_playlists" })
        else historyDelete("UPDATE", data, { updater: "category_audio" })
    },
    category_overlays: (data: any) => historyDelete("UPDATE", data, { updater: "category_overlays" }),
    category_templates: (data: any) => historyDelete("UPDATE", data, { updater: "category_templates" }),
    player: (data: any) => historyDelete("UPDATE", data, { updater: "player_video" }),
    overlay: (data: any) => historyDelete("UPDATE", data, { updater: "overlay" }),
    template: (data: any) => historyDelete("UPDATE", data, { updater: "template" }),
    category_scripture: (data: any) => {
        scriptures.update((a) => {
            data.forEach((id: string) => {
                let key: string | null = null
                Object.entries(a).forEach(([sId, value]) => {
                    if (value.id === id || sId === id) key = sId
                })

                if (key) delete a[key]
            })
            return a
        })
    },
    event: (data: any) => {
        history({ id: "UPDATE", newData: { id: data.id }, location: { page: "drawer", id: "event" } })
    },
    midi: (data: any) => {
        data = data[0]
        let id: string = data.id

        let key = data.type === "in" ? "receiveMidi" : "sendMidi"

        // remove from all layouts
        let ref = getLayoutRef()
        ref.forEach((slideRef, i) => {
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
        return false
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

            if (get(activeShow)!.type === "section") {
                activeShow.set(null)
            }
        }

        history({ id: "UPDATE", newData: { key: "shows", data: shows.filter((_a, i) => !indexes.includes(i)) }, oldData: { id: get(activeProject) }, location: { page: "show", id: "project_key" } })
    },
    layout: (data: any) => {
        if (data.length < _show().layouts().get().length) {
            data.forEach((id: string) => {
                history({ id: "UPDATE", newData: { id: get(activeShow)?.id }, oldData: { key: "layouts", subkey: id }, location: { page: "show", id: "show_layout" } })
            })
        } else {
            newToast("$error.keep_one_layout")
        }
    },
    video_subtitle: (data: any) => {
        let index = data.index
        let id = get(activeShow)?.id || ""
        if (!id) return

        media.update((a) => {
            if (a[id]?.tracks?.[index]) {
                a[id].tracks!.splice(index, 1)
                // reset tracks if all deleted, so any embedded tracks can be readded
                if (!a[id].tracks!.length) delete a[id].tracks
            }
            return a
        })
    },
    video_marker: (data: any) => {
        let index = data.index
        let id = get(activeShow)?.id || ""
        if (!id) return

        videoMarkers.update((a) => {
            a[id].splice(index, 1)

            return a
        })
    },
    theme: (data: any) => {
        data.forEach(({ id }) => {
            if (id === "default") return
            history({ id: "UPDATE", newData: { id: id }, location: { page: "settings", id: "settings_theme" } })
        })
    },
    style: (data: any) => {
        data.forEach(({ id }) => {
            history({ id: "UPDATE", newData: { id }, location: { page: "settings", id: "settings_style" } })
        })
    },
    output: (data: any) => {
        data.forEach(({ id }) => {
            // delete key output
            if (get(outputs)[id]?.keyOutput) history({ id: "UPDATE", newData: { id: get(outputs)[id].keyOutput }, location: { page: "settings", id: "settings_output" } })

            history({ id: "UPDATE", newData: { id }, location: { page: "settings", id: "settings_output" } })
        })

        currentOutputSettings.set(Object.keys(get(outputs))[0])
    },
    tag: (data: any) => {
        let tagId = data[0]?.id || ""
        history({ id: "UPDATE", newData: { id: tagId }, location: { page: "show", id: "tag" } })
    },
    chord: (data: any) => {
        data = data[0]

        let item: Item = _show().slides([data.slideId]).items([data.itemIndex]).get()[0][0]

        let newLines = clone(item.lines || [])
        let currentChordIndex = newLines[data.index].chords?.findIndex((a) => a.id === data.chord.id) ?? -1
        if (currentChordIndex < 0) return

        newLines[data.index].chords!.splice(currentChordIndex, 1)

        _show()
            .slides([data.slideId])
            .items([data.itemIndex])
            .set({ key: "lines", values: [newLines] })
    },
    stage_item: (data: any) => {
        let activeItems = get(activeStage).items || []
        if (!data.id || !activeItems.length) return

        stageShows.update((a) => {
            activeItems.forEach((itemId) => {
                delete a[data.id].items[itemId]
            })
            return a
        })
        activeStage.set({ ...get(activeStage), items: [] })
    },
}

const duplicateActions = {
    event: (data: any) => {
        let event = clone(get(events)[data.id])
        event.name += " 2"
        event.repeat = false
        delete event.group
        delete event.repeatData

        history({ id: "UPDATE", newData: { data: event }, location: { page: "drawer", id: "event" } })
    },
    show: (data: any) => {
        if (!get(activeProject)) return

        data = data.map((a) => {
            let newShowRef = clone(a)
            delete newShowRef.index
            if (!newShowRef.type) newShowRef.type = "show"
            if (newShowRef.type === "show") delete newShowRef.name
            return newShowRef
        })

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
    layout: (data: any) => {
        let layoutId = data?.[0] || get(showsCache)[get(activeShow)!.id]?.settings?.activeLayout
        if (!layoutId) return

        let newLayout = clone(get(showsCache)[get(activeShow)!.id].layouts[layoutId])
        newLayout.name += " 2"
        history({ id: "UPDATE", newData: { key: "layouts", subkey: uid(), data: newLayout }, oldData: { id: get(activeShow)?.id }, location: { page: "show", id: "show_layout" } })
    },
    folder: (data: any) => {
        // duplicate projects folder and all of the projects inside
        // TODO: history
        let newProjects: Project[] = []

        folders.update((a) => {
            data.forEach((folder) => {
                let id = folder.id
                folder = a[id]
                let parent = Object.values(a).find((a) => a.parent === folder.id) || folder.parent
                let newId = uid()
                a[newId] = { ...clone(folder), name: folder.name + " 2", parent }
                duplicateFolder(id, newId)
            })

            function duplicateFolder(oldParent: string, newParent: string) {
                let folderList: Folder[] = Object.entries(a).map(([id, folder]) => ({ id, ...folder }))
                folderList = folderList.filter((a) => a.parent === oldParent)

                folderList.forEach((folder) => {
                    let newId = uid()
                    a[newId] = { ...clone(folder), parent: newParent }
                    delete a[newId].id
                    duplicateFolder(folder.id!, newId)
                })

                let projectList = removeDeleted(keysToID(get(projects))).filter((a) => a.parent === oldParent)
                projectList.forEach((project) => {
                    newProjects.push({ ...clone(project), parent: newParent })
                })
            }

            return a
        })

        projects.update((a) => {
            newProjects.forEach((project) => {
                a[uid()] = project
            })

            return a
        })
    },
    project: (data: any) => {
        // TODO: history
        projects.update((a) => {
            data.forEach((project) => {
                let newProject = clone(a[project.id])
                a[uid()] = { ...newProject, name: newProject.name + " 2" }
                return a
            })
            return a
        })
    },
    theme: (data: any) => {
        data.forEach(({ id }) => {
            let theme = clone(get(themes)[id])
            let name = theme.name
            if (theme.default) name = get(dictionary).themes?.[name] || name

            history({ id: "UPDATE", newData: { data: theme, replace: { default: false, name: name + " 2" } }, location: { page: "settings", id: "settings_theme" } })
        })
    },
    style: (data: any) => {
        data.forEach(({ id }) => {
            let style = clone(get(styles)[id])
            id = uid()
            history({ id: "UPDATE", newData: { data: style, replace: { name: style.name + " 2" } }, oldData: { id }, location: { page: "settings", id: "settings_style" } })
        })
    },
    output: (data: any) => {
        data.forEach(({ id }) => {
            let output = clone(get(outputs)[id])
            id = uid()
            history({ id: "UPDATE", newData: { data: output, replace: { name: output.name + " 2" } }, oldData: { id }, location: { page: "settings", id: "settings_output" } })
        })
    },
    action: (data: any) => {
        midiIn.update((a) => {
            data.forEach(({ id }) => {
                let newAction = clone(get(midiIn)[id])
                newAction.name += " 2"

                let newId = uid()
                a[newId] = newAction
            })

            return a
        })
    },
    global_timer: (data: any) => {
        timers.update((a) => {
            data.forEach(({ id }) => {
                let newTimer = clone(get(timers)[id])
                newTimer.name += " 2"

                let newId = uid()
                a[newId] = newTimer
            })

            return a
        })
    },
}

// HELPER FUNCTIONS

const exludedCategories = ["all", "unlabeled", "favourites", "effects_library", "pixabay"]
function historyDelete(id, data, { updater } = { updater: "" }) {
    data = data.filter((a) => !exludedCategories.includes(a.id || a))
    data.forEach((a: any) => history({ id, newData: { id: a.id || a }, location: { page: get(activePage) as any, id: updater || undefined } }))
}

async function duplicateShows(selected: any) {
    await loadShows(selected.map(({ id }) => id))
    selected.forEach(({ id }) => {
        let show = clone(get(showsCache)[id])
        if (!show) return

        show.name = checkName(show.name + " 2")
        show.timestamps.modified = new Date().getTime()
        history({ id: "UPDATE", newData: { data: show, remember: { project: id === "show" ? get(activeProject) : null } }, location: { page: "show", id: "show" } })
    })
}
