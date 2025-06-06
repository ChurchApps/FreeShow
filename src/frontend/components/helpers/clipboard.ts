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
    actions,
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
    effects
} from "../../stores"
import { newToast, triggerFunction } from "../../utils/common"
import { removeSlide } from "../context/menuClick"
import { deleteTimer } from "../drawer/timers/timers"
import { updateSortedStageItems } from "../edit/scripts/itemHelpers"
import { setCaret } from "../edit/scripts/textStyle"
import { activeEdit } from "./../../stores"
import { clone, keysToID, removeDeleted, removeDuplicates } from "./array"
import { pasteText } from "./caretHelper"
import { history } from "./history"
import { getFileName, removeExtension } from "./media"
import { loadShows } from "./setShow"
import { checkName, getLayoutRef } from "./show"
import { _show } from "./shows"

export function copy(clip: Clipboard | null = null, getData = true, shouldDuplicate = false) {
    let copyData: Clipboard | null = clip

    if (window.getSelection()?.toString()) {
        navigator.clipboard.writeText(window.getSelection()!.toString())
        return
    }

    if (get(selected).id) copyData = get(selected)
    else if (get(activeEdit).items.length) copyData = { id: "item", data: get(activeEdit) }

    if (!copyData?.id || !copyActions[copyData.id]) {
        if (copyData?.id) console.info("No copy action:", copyData)
        return
    }

    const copyObj = clone(copyData)
    if (getData && copyActions[copyData.id]) copyData.data = copyActions[copyData.id](copyData.data)

    if (shouldDuplicate) {
        return { id: null, data: copyData, index: copyObj.data?.[0]?.index }
    }

    if (copyData.data) clipboard.set(copyData)

    console.info("COPIED:", copyObj)
    console.info("CLIPBOARD:", get(clipboard))

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

    // custom media paste: only paste on selected ones
    if (clip.id === "media") {
        mediaPaste(clip.data)
        return
    }

    if (!pasteActions[clip.id]) {
        if (clip.id) console.info("No paste action:", clip.id)
        return
    }
    pasteActions[clip.id](clip.data, extraData)

    console.info("PASTED:", clip)
}

export function cut(clip: Clipboard | null = null) {
    const copyData = copy(clip)
    if (!copyData) return
    deleteAction(copyData)

    console.info("CUTTED:", copyData)
}

export function deleteAction(clip: Clipboard | { id: null; data: Clipboard; index: any }, type = "delete") {
    console.info("DELETE", clip.id, clip.data)
    if (!clip?.id) return false
    if (!deleteActions[clip.id]) return false

    const deleted = deleteActions[clip.id](clip.data, type)

    console.info("DELETED:", clip)
    if (deleted !== false) selected.set({ id: null, data: [] })
    return true
}

export function duplicate(clip: Clipboard | null = null) {
    // "select" stage items
    if (!clip?.id && get(activePage) === "stage" && get(activeStage)?.items) {
        clip = { id: "stage_item", data: get(activeStage) }
    }

    if (clip?.id && duplicateActions[clip.id]) {
        duplicateActions[clip.id](clip.data)

        console.info("DUPLICATED:", clip)
        return true
    }

    const copyData = copy(clip, true, true)
    if (!copyData?.data) return false
    paste(copyData.data, { index: (copyData as any).index })

    console.info("DUPLICATED:", copyData)
    return true
}

export function selectAll(data: any = {}) {
    const activeElem = document.activeElement
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
    else console.info("MISSING SELECT:", selectId)

    // NOT IN USE
    // category_calendar
    // media, player, cameram, microphone, audio
}

// WIP duplicate of functions in Calendar.svelte
const getMonthIndex = (month: number) => (month + 1 < 12 ? month + 1 : 0)
const getDaysInMonth = (year: number, month: number) => new Date(year, getMonthIndex(month), 0).getDate()

/// //

const selectActions = {
    show_drawer: () => {
        let data: string[] = []

        const activeTab = get(drawerTabsData).shows?.activeSubTab
        if (!activeTab) return

        const showsList: string[] = Object.keys(get(shows)).filter((id) => !get(shows)[id].private)
        if (!showsList.length) return

        if (activeTab === "all") {
            data = showsList
        } else {
            data = showsList.filter((id) => {
                const show = get(shows)[id]
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
        const newSelection: any[] = []
        const ref = getLayoutRef()

        data.forEach(({ id }) => {
            ref.forEach((b, i) => {
                if (b.type === "child" ? id === b.parent?.id : id === b.id) newSelection.push({ index: i, showId: get(activeShow)?.id })
            })
        })

        selected.set({ id: "slide", data: newSelection })
        return
    },
    edit_items: () => {
        let itemCount = 0

        if (!get(activeEdit).type || get(activeEdit).type === "show") {
            const ref = getLayoutRef()
            const editSlide = ref[get(activeEdit).slide!]
            const showItems = _show().slides([editSlide.id]).get()[0].items
            itemCount = showItems.length
        } else if (get(activeEdit).id) {
            if (get(activeEdit).type === "overlay") {
                itemCount = get(overlays)[get(activeEdit).id!].items.length
            } else if (get(activeEdit).type === "template") {
                itemCount = get(templates)[get(activeEdit).id!].items.length
            }
        }

        if (!itemCount) return
        const items: number[] = [...Array(itemCount)].map((_, i) => i)

        activeEdit.set({ ...get(activeEdit), items })
        return
    },
    stage_items: () => {
        const items: string[] = Object.keys(get(stageShows)[get(activeStage).id!].items)

        activeStage.set({ ...get(activeStage), items })
        return
    },
    events: () => {
        const currentDay = get(activeDays)[0]
        if (!currentDay) return

        const dayDate = new Date(currentDay)
        const year = dayDate.getFullYear()
        const month = dayDate.getMonth()

        const daysList: number[] = []
        for (let i = 1; i <= getDaysInMonth(year, month); i++) daysList.push(new Date(year, month, i).getTime())
        activeDays.set(daysList)
    },
    slide: () => {
        let newSelection: any[] = []
        const ref = getLayoutRef()
        if (!ref?.length) return

        newSelection = ref.map((_, index) => ({ index, showId: get(activeShow)?.id }))

        selected.set({ id: "slide", data: newSelection })
    },
    category_shows: () => {
        const newSelection: any[] = Object.keys(get(categories))
        selected.set({ id: "category_shows", data: newSelection })
    },
    category_media: () => {
        const newSelection: any[] = Object.keys(get(mediaFolders))
        selected.set({ id: "category_media", data: newSelection })
    },
    category_audio: () => {
        const newSelection: any[] = Object.keys(get(audioFolders))
        selected.set({ id: "category_audio", data: newSelection })
    },
    category_overlays: () => {
        const newSelection: any[] = Object.keys(get(overlayCategories))
        selected.set({ id: "category_overlays", data: newSelection })
    },
    category_templates: () => {
        const newSelection: any[] = Object.keys(get(templateCategories))
        selected.set({ id: "category_templates", data: newSelection })
    },
    category_scripture: () => {
        const newSelection: any[] = Object.values(get(scriptures)).map(({ id }) => id)
        selected.set({ id: "category_scripture", data: newSelection })
    },
    scripture: () => triggerFunction("scripture_selectAll"),
    stage: () => {
        let newSelection: any[] = Object.keys(get(stageShows))
        newSelection = newSelection.map((id) => ({ id }))
        selected.set({ id: "stage", data: newSelection })
    },
    folder: () => {
        const newSelection: any[] = Object.keys(get(folders)).map((id) => ({ type: "folder", id }))
        selected.set({ id: "folder", data: newSelection })
    },
    project: () => {
        const newSelection: any[] = removeDeleted(keysToID(get(projects))).map(({ id }) => ({ type: "project", id }))
        selected.set({ id: "project", data: newSelection })
    },
    show: () => {
        if (!get(activeProject)) return

        const newSelection: any[] = get(projects)[get(activeProject)!]?.shows.map((a, index) => ({ ...a, name: a.name || removeExtension(getFileName(a.id)), index }))
        selected.set({ id: "show", data: newSelection })
    },
    overlay: () => {
        const selectedCategory = get(drawerTabsData).overlays?.activeSubTab || ""

        let newSelection: any[] = Object.entries(get(overlays)).map(([id, a]) => ({ ...a, id }))
        if (selectedCategory !== "all") newSelection = newSelection.filter((a) => (selectedCategory === "unlabeled" ? !a.category : a.category === selectedCategory))
        newSelection = newSelection.map(({ id }) => id)

        selected.set({ id: "overlay", data: newSelection })
    },
    template: () => {
        const selectedCategory = get(drawerTabsData).templates?.activeSubTab || ""

        let newSelection: any[] = Object.entries(get(templates)).map(([id, a]) => ({ ...a, id }))
        if (selectedCategory !== "all") newSelection = newSelection.filter((a) => (selectedCategory === "unlabeled" ? !a.category : a.category === selectedCategory))
        newSelection = newSelection.map(({ id }) => id)

        selected.set({ id: "template", data: newSelection })
    },
    media: () => selectAllMedia.set(true),
    audio: () => selectAllAudio.set(true)
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
            const ref = _show(data.id || "active")
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
    slide: (data: any, fullGroup = false) => {
        const ref = getLayoutRef()
        const layouts: any[] = []
        const mediaData: any = {}

        // dont know why this is like this when ctrl + c
        if (data.slides) data = data.slides

        const sortedData = data.sort((a, b) => (a.index < b.index ? -1 : 1))

        let ids = sortedData.map((a) => {
            // get layout
            if (a.index !== undefined) layouts.push(ref[a.index].data)

            return a.id || (a.index !== undefined ? ref[a.index].id : "")
        })

        if (fullGroup) {
            // select all children of group
            const allSlides = _show().get("slides")
            const newIds: string[] = []
            ids.forEach((id: string) => {
                const children = allSlides[id]?.children || []
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

            const parent = ref.find((a) => a.id === slide.id)?.parent || ""
            // check that parent is not copied
            if (ids.includes(parent)) return slide

            // slide.group = ""
            slide.oldChild = slide.id

            return slide
        })

        const layoutMedia = layouts.filter((a) => a.background || a.audio?.length)
        const showMedia = _show().get().media
        layoutMedia.forEach((layoutData) => {
            const mediaIds: string[] = []
            if (layoutData.background) mediaIds.push(layoutData.background)
            if (layoutData.audio?.length) mediaIds.push(...layoutData.audio)

            mediaIds.forEach((mediaId) => {
                const m = showMedia[mediaId]
                if (m) mediaData[mediaId] = m
            })
        })

        return { slides, layouts, media: mediaData }
    },
    group: (data: any) => copyActions.slide(data, true),
    overlay: (data: any) => {
        return data.map((id: string) => clone(get(overlays)[id]))
    },
    template: (data: any) => {
        return data.map((id: string) => clone(get(templates)[id]))
    },
    effect: (data: any) => {
        return data.map((id: string) => clone(get(effects)[id]))
    },
    media: (data: any) => {
        // copy style/filters of first selected media
        const path = data[0]?.path
        const mediaData = {}
        Object.entries(clone(get(media)[path] || {})).forEach(([key, value]) => {
            if (!mediaCopyKeys.includes(key)) return
            mediaData[key] = value
        })
        return { origin: path, data: mediaData, type: data[0]?.type }
    },
    // project items
    show: (data: any) => {
        const projectItems: any[] = []
        clone(data).forEach((item) => {
            delete item.index
            projectItems.push(item)
        })
        return projectItems
    }
}

const pasteActions = {
    item: (data: any) => {
        if (!data || get(activePage) !== "edit") return

        if (get(activeEdit).id) {
            if (get(activeEdit).type === "overlay") {
                const overlayItems = clone(get(overlays)[get(activeEdit).id!].items || [])
                data.forEach((item) => {
                    overlayItems.push(clone(item))
                })
                history({ id: "UPDATE", newData: { key: "items", data: overlayItems }, oldData: { id: get(activeEdit).id }, location: { page: "edit", id: "overlay_items" } })
                return
            }

            if (get(activeEdit).type === "template") {
                const templateItems = clone(get(templates)[get(activeEdit).id!].items || [])
                data.forEach((item) => {
                    templateItems.push(clone(item))
                })
                history({ id: "UPDATE", newData: { key: "items", data: templateItems }, oldData: { id: get(activeEdit).id }, location: { page: "edit", id: "template_items" } })
                return
            }

            return
        }

        const ref = getLayoutRef()[get(activeEdit).slide!]
        const items: any[] = []
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
        const copiedIds: string[] = data.slides.map((a) => a.id)
        // let childs = []
        // data.forEach((slide) => {
        //   copiedIds.push(slide.id)
        //   if (slide.children?.length) childs.push(...slide.children)
        // })

        // TODO: duplicate each individual slide as their own

        // let slides = clone(_show().get().slides)
        // let ref = getLayoutRef()
        const newSlides: any[] = []

        const layouts: any[] = []

        const addedChildren: string[] = []

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
                const clonedChildren: string[] = []
                slide.children.forEach((childId: string) => {
                    // !slides[childId]
                    if (!copiedIds.includes(childId)) return
                    const childSlide: any = clone(data.slides.find((a) => a.id === childId))
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
            const layout = data.layouts?.[i]
            if (!layout) return
            layouts[i] = layout
        })
        // TODO: children next to each other should be grouped

        // TODO: undo/redo this is buggy

        // media
        if (data.media) {
            const showMedia = _show().get().media
            _show().set({ key: "media", value: { ...showMedia, ...data.media } })
        }

        history({ id: "SLIDES", newData: { data: newSlides, layouts, index: index !== undefined ? index + 1 : undefined } })
    },
    group: (data: any) => pasteActions.slide(data),
    overlay: (data: any) => {
        data?.forEach((slide) => {
            const newSlide = clone(slide)
            delete newSlide.isDefault
            newSlide.name += " (2)"
            history({ id: "UPDATE", newData: { data: newSlide }, location: { page: "drawer", id: "overlay" } })
        })
    },
    template: (data: any) => {
        data?.forEach((slide) => {
            const newSlide = clone(slide)
            delete newSlide.isDefault
            newSlide.name += " (2)"
            history({ id: "UPDATE", newData: { data: newSlide }, location: { page: "drawer", id: "template" } })
        })
    },
    effect: (data: any) => {
        data?.forEach((effect) => {
            const newEffect = clone(effect)
            delete newEffect.isDefault
            newEffect.name += " (2)"
            history({ id: "UPDATE", newData: { data: newEffect }, location: { page: "drawer", id: "effect" } })
        })
    },
    // project items
    show: (data: any) => {
        projects.update((a) => {
            if (!a[get(activeProject) || ""]?.shows) return a
            a[get(activeProject) || ""].shows.push(...data)
            return a
        })
    }
}

const deleteActions = {
    item: (data) => {
        if (document.activeElement?.classList.contains("edit")) return

        const editId: string = get(activeEdit).id || ""
        if (editId) {
            // overlay / template
            let currentItems: Item[] = []
            if (get(activeEdit).type === "overlay") currentItems = clone(get(overlays)[editId].items)
            if (get(activeEdit).type === "template") currentItems = clone(get(templates)[editId].items)

            get(activeEdit).items.forEach((i: number) => {
                if (currentItems[i]) currentItems.splice(i, 1)
            })

            const override = editId + "_delete#" + get(activeEdit).items?.join(",")
            history({
                id: "UPDATE",
                oldData: { id: editId },
                newData: { key: "items", data: currentItems },
                location: { page: "edit", id: get(activeEdit).type + "_items", override }
            })

            return finish()
        }

        const layout = data.layout || _show().get("settings.activeLayout")
        const slide = data.slideId || getLayoutRef()[data.slide].id
        history({
            id: "deleteItem",
            location: {
                page: "edit",
                show: get(activeShow)!,
                items: get(activeEdit).items,
                layout,
                slide
            }
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
            actions.update((a) => {
                delete a[selData.id]
                return a
            })

            sendMain(Main.CLOSE_MIDI, { id: selData.id })
        })
    },
    timer: (data: any) => {
        data.forEach((a) => {
            const id = a.id || a.timer?.id
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
        const activePlaylist = get(drawerTabsData).audio?.activeSubTab || ""
        if (!activePlaylist) return

        audioPlaylists.update((a) => {
            const songs = clone(a[activePlaylist]?.songs || [])
            data.forEach((song) => {
                const currentSongIndex = songs.findIndex((path) => path === song.path)
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
    effect: (data: any) => historyDelete("UPDATE", data, { updater: "effect" }),
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
        const id: string = data.id

        const key = data.type === "in" ? "receiveMidi" : "sendMidi"

        // remove from all layouts
        const ref = getLayoutRef()
        ref.forEach((slideRef, i) => {
            const actions = clone(slideRef.data.actions) || {}
            if (actions[key] !== id) return
            delete actions[key]

            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [i] } })
        })

        if (data.type === "in") {
            actions.update((a) => {
                delete a[id]
                return a
            })
            return
        }

        // remove this
        const showMidi = _show().get("midi") || {}
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
        const projectItems = get(projects)[get(activeProject)!].shows
        const indexes: number[] = []

        // don't remove private shows
        data.forEach(({ index }) => {
            const projectRef = projectItems[index]
            if (projectRef.type === "show" || projectRef.type === undefined) {
                const isPrivate = _show(projectRef.id).get("private")
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

        history({ id: "UPDATE", newData: { key: "shows", data: projectItems.filter((_a, i) => !indexes.includes(i)) }, oldData: { id: get(activeProject) }, location: { page: "show", id: "project_key" } })
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
        const index = data.index
        const id = get(activeShow)?.id || ""
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
        const index = data.index
        const id = get(activeShow)?.id || ""
        if (!id) return

        videoMarkers.update((a) => {
            a[id].splice(index, 1)

            return a
        })
    },
    theme: (data: any) => {
        data.forEach(({ id }) => {
            if (id === "default") return
            history({ id: "UPDATE", newData: { id }, location: { page: "settings", id: "settings_theme" } })
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
        const tagId = data[0]?.id || ""
        history({ id: "UPDATE", newData: { id: tagId }, location: { page: "show", id: "tag" } })
    },
    chord: (data: any) => {
        data = data[0]

        const item: Item = _show().slides([data.slideId]).items([data.itemIndex]).get()[0][0]

        const newLines = clone(item.lines || [])
        const currentChordIndex = newLines[data.index].chords?.findIndex((a) => a.id === data.chord.id) ?? -1
        if (currentChordIndex < 0) return

        newLines[data.index].chords!.splice(currentChordIndex, 1)

        _show()
            .slides([data.slideId])
            .items([data.itemIndex])
            .set({ key: "lines", values: [newLines] })
    },
    stage_item: (data: any) => {
        const activeItems = get(activeStage).items || []
        if (!data.id || !activeItems.length) return

        stageShows.update((a) => {
            activeItems.forEach((itemId) => {
                delete a[data.id].items[itemId]
            })
            return a
        })
        activeStage.set({ ...get(activeStage), items: [] })
        updateSortedStageItems()
    }
}

const duplicateActions = {
    event: (data: any) => {
        const event = clone(get(events)[data.id])
        event.name += " 2"
        event.repeat = false
        delete event.group
        delete event.repeatData

        history({ id: "UPDATE", newData: { data: event }, location: { page: "drawer", id: "event" } })
    },
    show: (data: any) => {
        if (!get(activeProject)) return

        data = data.map((a) => {
            const newShowRef = clone(a)
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
        const stageId = data[0].id
        const stage = get(stageShows)[stageId]
        history({ id: "UPDATE", newData: { data: clone(stage) }, location: { page: "stage", id: "stage" } })
    },
    stage_item: (data: any) => {
        const stageId: string = data.id || ""
        const selectedItemIds: string[] = data.items || []
        const stage = clone(get(stageShows)[stageId])

        selectedItemIds.forEach((itemId) => {
            const item = clone(stage.items[itemId])
            stage.items[uid(5)] = item
        })

        history({ id: "UPDATE", newData: { data: stage.items, key: "items" }, oldData: { id: stageId }, location: { page: "stage", id: "stage_item_content" } })
        updateSortedStageItems()
    },
    layout: (data: any) => {
        const layoutId = data?.[0] || get(showsCache)[get(activeShow)!.id]?.settings?.activeLayout
        if (!layoutId) return

        const newLayout = clone(get(showsCache)[get(activeShow)!.id].layouts[layoutId])
        newLayout.name += " 2"
        history({ id: "UPDATE", newData: { key: "layouts", subkey: uid(), data: newLayout }, oldData: { id: get(activeShow)?.id }, location: { page: "show", id: "show_layout" } })
    },
    folder: (data: any) => {
        // duplicate projects folder and all of the projects inside
        // TODO: history
        const newProjects: Project[] = []

        folders.update((a) => {
            data.forEach((folder) => {
                const id = folder.id
                folder = a[id]
                const parent = Object.values(a).find((a1) => a1.parent === a1.id) || folder.parent
                const newId = uid()
                a[newId] = { ...clone(folder), name: folder.name + " 2", parent }
                duplicateFolder(id, newId)
            })

            function duplicateFolder(oldParent: string, newParent: string) {
                let folderList: Folder[] = Object.entries(a).map(([id, folder]) => ({ id, ...folder }))
                folderList = folderList.filter((a1) => a1.parent === oldParent)

                folderList.forEach((folder) => {
                    const newId = uid()
                    a[newId] = { ...clone(folder), parent: newParent }
                    delete a[newId].id
                    duplicateFolder(folder.id!, newId)
                })

                const projectList = removeDeleted(keysToID(get(projects))).filter((project) => project.parent === oldParent)
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
                const newProject = clone(a[project.id])
                a[uid()] = { ...newProject, name: newProject.name + " 2" }
                return a
            })
            return a
        })
    },
    theme: (data: any) => {
        data.forEach(({ id }) => {
            const theme = clone(get(themes)[id])
            let name = theme.name
            if (theme.default) name = get(dictionary).themes?.[name] || name

            history({ id: "UPDATE", newData: { data: theme, replace: { default: false, name: name + " 2" } }, location: { page: "settings", id: "settings_theme" } })
        })
    },
    style: (data: any) => {
        data.forEach(({ id }) => {
            const style = clone(get(styles)[id])
            id = uid()
            history({ id: "UPDATE", newData: { data: style, replace: { name: style.name + " 2" } }, oldData: { id }, location: { page: "settings", id: "settings_style" } })
        })
    },
    output: (data: any) => {
        data.forEach(({ id }) => {
            const output = clone(get(outputs)[id])
            id = uid()
            history({ id: "UPDATE", newData: { data: output, replace: { name: output.name + " 2" } }, oldData: { id }, location: { page: "settings", id: "settings_output" } })
        })
    },
    action: (data: any) => {
        actions.update((a) => {
            data.forEach(({ id }) => {
                const newAction = clone(get(actions)[id])
                newAction.name += " 2"

                const newId = uid()
                a[newId] = newAction
            })

            return a
        })
    },
    global_timer: (data: any) => {
        timers.update((a) => {
            data.forEach(({ id }) => {
                const newTimer = clone(get(timers)[id])
                newTimer.name += " 2"

                const newId = uid()
                a[newId] = newTimer
            })

            return a
        })
    }
}

const mediaCopyKeys = ["filter", "fit", "flipped", "flippedY", "speed", "volume"]
function mediaPaste(data: any) {
    if (!data || get(selected).id !== "media") return

    media.update((a) => {
        ;(get(selected).data || []).forEach(({ path, type }) => {
            // only paste on media with same type & don't paste back on itself
            if (type !== data.type || path === data.path) return

            if (!a[path]) a[path] = {}
            mediaCopyKeys.forEach((key) => {
                if (data.data[key] === undefined) delete a[path][key]
                else a[path][key] = data.data[key]
            })
        })
        return a
    })
}

// HELPER FUNCTIONS

const exludedCategories = ["all", "unlabeled", "favourites", "effects_library", "pixabay"]
function historyDelete(id, data, { updater } = { updater: "" }) {
    data = data.filter((a) => !exludedCategories.includes(a.id || a))
    data.forEach((a: any) => history({ id, newData: { id: a.id || a }, location: { page: get(activePage) as any, id: updater || undefined } }))
}

async function duplicateShows(selectedData: any) {
    await loadShows(selectedData.map(({ id }) => id))
    selectedData.forEach(({ id }) => {
        const show = clone(get(showsCache)[id])
        if (!show) return

        show.name = checkName(show.name + " 2")
        show.timestamps.modified = new Date().getTime()
        history({ id: "UPDATE", newData: { data: show, remember: { project: id === "show" ? get(activeProject) : null } }, location: { page: "show", id: "show" } })
    })
}
