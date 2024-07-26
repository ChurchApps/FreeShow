import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../../types/Show"
import { ShowObj } from "../../classes/Show"
import { changeLayout, changeSlideGroups } from "../../show/slides"
import {
    activeDrawerTab,
    activePage,
    activeProject,
    activeShow,
    audioExtensions,
    audioPlaylists,
    audioStreams,
    categories,
    drawerTabsData,
    imageExtensions,
    media,
    projects,
    scriptureSettings,
    shows,
    showsCache,
    templates,
    videoExtensions,
} from "../../stores"
import { getShortBibleName, getSlides, joinRange } from "../drawer/bible/scripture"
import { addItem } from "../edit/scripts/itemHelpers"
import { clone, removeDuplicates } from "./array"
import { history, historyAwait } from "./history"
import { getExtension, getFileName, getMediaType, removeExtension } from "./media"
import { addToPos, getIndexes, mover } from "./mover"
import { checkName } from "./show"
import { _show } from "./shows"
import { decodeURI } from "./audio"

function getId(drag: any): string {
    let id: string = ""
    console.log(drag)
    if (drag.id === "slide" || drag.id === "group") return "slide"
    const extension: string = getExtension(drag.data[0].name)
    if (drag.id === "files" && getMediaType(extension) === "audio") return "audio"
    if (drag.id === "show" && drag.data[0].type === "audio") return "audio"
    if ((drag.id === "show" && ["media", "image", "video"].includes(drag.data[0].type)) || drag.id === "media" || drag.id === "files" || drag.id === "camera" || drag.id === "screen") return "media"
    // if (drag.id === "audio") return "audio"
    // if (drag.id === "global_group") return "global_group"
    return drag.id || id
}

export const dropActions: any = {
    slides: ({ drag, drop }: any, history: any) => dropActions.slide({ drag, drop }, history),
    slide: ({ drag, drop }: any, history: any) => {
        history.location = { page: get(activePage), show: get(activeShow), layout: get(showsCache)[get(activeShow)!.id]?.settings?.activeLayout }

        let id: string = getId(drag)
        if (slideDrop[id]) {
            history = slideDrop[id]({ drag, drop }, history)
            return history
        }

        console.log("Missing slide drop action:", drag.id)
        return history
    },
    projects: ({ drag, drop }: any, historyRef: any) => {
        if (drag.id !== "folder" && drag.id !== "project") return
        if (drop.data.type && drop.data.type !== "folder") return

        historyRef.location.page = "show"

        let parents = drop.data.path?.split("/") || [""]
        let ids: string[] = []
        drag.data.forEach(checkData)

        function checkData(data: any) {
            if (data.type === drop.data.type) {
                // itself
                if (data.id === drop.data.id) return
                // child of itself
                if (parents[0] && data.path !== drop.data.path && parents.includes(data.id)) return
            }

            ids.push(data.id)
            historyRef.oldData = { id: data.id }

            if (data.type === "folder") {
                historyRef.id = "UPDATE"
                historyRef.location.id = "project_folder_key"
                return
            }

            historyRef.id = "UPDATE"
            historyRef.location.id = "project_key"
        }

        historyRef.newData = { key: "parent", data: drop.data.id || "/" }

        // move multiple
        ids.forEach((id) => {
            historyRef.oldData = { id }
            history(historyRef)
        })
    },
    project: ({ drag, drop }: any, history: any) => {
        history.id = "UPDATE"
        history.location = { page: "show", id: "project_ref" }
        history.oldData = { id: get(activeProject) }

        let projectShows = get(projects)[history.oldData.id]?.shows || []

        if (drop.index === undefined) drop.index = projectShows.length
        if (drag.id === "files" && drop.trigger?.includes("end")) drop.index++

        let data: any[] = drag.data
        if (drag.id === "media" || drag.id === "files") {
            data = data
                .map((a: any) => {
                    const extension: string = getExtension(a.path || a.name)
                    if (drag.id === "files" && !files[drop.id].includes(extension)) return null

                    let type: string = getMediaType(extension)

                    let name: string = a.name || getFileName(a.path)
                    return { name: decodeURI(removeExtension(name)), id: a.path, type }
                })
                .filter((a: any) => a)
        } else if (drag.id === "audio") {
            data = data.map((a: any) => ({ id: a.path, name: decodeURI(removeExtension(a.name)), type: "audio" }))
        } else if (drag.id === "player") {
            data = data.map((a: any) => ({ id: a, type: "player" }))
        } else if (drag.id === "scripture") {
            return createScriptureShow(drag)
        }

        history.newData = { key: "shows", data: [] }
        if (drag.id === "show") history.newData.data = mover(projectShows, getIndexes(data), drop.index)
        else history.newData.data = addToPos(projectShows, data, drop.index)

        return history
    },
    all_slides: ({ drag, drop }: any, h: any) => {
        h.location = { page: "show" }
        let templateId = drag.data[0]

        if (drag.id === "template") {
            h.id = "TEMPLATE"

            // TODO: add slide
            // if (trigger) location.layoutSlide = index
            let indexes: number[] = []
            if (drop.center) {
                // indexes.push(drop.index)
                // history({ id: "UPDATE", newData: { data: templateId, key: "settings", keys: ["template"] }, oldData: { id: get(activeShow)?.id }, location: { page: "show", id: "show_key" } })
                // history({ id: "SLIDES", newData: { index: drop.index, replace: { settings: isParent } } })

                let ref = _show().layouts("active").ref()[0]
                let slideId = ref[drop.index].id
                let slideSettings = _show().slides([slideId]).get("settings")
                let oldData: any = { style: clone(slideSettings) }
                let newData: any = { style: { ...clone(slideSettings), template: templateId } }

                history({
                    id: "slideStyle",
                    oldData,
                    newData,
                    location: { page: "edit", show: get(activeShow)!, slide: slideId },
                })
                return
            }
            h.newData = { id: templateId, data: { createItems: true }, indexes }
        }

        return h
    },
    navigation: ({ drag, drop }: any, h: any) => {
        if (drop.data !== "all" && get(activeDrawerTab) && (drag.id === "show" || drag.id === "show_drawer")) {
            h.id = "SHOWS"
            let data = drop.data === "unlabeled" ? null : drop.data
            let allShowIds = drag.data.map(({ id }) => id).filter((id) => get(shows)[id])
            let showsList: any[] = allShowIds.map((id) => ({ show: { category: data }, id }))
            h.newData = { replace: true, data: showsList }
            h.location = { page: "drawer" }
            historyAwait(allShowIds, h)
            return
        }

        if (drop.data === "favourites" && drag.id === "media") {
            drag.data.forEach((card: any) => {
                let path: string = card.path || card.id
                media.update((a: any) => {
                    if (!a[path]) a[path] = { filter: "" }
                    a[path].favourite = true
                    return a
                })
            })

            // return history
        }

        // audio playlist
        if (get(audioPlaylists)[drop.data] && drag.id === "audio") {
            audioPlaylists.update((a) => {
                let newSongs = drag.data.map((a) => a.path)
                a[drop.data].songs.push(...newSongs)

                return a
            })

            // return history
        }

        if (drop.data !== "all" && (drag.id === "overlay" || drag.id === "template")) {
            drag.data.forEach((id: any) => {
                history({
                    id: "UPDATE",
                    oldData: { id },
                    newData: { key: "category", data: drop.data === "unlabeled" ? null : drop.data },
                    location: { page: "drawer", id: drag.id + "_category" },
                })
            })

            // return history
        }
    },
    templates: ({ drag, drop }: any) => {
        if (drag.id === "files") {
            let mediaPath: string = drag.data?.[0]?.path
            let templateId: string = drop.data
            if (!mediaPath || !templateId) return

            if (!files[drop.id].includes(getExtension(mediaPath))) return

            let templateSettings = get(templates)[templateId]?.settings || {}
            let newData = { key: "settings", data: { ...templateSettings, backgroundPath: mediaPath } }

            history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: templateId } })

            return
        }

        if (drag.id !== "slide") return

        drag.data.forEach(({ index }: any) => {
            let ref: any = _show().layouts("active").ref()[0][index]
            let slides: any[] = _show().get().slides
            let slide: any = ref.type === "child" ? slides[ref.parent.id] : slides[ref.id]
            let activeTab: string | null = get(drawerTabsData)[get(activeDrawerTab)]?.activeSubTab

            let data: any = {
                name: slide.group || "",
                color: slide.color || "",
                category: activeTab === "all" || activeTab === "unlabeled" ? null : activeTab,
                items: slide.items,
            }
            history({ id: "UPDATE", newData: { data }, location: { page: "drawer", id: drop.id.slice(0, -1) } })
        })
    },
    overlays: ({ drag, drop }: any) => dropActions.templates({ drag, drop }),
    edit: ({ drag }: any) => {
        if (drag.id !== "media" && drag.id !== "files") return

        drag.data.forEach(({ path }: any) => addItem("media", null, { src: path }))
    },
}

// "show", "project"
const fileDropExtensions: any = [...get(imageExtensions), ...get(videoExtensions), ...get(audioExtensions)]
const mediaExtensions: any = [...get(imageExtensions), ...get(videoExtensions)]

const files: any = {
    project: fileDropExtensions,
    slides: fileDropExtensions,
    slide: fileDropExtensions,
    templates: mediaExtensions,
}

const slideDrop: any = {
    media: ({ drag, drop }: any, history: any) => {
        let data: any[] = drag.data
        // TODO: move multiple add to possible slides

        // check files
        if (drag.id === "files") {
            data = []
            drag.data.forEach((a: any) => {
                const extension: string = getExtension(a.name)
                if (files[drop.id].includes(extension)) {
                    data.push({
                        path: a.path,
                        name: decodeURI(removeExtension(a.name)),
                        type: getMediaType(extension),
                    })
                }
            })
        } else if (drag.id === "camera") data[0].type = "camera"
        else if (drag.id === "screen") data[0].type = "screen"
        else if (!data[0].name) data[0].name = data[0].path

        let center = drop.center
        if (drag.id === "files" && drop.index !== undefined) center = true

        if (center) {
            if (!data[0]) return
            history.id = "showMedia"

            if (drop.trigger?.includes("end")) drop.index!--
            history.location.layoutSlide = drop.index
            let newData = { ...data[0], path: data[0].path || data[0].id }
            delete newData.index
            delete newData.id
            history.newData = newData

            return history
        }

        history.id = "SLIDES"
        let slides: any[] = drag.data.map((a: any) => ({ id: a.id || uid(), group: removeExtension(a.name || ""), color: null, settings: {}, notes: "", items: [] }))

        let notBackgrounds: any = {}
        // videos are probably not meant to be background if they are added in bulk
        if (data.length > 1) notBackgrounds = { muted: false, loop: false }

        data = data.map((a) => ({ ...a, path: a.path || a.id, ...(a.type === "video" ? notBackgrounds : {}) }))
        history.newData = { index: drop.index, data: slides, layout: { backgrounds: data } }

        return history
    },
    audio: ({ drag, drop }: any, h: any) => {
        h.id = "showAudio"

        let data = drag.data

        if (drag.id === "files") {
            data = []
            drag.data.forEach((a: any) => {
                const extension: string = getExtension(a.name)
                if (files[drop.id].includes(extension)) {
                    data.push({
                        path: a.path,
                        name: removeExtension(a.name),
                        type: getMediaType(extension),
                    })
                }
            })
        }

        if (drop.trigger?.includes("end")) drop.index!--
        h.location.layoutSlide = drop.index

        data.forEach((audio: any) => {
            // TODO: drop both audio & video files...
            h.newData = { name: audio.name || audio.path || audio.id, path: audio.path || audio.id, type: "audio" }
            history(h)
        })
    },
    microphone: ({ drag, drop }: any, h: any) => {
        h.id = "SHOW_LAYOUT"

        if (drop.trigger?.includes("end")) drop.index!--
        let layoutSlide = drop.index

        let oldMics = _show().layouts("active").ref()[0][layoutSlide]?.data?.mics || []
        let mics = drag.data
        // remove duplicates
        oldMics.forEach((oldMic) => {
            if (!mics.find((a) => a.id === oldMic.id)) mics.push(oldMic)
        })

        h.newData = { key: "mics", data: mics, dataIsArray: true, indexes: [layoutSlide] }
        history(h)
    },
    slide: ({ drag, drop }: any, history: any) => {
        history.id = "slide"
        let ref: any[] = _show().layouts("active").ref()[0] || []

        let slides = _show().get().slides
        let oldLayout = _show().layouts("active").get()[0].slides
        history.oldData = clone({ layout: oldLayout, slides })

        // end of layout
        if (drop.index === undefined) drop.index = ref.length

        let newIndex: number = drop.index
        let moved: any[] = []
        let sortedLayout: any[] = []

        if (drag.id === "slide") {
            let selected: number[] = getIndexes(drag.data)

            // move all children when parent is moved
            selected.forEach(selectChildren)
            function selectChildren(index: number) {
                if (ref[index]?.type !== "parent") return
                console.log(newIndex, index, ref[index].children)
                let children: string[] = ref[index].children || []
                if (!children) return

                let parentMovedToOwnChildren = newIndex > index && newIndex - 1 <= index + children.length

                // select children
                if (parentMovedToOwnChildren) return

                children.map((_id: string, childIndex: number) => selected.push(index + childIndex + 1))
                selected = removeDuplicates(selected)
            }

            sortedLayout = mover(ref, selected, drop.index)

            ref = ref.filter((a: any, i: number) => {
                if (!selected.includes(i)) return true
                if (i < drop.index!) newIndex--
                moved.push(a)
                return false
            })
        } else if (drag.id === "group") {
            // WIP this does not work on children

            if (drop.center) {
                if (drop.trigger?.includes("end")) newIndex--
                // ref.splice(drop.index, 1)
                // WIP adding to children will not remove old children
            }

            moved = drag.data.map(({ index, id }: any) => ref[index] || { type: "parent", id })
            sortedLayout = addToPos(ref, moved, newIndex)
        }

        // sort layout ref
        let newLayoutRef: any[] = addToPos(ref, moved, newIndex)

        // TODO: dragging a current group on child will not remove old children
        // TODO: dragging a parent slide over its own childs will not change children

        // check if first slide child
        if (newLayoutRef[0]?.type === "child") newLayoutRef[0].newType = "parent"

        console.log(sortedLayout, slides, clone(newLayoutRef), moved, newIndex)
        history.newData = changeLayout(sortedLayout, slides, clone(newLayoutRef), moved, newIndex)
        return history
    },
    global_group: ({ drag, drop }: any, history: any) => {
        let ref: any[] = _show().layouts("active").ref()[0]
        if (!drag.data[0].slide) return

        if (drop.center) {
            if (drop.trigger?.includes("end")) drop.index--
            changeSlideGroups({ sel: { data: [{ index: drop.index }] }, menu: { id: drag.data[0].slide.globalGroup } })
            return
        }

        history.id = "slide"

        let layoutId: string = _show().get("settings.activeLayout")

        let slides: any = clone(get(showsCache)[get(activeShow)!.id].slides)
        let layout: any[] = _show().layouts([layoutId]).slides().get()[0]

        if (drop.index === undefined) drop.index = layout.length
        let newIndex: number = drop.index

        drag.data.forEach(({ slide, layoutData }: any) => {
            let id = uid()
            delete slide.id
            slides[id] = clone(slide)

            let parent = ref[newIndex - 1] || { index: -1 }
            if (parent.type === "child") parent = parent.parent

            // add layout data (if dragging a slide to another show)
            let newLayout = { id }
            if (layoutData) newLayout = { ...layoutData, id }

            layout = addToPos(layout, [newLayout], parent.index + 1)
        })

        history.newData = { slides, layout }
        history.location.layout = layoutId
        return history
    },
    overlay: ({ drag, drop }: any, history: any) => {
        history.id = "SHOW_LAYOUT"

        let ref: any = _show().layouts("active").ref()[0][drop.index!]
        let data: any[] = removeDuplicates([...(ref?.data?.overlays || []), ...drag.data])

        history.newData = { key: "overlays", data, dataIsArray: true, indexes: [drop.index] }
        return history
    },
    scripture: ({ drag, drop }: any, history: any) => {
        if (!drag.data[0]?.bibles) return

        let newSlides: any[] = getSlides(drag.data[0])
        let slideTemplate: string = get(scriptureSettings).verseNumbers ? "" : get(scriptureSettings).template || ""
        newSlides = newSlides.map((items: any) => {
            let firstTextItem = items.find((a) => a.lines)
            return { group: firstTextItem?.lines?.[0]?.text?.[0]?.value?.split(" ")?.slice(0, 4)?.join(" ")?.trim() || "", color: null, settings: { template: slideTemplate }, notes: "", items }
        })

        // set to correct order
        newSlides = newSlides.reverse()

        // WIP duplicate of global_group
        let ref: any[] = _show().layouts("active").ref()[0]

        history.id = "slide"

        let layoutId: string = _show().get("settings.activeLayout")

        let slides: any = clone(get(showsCache)[get(activeShow)!.id].slides)
        let layout: any[] = _show().layouts([layoutId]).slides().get()[0]

        // WIP incorrect index
        if (drop.index === undefined) drop.index = layout.length
        let newIndex: number = drop.index

        newSlides.forEach((slide: any) => {
            let id = uid()
            delete slide.id
            slides[id] = slide

            let parent = ref[newIndex - 1] || { index: -1 }
            if (parent.type === "child") parent = parent.parent

            layout = addToPos(layout, [{ id }], parent.index + 1)
        })

        history.newData = { slides, layout }
        history.location.layout = layoutId
        return history
    },
    trigger: ({ drag, drop }: any, history: any) => {
        history.id = "SHOW_LAYOUT"

        let data = drag.data[0]
        let actions = createSlideAction("start_trigger", drop.index, data)
        if (!actions) return

        history.newData = { key: "actions", data: actions, indexes: [drop.index] }
        return history
    },
    audio_stream: ({ drag, drop }: any, history: any) => {
        history.id = "SHOW_LAYOUT"

        let streamId = drag.data[0].id
        let stream = get(audioStreams)[streamId]
        if (!stream) return

        let data = { id: streamId, ...stream }
        let actions = createSlideAction("start_audio_stream", drop.index, data)
        if (!actions) return

        history.newData = { key: "actions", data: actions, indexes: [drop.index] }
        return history
    },
    metronome: ({ drag, drop }: any, history: any) => {
        history.id = "SHOW_LAYOUT"

        let data = drag.data[0]
        let actions = createSlideAction("start_metronome", drop.index, data, true)
        if (!actions) return

        history.newData = { key: "actions", data: actions, indexes: [drop.index] }
        return history
    },
    midi: ({ drag, drop }: any, history: any) => {
        // WIP not in use:
        history.id = "SHOW_LAYOUT"

        let ref: any = _show().layouts("active").ref()[0][drop.index!]
        let data: any = ref.data.actions || {}
        let key = drag.data[0].type === "in" ? "receiveMidi" : "sendMidi"
        data[key] = drag.data[0].id

        history.newData = { key: "actions", data, indexes: [drop.index] }
        return history
    },
    action: ({ drag, drop }: any, history: any) => {
        history.id = "SHOW_LAYOUT"

        let ref: any = _show().layouts("active").ref()[0][drop.index!]
        let data: any = ref.data.actions || {}
        let slideActions = data.slideActions || []

        // WIP MIDI you should maybe be able to add more than one
        let existingIndex = slideActions.findIndex((a) => a.triggers?.[0] === "run_action")

        let actionId = drag.data[0].id
        let action = { id: uid(), triggers: ["run_action"], actionValues: { run_action: { id: actionId } } }
        if (drag.data[0].triggers?.[0] && drag.data[0].triggers.length === 1) {
            action = drag.data[0]
            existingIndex = -1
        }

        if (existingIndex > -1) slideActions[existingIndex] = action
        else slideActions.push(action)
        data.slideActions = slideActions

        history.newData = { key: "actions", data, indexes: [drop.index] }
        return history
    },
}

// HELPERS

function createSlideAction(triggerId: string, slideIndex: number, data: any, removeExisting: boolean = false) {
    let ref: any = _show().layouts("active").ref()[0][slideIndex]
    if (!ref) return
    let actions: any = ref.data?.actions || {}
    let slideActions: any[] = actions.slideActions || []

    if (removeExisting) {
        let existingIndex = slideActions.findIndex((a) => a.triggers?.[0] === triggerId)
        if (existingIndex > -1) slideActions.splice(existingIndex, 1)
    }

    let actionValues = { [triggerId]: data }
    slideActions.push({ id: uid(), triggers: [triggerId], actionValues })

    actions.slideActions = slideActions
    return actions
}

// WIP duplicate of ScriptureInfo.svelte createSlides()
function createScriptureShow(drag) {
    let bibles = drag.data[0]?.bibles
    if (!bibles) return

    let slides: any = {}
    let layouts: any[] = []

    let newSlides: any[] = getSlides(drag.data[0])
    newSlides.forEach((items: any) => {
        let id = uid()
        let firstTextItem = items.find((a) => a.lines)
        slides[id] = { group: firstTextItem?.lines?.[0]?.text?.[0]?.value?.split(" ")?.slice(0, 4)?.join(" ")?.trim() || "", color: null, settings: {}, notes: "", items }
        layouts.push({ id })
    })

    let layoutID = uid()
    // this can be set to private - to only add to project and not in drawer, because it's mostly not used again
    let show: Show = new ShowObj(false, "scripture", layoutID, new Date().getTime(), get(scriptureSettings).template || false)
    // add scripture category
    if (!get(categories).scripture) {
        categories.update((a) => {
            a.scripture = { name: "category.scripture", icon: "scripture", default: true }
            return a
        })
    }

    let bibleShowName = `${bibles[0].book} ${bibles[0].chapter},${joinRange(drag.data[0]?.sorted || [])}`
    show.name = checkName(bibleShowName)
    if (show.name !== bibleShowName) show.name = checkName(`${bibleShowName} - ${getShortBibleName(bibles[0].version)}`)
    show.slides = slides
    show.layouts = { [layoutID]: { name: bibles[0].version || "", notes: "", slides: layouts } }

    let versions = bibles.map((a) => a.version).join(" + ")
    show.reference = {
        type: "scripture",
        data: { collection: get(drawerTabsData).scripture?.activeSubTab || bibles[0].id || "", version: versions, api: bibles[0].api, book: bibles[0].bookId ?? bibles[0].book, chapter: bibles[0].chapter, verses: bibles[0].activeVerses },
    }

    history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } })
}
