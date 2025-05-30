/* eslint no-shadow: 0 */

import { get } from "svelte/store"
import { uid } from "uid"
import type { History } from "../../../types/History"
import type { DropData, Selected } from "../../../types/Main"
import type { Item, Show, Slide, SlideAction } from "../../../types/Show"
import { ShowObj } from "../../classes/Show"
import { createCategory } from "../../converters/importHelpers"
import { changeLayout, changeSlideGroups } from "../../show/slides"
import {
    activeDrawerTab,
    activePage,
    activePopup,
    activeProject,
    activeShow,
    alertMessage,
    audioFolders,
    audioPlaylists,
    audioStreams,
    drawerTabsData,
    media,
    mediaFolders,
    overlays,
    projects,
    scriptureSettings,
    shows,
    showsCache,
    templates,
    timers
} from "../../stores"
import { newToast } from "../../utils/common"
import { audioExtensions, imageExtensions, mediaExtensions, presentationExtensions, videoExtensions } from "../../values/extensions"
import { actionData } from "../actions/actionData"
import { getActionTriggerId } from "../actions/actions"
import { getShortBibleName, getSlides, joinRange } from "../drawer/bible/scripture"
import { addItem, DEFAULT_ITEM_STYLE } from "../edit/scripts/itemHelpers"
import { clone, removeDuplicates } from "./array"
import { history, historyAwait } from "./history"
import { getExtension, getFileName, getMediaStyle, getMediaType, removeExtension } from "./media"
import { addToPos, getIndexes, mover } from "./mover"
import { checkName, getLayoutRef } from "./show"
import { getVariableNameId } from "./showActions"
import { _show } from "./shows"

function getId(drag: Selected): string {
    const id = ""
    if (drag.id === "slide" || drag.id === "group") return "slide"
    const extension: string = getExtension(drag.data[0].name)
    if (drag.id === "files" && getMediaType(extension) === "audio") return "audio"
    if (drag.id === "show" && drag.data[0].type === "audio") return "audio"
    if ((drag.id === "show" && ["media", "image", "video"].includes(drag.data[0].type)) || drag.id === "media" || drag.id === "files" || drag.id === "camera" || drag.id === "screen" || drag.id === "ndi") return "media"
    // if (drag.id === "audio") return "audio"
    // if (drag.id === "global_group") return "global_group"
    return drag.id || id
}

type Data = { drag: Selected; drop: DropData }
type Keys = { shiftKey: boolean }

export const dropActions = {
    slides: ({ drag, drop }: Data, history: History, keys?: Keys) => dropActions.slide({ drag, drop }, history, keys),
    slide: ({ drag, drop }: Data, history: History, keys?: Keys) => {
        const customId: string = drag.showId || drag.data[0]?.showId
        const showId = customId || get(activeShow)?.id || ""
        if (!showId || get(shows)[showId]?.locked) return

        history.location = { page: get(activePage), show: customId ? { id: customId } : get(activeShow) || undefined, layout: get(showsCache)[showId]?.settings?.activeLayout }

        const id: string = getId(drag)
        if (slideDrop[id]) {
            history = slideDrop[id]({ drag, drop }, history, keys)
            return history
        }

        console.error("Missing slide drop action:", drag.id)
        return history
    },
    projects: ({ drag, drop }: Data, h: History) => {
        if (drag.id !== "folder" && drag.id !== "project") return
        if (drop.data.type && drop.data.type !== "folder") return

        h.location!.page = "show"

        const parents = drop.data.path?.split("/") || [""]
        const ids: string[] = []
        drag.data.forEach(checkData)

        function checkData(data: any) {
            if (data.type === drop.data.type) {
                // itself
                if (data.id === drop.data.id) return
                // child of itself
                if (parents[0] && data.path !== drop.data.path && parents.includes(data.id)) return
            }

            ids.push(data.id)
            h.oldData = { id: data.id }

            if (data.type === "folder") {
                h.id = "UPDATE"
                h.location!.id = "project_folder_key"
                return
            }

            h.id = "UPDATE"
            h.location!.id = "project_key"
        }

        h.newData = { key: "parent", data: drop.data.id || "/" }

        // move multiple
        ids.forEach((id) => {
            h.oldData = { id }
            history(h)
        })
    },
    project: ({ drag, drop }: Data, history: History) => {
        history.id = "UPDATE"
        history.location = { page: "show", id: "project_ref" }
        history.oldData = { id: get(activeProject) }

        const projectShows = get(projects)[history.oldData.id]?.shows || []

        if (drag.id === "action") {
            let index = drop.index
            if (index === undefined) index = projectShows.length
            if (drop.trigger?.includes("end")) index--
            if (projectShows[index]?.type !== "section") return

            const actionId: string = drag.data?.[0]?.id || ""
            projectShows[index].data = { settings: { triggerAction: actionId } }
            history.newData = { key: "shows", data: projectShows }
            return history
        }

        if (drop.index === undefined) drop.index = projectShows.length
        if (drag.id === "files" && drop.trigger?.includes("end")) drop.index++

        let data = drag.data
        if (drag.id === "media" || drag.id === "files") {
            data = data
                .map((a) => {
                    const path = a.path || window.api.showFilePath(a)
                    const extension: string = getExtension(path || a.name)
                    if (drag.id === "files" && !files[drop.id].includes(extension)) return null

                    const type: string = getMediaType(extension)

                    const name: string = a.name || getFileName(path)
                    return { name: removeExtension(name), id: path, type }
                })
                .filter((a) => a)
        } else if (drag.id === "audio") {
            data = data.map((a) => ({ id: a.path, name: removeExtension(a.name), type: "audio" }))
        } else if (drag.id === "overlay") {
            data = data.map((a) => ({ id: a, type: "overlay" }))
        } else if (drag.id === "player") {
            data = data.map((a) => ({ id: a, type: "player" }))
        } else if (drag.id === "camera") {
            data = data.map((a) => ({ id: a.id, name: a.name, type: "camera", data: { groupId: a.cameraGroup } }))
        } else if (drag.id === "scripture") {
            return createScriptureShow(drag, drop)
        }

        history.newData = { key: "shows", data: [] }
        if (drag.id === "show") history.newData.data = mover(projectShows, getIndexes(data), drop.index)
        else history.newData.data = addToPos(projectShows, data, drop.index)

        return history
    },
    all_slides: ({ drag, drop }: Data, h: History) => {
        h.location = { page: "show" }
        const templateId = drag.data[0]

        if (drag.id === "template") {
            h.id = "TEMPLATE"

            const indexes: number[] = []
            // dropping on the center of a slide will add the template to just that slide
            if (drop.center) {
                if (_show().get()?.locked) {
                    alertMessage.set("show.locked_info")
                    activePopup.set("alert")
                    return
                }

                const showTemplateId: string = _show().get("settings.template") || ""
                if (showTemplateId === templateId) {
                    newToast("$toast.template_applied_globally")
                    return
                }

                // indexes.push(drop.index)
                // history({ id: "UPDATE", newData: { data: templateId, key: "settings", keys: ["template"] }, oldData: { id: get(activeShow)?.id }, location: { page: "show", id: "show_key" } })
                // history({ id: "SLIDES", newData: { index: drop.index, replace: { settings: isParent } } })

                const ref = getLayoutRef()
                const slideId = ref[drop.index!].id
                const slideSettings = _show().slides([slideId]).get("settings")
                const oldData = { style: clone(slideSettings) }
                const newData = { style: { ...clone(slideSettings), template: templateId } }

                history({
                    id: "slideStyle",
                    oldData,
                    newData,
                    location: { page: "edit", show: get(activeShow)!, slide: slideId }
                })

                // update
                history({ id: "TEMPLATE", save: false, newData: { id: showTemplateId }, location: { page: "show" } })
                return
            }

            // create slide from template if dropping on a slide
            if (drop.trigger) {
                if (_show().get()?.locked) {
                    alertMessage.set("show.locked_info")
                    activePopup.set("alert")
                    return
                }

                const showId = drag.showId || drag.data[0]?.showId || get(activeShow)?.id || ""
                const slides: { [key: string]: Slide } = _show(showId).get().slides
                let layout = _show(showId).layouts("active").get()[0].slides
                const oldData = clone({ slides, layout })
                const ref = getLayoutRef(showId)

                let dropIndex = ref[drop.index ?? -1]?.parent?.index ?? ref[drop.index ?? -1]?.index ?? -2
                if (drop.trigger?.includes("end")) dropIndex++
                if (dropIndex < 0) dropIndex = layout.length

                // const slides: Slide[] = []
                drag.data.forEach((id) => {
                    const template = clone(get(templates)[id])
                    const slideId = uid()
                    const slide = { group: template.name, color: template.color, items: template.items, settings: { template: id }, notes: "" }

                    // slides.push(slide)
                    slides[slideId] = slide
                    layout = addToPos(layout, [{ id: slideId }], dropIndex)
                })

                history({
                    id: "slide",
                    newData: { slides, layout },
                    oldData,
                    location: { page: "show", show: get(activeShow)!, layout: _show(showId).get("settings.activeLayout") }
                })
                // history({ id: "SLIDES", newData: { data: slides }, location: { page: "show", show: get(activeShow)! } })
                return
            }

            h.newData = { id: templateId, data: { createItems: true }, indexes }
        }

        return h
    },
    navigation: ({ drag, drop }: Data, h: History) => {
        if (drag.id === "files") {
            dropFileInDrawerNavigation(drag)
            return
        }

        if (drop.data !== "all" && get(activeDrawerTab) && (drag.id === "show" || drag.id === "show_drawer")) {
            h.id = "SHOWS"
            const data = drop.data === "unlabeled" ? null : drop.data
            const allShowIds: string[] = drag.data.map(({ id }) => id).filter((id) => get(shows)[id])
            const showsList = allShowIds.map((id) => ({ show: { category: data }, id }))
            h.newData = { replace: true, data: showsList }
            h.location = { page: "drawer" }
            historyAwait(allShowIds, h)
            return
        }

        // outdated:
        if (drop.data === "favourites" && drag.id === "media") {
            drag.data.forEach((card) => {
                const path: string = card.path || card.id
                media.update((a) => {
                    if (!a[path]) a[path] = { filter: "" }
                    a[path].favourite = true
                    return a
                })
            })

            // return history
        }

        // audio playlist
        if (get(audioPlaylists)[drop.data] && drag.id === "audio") {
            h.id = "UPDATE"
            h.location = { page: "drawer", id: "audio_playlist_key" }

            const playlistId = drop.data
            h.oldData = { id: playlistId }

            const songs = clone(get(audioPlaylists)[playlistId]?.songs || [])
            const newSongs = drag.data.map((a) => a.path)
            songs.push(...newSongs)
            h.newData = { key: "songs", data: songs }

            return h
        }

        if (drop.data !== "all" && (drag.id === "overlay" || drag.id === "template")) {
            drag.data.forEach((id) => {
                history({
                    id: "UPDATE",
                    oldData: { id },
                    newData: { key: "category", data: drop.data === "unlabeled" ? null : drop.data },
                    location: { page: "drawer", id: drag.id + "_category" }
                })
            })

            // return history
        }

        return
    },
    templates: ({ drag, drop }: Data) => {
        if (drag.id === "files") {
            const mediaPath: string = window.api.showFilePath(drag.data?.[0])
            const templateId: string = drop.data
            if (!mediaPath || !templateId) return

            if (!files[drop.id].includes(getExtension(mediaPath))) return

            const templateSettings = get(templates)[templateId]?.settings || {}
            const newData = { key: "settings", data: { ...templateSettings, backgroundPath: mediaPath } }

            history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "edit", id: "template_settings", override: templateId } })

            return
        }

        if (drag.id !== "slide") return

        drag.data.forEach(({ index }) => {
            const ref = getLayoutRef()[index]
            const slides: Slide[] = _show().get().slides
            const slide = ref.type === "child" ? slides[ref.parent!.id] : slides[ref.id]
            const activeTab: string | null = get(drawerTabsData)[get(activeDrawerTab)]?.activeSubTab

            const data = {
                name: slide.group || "",
                color: slide.color || "",
                category: activeTab === "all" || activeTab === "unlabeled" ? null : activeTab,
                items: slides[ref.id].items
            }
            history({ id: "UPDATE", newData: { data }, location: { page: "drawer", id: drop.id.slice(0, -1) } })
        })
    },
    overlays: ({ drag, drop }: Data) => dropActions.templates({ drag, drop }),
    edit: ({ drag }: Data) => {
        if (drag.id === "media" || drag.id === "files") {
            drag.data.forEach((file) => addItem("media", null, { src: file.path || window.api.showFilePath(file) }))
        } else if (drag.id === "global_timer") {
            drag.data.forEach((a) => addItem("timer", null, { timer: { id: a.id } }))
        } else if (drag.id === "variable") {
            drag.data.forEach((a) => {
                const name = getVariableNameId(a.name || "")
                if (!name) return
                addItem("text", null, {}, `{variable_${name}}`)
            })
        }
    },
    audio_playlist: ({ drag, drop }: Data, h: History) => {
        h.id = "UPDATE"
        h.location = { page: "drawer", id: "audio_playlist_key" }

        const playlistId = get(drawerTabsData).audio?.activeSubTab
        if (!playlistId) return

        h.oldData = { id: playlistId }

        let songs = clone(get(audioPlaylists)[playlistId]?.songs || [])
        let dropIndex = drop.index
        if (dropIndex === undefined) dropIndex = songs.length

        if (drag.id === "files") {
            const audioFiles = drag.data.map((a) => window.api.showFilePath(a))
            songs = addToPos(songs, audioFiles, dropIndex)
        } else {
            songs = mover(songs, getIndexes(drag.data), dropIndex)
        }

        h.newData = { key: "songs", data: songs }
        return h
    }
}

function dropFileInDrawerNavigation(drag) {
    const drawerTab = get(activeDrawerTab)

    // drop folders
    if (drawerTab === "media" || drawerTab === "audio") {
        drag.data.forEach((file) => {
            if (file.type) return
            addDrawerFolder(file, drawerTab)
        })
    }

    // WIP drop .show/.json into show categories???
    // WIP drop .template
    // WIP drop bibles??
}

export function addDrawerFolder(file: any, type: "media" | "audio") {
    // check if folder already exists
    const path: string = file.path || window.api.showFilePath(file)
    const exists = Object.values(type === "media" ? get(mediaFolders) : get(audioFolders)).find((a) => a.path === path)
    if (exists) {
        newToast("$error.folder_exists")
        return
    }

    history({
        id: "UPDATE",
        newData: { data: { name: getFileName(path), icon: "folder", path } },
        location: { page: "drawer", id: "category_" + type }
    })
}

// "show", "project"
const projectExtra = ["pdf", ...presentationExtensions]
const fileDropExtensions = [...imageExtensions, ...videoExtensions, ...audioExtensions]

const files = {
    project: [...fileDropExtensions, ...projectExtra],
    slides: fileDropExtensions,
    slide: fileDropExtensions,
    templates: mediaExtensions
}

const slideDrop = {
    media: ({ drag, drop }: Data, history: History) => {
        let data = drag.data
        // TODO: move multiple add to possible slides

        // check files
        if (drag.id === "files") {
            data = []
            drag.data.forEach((a) => {
                const extension: string = getExtension(a.name)
                if (files[drop.id].includes(extension)) {
                    data.push({
                        path: window.api.showFilePath(a),
                        name: removeExtension(a.name),
                        type: getMediaType(extension)
                    })
                }
            })
        } else if (drag.id === "camera") data[0].type = "camera"
        else if (drag.id === "screen") data[0].type = "screen"
        else if (drag.id === "ndi") data[0].type = "ndi"
        else if (!data[0].name) data[0].name = data[0].path

        let center = drop.center
        if (drag.id === "files" && drop.index !== undefined) center = true

        // get background type
        let backgroundTypeData: any = {}
        // videos are probably not meant to be background if they are added in bulk
        if (data.length > 1 && !center) backgroundTypeData = { muted: false, loop: false }

        data = data.map((a) => {
            const path = a.path || a.id

            // project item
            a.path = path
            delete a.id

            let backgroundData = backgroundTypeData
            const mediaStyle = getMediaStyle(get(media)[path], undefined)
            if (mediaStyle.videoType === "background") backgroundData = { muted: true, loop: true }
            else if (mediaStyle.videoType === "foreground") backgroundData = { muted: false, loop: false }

            return { ...a, path, ...(a.type === "video" ? backgroundData : {}) }
        })

        if (center) {
            if (!data[0]) return
            history.id = "showMedia"

            if (drop.trigger?.includes("end")) drop.index!--
            history.location!.layoutSlide = drop.index
            const newData = data[0]
            delete newData.index
            delete newData.id
            history.newData = newData

            return history
        }

        history.id = "SLIDES"
        const slides = drag.data.map((a) => ({ id: a.id || uid(), group: removeExtension(a.name || ""), color: null, settings: {}, notes: "", items: [] }))

        history.newData = { index: drop.index, data: slides, layout: { backgrounds: data } }

        return history
    },
    audio: ({ drag, drop }: Data, h: History) => {
        h.id = "showAudio"

        let data = drag.data

        if (drag.id === "files") {
            data = []
            drag.data.forEach((a) => {
                const extension: string = getExtension(a.name)
                if (files[drop.id].includes(extension)) {
                    data.push({
                        path: window.api.showFilePath(a),
                        name: removeExtension(a.name),
                        type: getMediaType(extension)
                    })
                }
            })
        }

        if (drop.trigger?.includes("end")) drop.index!--
        h.location!.layoutSlide = drop.index

        data.forEach((audio) => {
            // TODO: drop both audio & video files...
            h.newData = { name: audio.name || audio.path || audio.id, path: audio.path || audio.id, type: "audio" }
            history(h)
        })
    },
    microphone: ({ drag, drop }: Data, h: History) => {
        if (drop.index === undefined) return
        h.id = "SHOW_LAYOUT"

        if (drop.trigger?.includes("end")) drop.index--
        const layoutSlide = drop.index

        const oldMics = getLayoutRef()[layoutSlide]?.data?.mics || []
        const mics = drag.data
        // remove duplicates
        oldMics.forEach((oldMic) => {
            if (!mics.find((a) => a.id === oldMic.id)) mics.push(oldMic)
        })

        h.newData = { key: "mics", data: mics, dataIsArray: true, indexes: [layoutSlide] }
        history(h)
    },
    slide: ({ drag, drop }: Data, history: History) => {
        const showId = drag.showId || drag.data[0]?.showId || get(activeShow)?.id || ""
        history.id = "slide"
        let ref = getLayoutRef(showId)

        const slides: { [key: string]: Slide } = _show(showId).get().slides
        const oldLayout = _show(showId).layouts("active").get()[0].slides
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
                const children: string[] = ref[index].children || []
                if (!children) return

                const parentMovedToOwnChildren = newIndex > index && newIndex - 1 <= index + children.length

                // select children
                if (parentMovedToOwnChildren) return

                children.map((_id, childIndex) => selected.push(index + childIndex + 1))
                selected = removeDuplicates(selected)
            }

            sortedLayout = mover(ref, selected, drop.index)

            ref = ref.filter((a, i) => {
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

            moved = drag.data.map(({ index, id }) => ref[index] || { type: "parent", id })
            sortedLayout = addToPos(ref, moved, newIndex)
        }

        // sort layout ref
        const newLayoutRef = addToPos(ref, moved, newIndex)

        // TODO: dragging a current group on child will not remove old children
        // TODO: dragging a parent slide over its own childs will not change children

        // check if first slide child
        if (newLayoutRef[0]?.type === "child") newLayoutRef[0].newType = "parent"

        history.newData = changeLayout(sortedLayout, slides, clone(newLayoutRef), moved, newIndex)
        return history
    },
    global_group: ({ drag, drop }: Data, history: History) => {
        const ref = getLayoutRef()
        if (!drag.data[0].slide) return

        if (drop.center) {
            if (drop.trigger?.includes("end")) drop.index!--
            changeSlideGroups({ sel: { data: [{ index: drop.index! }] }, menu: { id: drag.data[0].slide.globalGroup } })
            return
        }

        history.id = "slide"

        const layoutId: string = _show().get("settings.activeLayout")

        const slides: { [key: string]: Slide } = clone(get(showsCache)[get(activeShow)!.id].slides)
        const mediaData: any = clone(get(showsCache)[get(activeShow)!.id].media || {})
        let layout: any[] = _show().layouts([layoutId]).slides().get()[0]

        if (drop.index === undefined) drop.index = layout.length
        const newIndex: number = drop.index

        let newMedia: any = mediaData
        drag.data.forEach(({ slide, layoutData, media }) => {
            const id = uid()
            delete slide.id
            slides[id] = clone(slide)

            let parent: any = ref[newIndex - 1] || { index: -1 }
            if (parent.type === "child") parent = parent.parent

            // add layout data (if dragging a slide to another show)
            let newLayout = { id }
            if (layoutData) newLayout = { ...layoutData, id }
            if (media) newMedia = { ...newMedia, ...media }

            layout = addToPos(layout, [newLayout], parent.index + 1)
        })

        history.newData = { slides, layout, media: newMedia }
        history.location!.layout = layoutId
        return history
    },
    overlay: ({ drag, drop }: Data, history: History) => {
        history.id = "SHOW_LAYOUT"

        const ref = getLayoutRef()[drop.index!]
        if (!ref) {
            // create slide from overlay if dropping not on a slide
            const slides: Slide[] = []
            drag.data.forEach((id) => {
                const overlay = clone(get(overlays)[id])
                slides.push({ group: overlay.name, color: overlay.color, items: overlay.items, settings: {}, notes: "" })
            })

            history.id = "SLIDES"
            history.newData = { data: slides }
            return history
        }

        const data: any[] = removeDuplicates([...(ref.data?.overlays || []), ...drag.data])

        history.newData = { key: "overlays", data, dataIsArray: true, indexes: [drop.index] }
        return history
    },
    scripture: ({ drag, drop }: Data, history: History) => {
        const bibles = drag.data[0]?.bibles
        if (!bibles?.[0]) return

        let newSlides: any[] = getSlides(drag.data[0])
        const slideTemplate: string = get(scriptureSettings).verseNumbers ? "" : get(scriptureSettings).template || ""
        newSlides = newSlides.map((items) => {
            const referenceText = getReferenceText(bibles, drag.data[0]?.sorted, items)
            return { group: referenceText, color: null, settings: { template: slideTemplate }, notes: "", items }
        })

        // set to correct order
        newSlides = newSlides.reverse()

        // WIP duplicate of global_group
        const ref = getLayoutRef()

        history.id = "slide"

        const layoutId: string = _show().get("settings.activeLayout")

        const slides: { [key: string]: Slide } = clone(get(showsCache)[get(activeShow)!.id].slides)
        let layout: any[] = _show().layouts([layoutId]).slides().get()[0]

        if (drop.index === undefined) drop.index = layout.length
        let newIndex: number = drop.index
        if (drop.trigger?.includes("end")) newIndex++

        newSlides.forEach((slide) => {
            const id = uid()
            delete slide.id
            slides[id] = slide

            let parent: any = ref[newIndex - 1] || { index: -1 }
            if (parent.type === "child") parent = parent.parent

            layout = addToPos(layout, [{ id }], parent.index + 1)
        })

        history.newData = { slides, layout }
        history.location!.layout = layoutId
        return history
    },
    trigger: ({ drag, drop }: Data, history: History) => {
        if (drop.index === undefined) return
        history.id = "SHOW_LAYOUT"

        const data = drag.data[0]
        const actions = createSlideAction("start_trigger", drop.index, data)
        if (!actions) return

        history.newData = { key: "actions", data: actions, indexes: [drop.index] }
        return history
    },
    audio_stream: ({ drag, drop }: Data, history: History) => {
        if (drop.index === undefined) return
        history.id = "SHOW_LAYOUT"

        const streamId = drag.data[0].id
        const stream = get(audioStreams)[streamId]
        if (!stream) return

        const data = { id: streamId, ...stream }
        const actions = createSlideAction("start_audio_stream", drop.index, data)
        if (!actions) return

        history.newData = { key: "actions", data: actions, indexes: [drop.index] }
        return history
    },
    metronome: ({ drag, drop }: Data, history: History) => {
        if (drop.index === undefined) return
        history.id = "SHOW_LAYOUT"

        const data = drag.data[0]
        const actions = createSlideAction("start_metronome", drop.index, data, true)
        if (!actions) return

        history.newData = { key: "actions", data: actions, indexes: [drop.index] }
        return history
    },
    global_timer: ({ drag, drop }: Data, history: History) => {
        // let data = drag.data
        // let center = drop.center

        // center drop to add to existing slide?

        history.id = "SLIDES"
        const slides = drag.data.map((a) => ({ id: uid(), group: a.name || "", color: null, settings: {}, notes: "", items: getTimerItem(a) }))
        function getTimerItem(timer): Item[] {
            return [{ type: "timer", style: DEFAULT_ITEM_STYLE, timerId: timer.id }]
        }

        // start timer layout
        const layout = { actions: { slideActions: [{ triggers: ["start_slide_timers"] }] } }
        const layouts = slides.map(({ id }, i) => {
            if (get(timers)[drag.data[i]?.id]?.type === "counter") return { id, ...layout }
            return { id }
        })

        let index = drop.index
        if (index !== undefined && drop.trigger?.includes("end")) index++

        history.newData = { index, data: slides, layouts }

        return history
    },
    variable: ({ drag, drop }: Data, history: History) => {
        history.id = "SLIDES"

        const variables = drag.data.filter((a) => a?.name)
        if (!variables.length) return

        const slides = variables.map((a) => ({ id: uid(), group: a.name || "", color: null, settings: {}, notes: "", items: getItem(a) }))
        function getItem(a): Item[] {
            const variableId = `{variable_${getVariableNameId(a.name || "")}}`
            const lines = [{ align: "", text: [{ value: variableId, style: "font-size: 150px;" }] }]
            return [{ type: "text", style: DEFAULT_ITEM_STYLE, lines }]
        }

        const layouts = slides.map(({ id }) => ({ id }))

        let index = drop.index
        if (index !== undefined && drop.trigger?.includes("end")) index++

        history.newData = { index, data: slides, layouts }

        return history
    },
    midi: ({ drag, drop }: Data, history: History) => {
        // WIP not in use:
        history.id = "SHOW_LAYOUT"

        const ref = getLayoutRef()[drop.index!]
        const data: any = ref?.data?.actions || {}
        const key = drag.data[0].type === "in" ? "receiveMidi" : "sendMidi"
        data[key] = drag.data[0].id

        history.newData = { key: "actions", data, indexes: [drop.index] }
        return history
    },
    action: ({ drag, drop }: Data, history: History, keys?: Keys) => {
        history.id = "SHOW_LAYOUT"

        const ref = getLayoutRef()[drop.index!]
        const actionsData: any = ref?.data?.actions || {}

        const slideActions = actionsData.slideActions || []
        const newActions: SlideAction[] = []

        drag.data.forEach((action) => {
            if (!action?.triggers) return

            if (action.triggers.length > 1) {
                const existingRunActionIndex = slideActions.findIndex((a) => a.actionValues?.run_action?.id === action.id)
                if (existingRunActionIndex > -1) return

                const id = uid()
                const newAction: SlideAction = { id, triggers: ["run_action"], name: action.name || "", actionValues: { run_action: { id: action.id } } }
                if (keys?.shiftKey) newAction.customData = { run_action: { overrideCategoryAction: true } }
                newActions.push(newAction)
                return
            }

            const triggerId = getActionTriggerId(action.triggers[0])
            const data = actionData[triggerId]
            if (!data) return

            // replace if existing & and only one or value is the same
            const existingIndex = slideActions.findIndex((a) => getActionTriggerId(a.triggers[0]) === triggerId && (!data.canAddMultiple || JSON.stringify(a.actionValues) === JSON.stringify(action.actionValues)))
            if (existingIndex > -1) {
                slideActions[existingIndex] = { ...action, id: slideActions[existingIndex].id }
                return
            }

            newActions.push({ id: uid(), ...action })
        })

        actionsData.slideActions = [...slideActions, ...newActions]
        history.newData = { key: "actions", data: actionsData, indexes: [drop.index] }
        return history
    }
}

// HELPERS

function createSlideAction(triggerId: string, slideIndex: number, data: any, removeExisting = false) {
    const ref = getLayoutRef()[slideIndex]
    if (!ref) return
    const actions: any = ref.data?.actions || {}
    const slideActions: any[] = actions.slideActions || []

    if (removeExisting) {
        const existingIndex = slideActions.findIndex((a) => a.triggers?.[0] === triggerId)
        if (existingIndex > -1) slideActions.splice(existingIndex, 1)
    }

    const actionValues = { [triggerId]: data }
    slideActions.push({ id: uid(), triggers: [triggerId], actionValues })

    actions.slideActions = slideActions
    return actions
}

// WIP duplicate of ScriptureInfo.svelte createSlides()
function createScriptureShow(drag, drop) {
    const bibles = drag.data[0]?.bibles
    if (!bibles?.[0]) return

    const slides: any = {}
    const layouts: any[] = []

    const newSlides = getSlides(drag.data[0])
    newSlides.forEach((items) => {
        const id = uid()
        const referenceText = getReferenceText(bibles, drag.data[0]?.sorted, items)

        slides[id] = { group: referenceText, color: null, settings: {}, notes: "", items }
        layouts.push({ id })
    })

    // add scripture category
    const categoryId = createCategory("scripture", "scripture", { isDefault: true, isArchive: true })

    const layoutID = uid()
    // only set template if not combined (because it might be a custom reference style on first line)
    const template = get(scriptureSettings).combineWithText ? false : get(scriptureSettings).template || false
    // this can be set to private - to only add to project and not in drawer, because it's mostly not used again
    const show: Show = new ShowObj(false, categoryId, layoutID, new Date().getTime(), template)

    const bibleShowName = `${bibles[0].book} ${bibles[0].chapter},${joinRange(drag.data[0]?.sorted || [])}`
    show.name = checkName(bibleShowName)
    if (show.name !== bibleShowName) show.name = checkName(`${bibleShowName} - ${getShortBibleName(bibles[0].version)}`)
    show.slides = slides
    show.layouts = { [layoutID]: { name: bibles[0].version || "", notes: "", slides: layouts } }

    const versions = bibles.map((a) => a.version).join(" + ")
    show.reference = {
        type: "scripture",
        data: { collection: get(drawerTabsData).scripture?.activeSubTab || bibles[0].id || "", version: versions, api: bibles[0].api, book: bibles[0].bookId ?? bibles[0].book, chapter: bibles[0].chapter, verses: bibles[0].activeVerses }
    }

    let index = drop.index
    if (drop.trigger?.includes("end")) index++

    history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject), index } }, location: { page: "show", id: "show" } })
}

function getReferenceText(bibles, range: string[], items: Item[]) {
    const referenceTextItem = items.find((a) => a.lines?.find((a) => a.text?.find((a) => a.value.includes(":") && a.value.length < 25)))
    if (referenceTextItem) return referenceTextItem.lines?.[0]?.text?.[0]?.value

    const referenceDivider = get(scriptureSettings).referenceDivider || ":"
    const reference = bibles[0].book + " " + bibles[0].chapter + referenceDivider + joinRange(range)
    if (reference) return reference

    // this is probably never called
    const firstTextItem = items.find((a) => a.lines)
    return firstTextItem?.lines?.[0]?.text?.[0]?.value?.split(" ")?.slice(0, 4)?.join(" ")?.trim() || ""
}
