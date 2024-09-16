import { get } from "svelte/store"
import { uid } from "uid"
import { EXPORT, MAIN, OUTPUT } from "../../../types/Channels"
import type { MediaStyle } from "../../../types/Main"
import type { Slide } from "../../../types/Show"
import { changeSlideGroups, mergeSlides, mergeTextboxes, splitItemInTwo } from "../../show/slides"
import {
    $,
    activeDrawerTab,
    activeEdit,
    activeFocus,
    activePage,
    activePopup,
    activeRecording,
    activeRename,
    activeShow,
    activeTagFilter,
    audioFolders,
    currentOutputSettings,
    currentWindow,
    dataPath,
    dictionary,
    drawerTabsData,
    eventEdit,
    events,
    focusMode,
    forceClock,
    media,
    mediaFolders,
    outLocked,
    outputs,
    overlays,
    popupData,
    previousShow,
    projects,
    projectView,
    refreshEditSlide,
    scriptures,
    selected,
    settingsTab,
    shows,
    showsCache,
    slidesOptions,
    sorted,
    stageShows,
    styles,
    templates,
    themes,
    toggleOutputEnabled,
} from "../../stores"
import { hideDisplay, newToast, triggerFunction } from "../../utils/common"
import { send } from "../../utils/request"
import { initializeClosing, save } from "../../utils/save"
import { updateThemeValues } from "../../utils/updateSettings"
import { moveStageConnection } from "../actions/apiHelper"
import { getShortBibleName } from "../drawer/bible/scripture"
import { stopMediaRecorder } from "../drawer/live/recorder"
import { playPauseGlobal } from "../drawer/timers/timers"
import { addChords } from "../edit/scripts/chords"
import { rearrangeItems } from "../edit/scripts/itemHelpers"
import { getSelectionRange } from "../edit/scripts/textStyle"
import { exportProject } from "../export/project"
import { clone, removeDuplicates } from "../helpers/array"
import { copy, cut, deleteAction, duplicate, paste, selectAll } from "../helpers/clipboard"
import { GetLayoutRef } from "../helpers/get"
import { history, HistoryPages, redo, undo } from "../helpers/history"
import { getExtension, getFileName, getMediaStyle, getMediaType, removeExtension } from "../helpers/media"
import { defaultOutput, getActiveOutputs, setOutput } from "../helpers/output"
import { select } from "../helpers/select"
import { updateShowsList } from "../helpers/show"
import { dynamicValueText, sendMidi } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import { defaultThemes } from "../settings/tabs/defaultThemes"
import { activeProject } from "./../../stores"

export function menuClick(id: string, enabled: boolean = true, menu: any = null, contextElem: any = null, actionItem: any = null, sel: any = {}) {
    if (!actions[id]) return console.log("MISSING CONTEXT: ", id)

    if (sel.id) sel.id = sel.id.split("___")[0] // different selection ID, same action (currently used to seperate scripture navigation buttons)

    let obj = { sel, actionItem, enabled, contextElem, menu }
    console.log("MENU CLICK: " + id, obj)

    actions[id](obj)
}

const actions: any = {
    // file
    save: () => save(),
    import: () => activePopup.set("import"),
    export_more: () => activePopup.set("export"),
    settings: () => {
        if (get(activePage) === "stage") settingsTab.set("connection")
        else if (get(activePage) === "settings") settingsTab.set("general")
        activePage.set("settings")
    },
    quit: () => initializeClosing(),
    // view
    focus_mode: () => {
        let project = get(projects)[get(activeProject) || ""]
        if (!project?.shows?.length) return

        previousShow.set(null)
        activeShow.set(null)

        let firstItem = project.shows[0].id
        activeFocus.set({ id: firstItem, index: 0 })

        activePage.set("show")
        focusMode.set(!get(focusMode))
    },
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
        let id = obj.sel.id
        if (!id) return
        let data = obj.sel.data[0]

        const renameById = ["show_drawer", "project", "folder", "stage", "theme", "style", "output", "tag"]
        const renameByIdDirect = ["overlay", "template", "player", "layout"]

        if (renameById.includes(id)) activeRename.set(id + "_" + data.id)
        else if (renameByIdDirect.includes(id)) activeRename.set(id + "_" + data)
        else if (id === "slide" || id === "group") activePopup.set("rename")
        else if (id === "show") activeRename.set("show_" + data.id + "#" + data.index)
        else if (obj.contextElem?.classList?.contains("#video_marker")) activeRename.set("marker_" + obj.contextElem.id)
        else if (id?.includes("category")) activeRename.set("category_" + get(activeDrawerTab) + "_" + data)
        else console.log("Missing rename", obj)
    },
    sort_shows: (obj: any) => sort(obj, "shows"),
    sort_projects: (obj: any) => sort(obj, "projects"),
    remove: (obj: any) => {
        if (deleteAction(obj.sel)) return

        console.error("COULD NOT REMOVE", obj)
    },
    recolor: () => {
        // "slide" || "group" || "overlay" || "template" || "output"
        activePopup.set("color")
    },
    remove_group: (obj: any) => removeGroup(obj.sel.data),
    remove_slide: (obj: any) => {
        removeSlide(obj.sel.data, "remove")
        if (get(activePage) === "edit") refreshEditSlide.set(true)
    },
    delete_slide: (obj: any) => actions.delete(obj),
    delete_group: (obj: any) => actions.delete(obj),
    delete: (obj: any) => {
        // delete shows from project
        if (obj.sel.id === "show") {
            // wait to delete until after they are removed from project
            setTimeout(() => {
                let sel = { ...obj.sel, id: "show_drawer" }
                selected.set(sel)
                actions.delete({ ...obj, sel })
            })
        }

        if (deleteAction(obj.sel)) return

        if (obj.contextElem?.classList.value.includes("#video_marker")) {
            deleteAction({ id: "video_marker", data: { index: obj.contextElem.id } })
            return
        }
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

            history({ id: "UPDATE", newData: { id: "keys" }, oldData: { keys: eventIds }, location: { page: "drawer", id: "event" } })
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
            if (!a[obj.menu.id!]) a[obj.menu.id] = { enabled: false, activeSubTab: null }
            a[obj.menu.id!].enabled = !obj.enabled
            return a
        })
        return m
    },
    tags: (obj: any) => {
        let tagId = obj.menu.id

        let activeTags = get(activeTagFilter)
        let currentIndex = activeTags.indexOf(tagId)
        if (currentIndex < 0) activeTags.push(tagId)
        else activeTags.splice(currentIndex, 1)

        activeTagFilter.set(activeTags)
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
            if (!a[get(activeProject)!]) return a

            a[get(activeProject)!].shows.push(...obj.sel.data)
            return a
        })
    },
    addToShow: (obj: any) => {
        let data: any[] = obj.sel.data

        let slides: any[] = data.map((a: any) => ({ id: a.id || uid(), group: removeExtension(a.name || a.path || ""), color: null, settings: {}, notes: "", items: [] }))

        let videoData: any = {}
        // videos are probably not meant to be background if they are added in bulk
        if (data.length > 1) videoData = { muted: false, loop: false }

        data = data.map((a) => ({ ...a, path: a.path || a.id, ...(a.type === "video" ? videoData : {}) }))
        let activeLayout = get(showsCache)[get(activeShow)!.id]?.settings?.activeLayout
        let layoutLength = _show("active").layouts([activeLayout]).get()[0]?.length
        let newData = { index: layoutLength, data: slides, layout: { backgrounds: data } }

        history({ id: "SLIDES", newData, location: { page: get(activePage) as HistoryPages, show: get(activeShow)!, layout: activeLayout } })
    },
    lock_show: (obj: any) => {
        showsCache.update((a: any) => {
            obj.sel.data.forEach((b: any) => {
                if (!a[b.id]) return
                a[b.id].locked = !a[b.id].locked

                // remove template
                a[b.id].settings.template = null
            })
            return a
        })
        shows.update((a: any) => {
            obj.sel.data.forEach((b: any) => {
                if (a[b.id].locked) delete a[b.id].locked
                else a[b.id].locked = true
            })
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
    align_with_screen: () => send(OUTPUT, ["ALIGN_WITH_SCREEN"]),
    choose_screen: () => {
        popupData.set({ activateOutput: true })
        activePopup.set("choose_screen")
    },
    toggle_output: (obj: any) => {
        let id: string = obj.contextElem.id
        send(OUTPUT, ["DISPLAY"], { enabled: "toggle", one: true, output: { id, ...get(outputs)[id] } })
    },
    move_to_front: (obj: any) => {
        send(OUTPUT, ["TO_FRONT"], obj.contextElem.id)
    },
    hide_from_preview: (obj: any) => {
        let outputId = obj.contextElem.id
        toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
        setTimeout(() => {
            outputs.update((a) => {
                // should match the outputs list in MultiOutputs.svelte
                let showingOutputsList = Object.values(a).filter((a) => a.enabled && !a.hideFromPreview && !a.isKeyOutput)
                let newValue = !a[outputId].hideFromPreview

                if (newValue && showingOutputsList.length <= 1) newToast("$toast.one_output")
                else a[outputId].hideFromPreview = !a[outputId].hideFromPreview

                return a
            })
        }, 100)
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

        if (obj.contextElem.classList.contains("#category_media") || obj.sel.id === "category_media") {
            send(MAIN, ["OPEN_FOLDER"], { channel: "MEDIA", title: get(dictionary).new?.folder })
            return
        }

        if (obj.contextElem.classList.contains("#category_audio") || obj.sel.id === "category_audio") {
            send(MAIN, ["OPEN_FOLDER"], { channel: "AUDIO", title: get(dictionary).new?.folder })
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
        versions = versions.filter((id) => typeof id === "string") // sometimes the bibles object is added
        versions = versions.filter((id) => !Object.entries(get(scriptures)).find(([tabId, a]) => (tabId === id || a.id === id) && a.collection !== undefined))
        if (versions.length < 2) return

        let name = ""
        versions.forEach((id, i) => {
            if (i > 0) name += " + "
            if (id.length < 5) {
                name += id.toUpperCase()
            } else {
                let bibleName: string = Object.values(get(scriptures)).find((a) => a.id === id)?.name || ""
                name += getShortBibleName(bibleName)
            }
        })

        scriptures.update((a) => {
            a[uid()] = { name, collection: { versions } }
            return a
        })
    },
    create_show: (obj: any) => {
        if (obj.sel.id === "scripture") {
            triggerFunction("scripture_newShow")
        }
    },

    // project
    export: (obj: any) => {
        if (obj.sel.id === "template") {
            let template = get(templates)[obj.sel.data[0]]
            if (!template) return
            send(EXPORT, ["TEMPLATE"], { path: get(dataPath), content: template })

            return
        }

        if (obj.sel.id === "theme") {
            let theme = get(themes)[obj.sel.data[0]?.id]
            if (!theme) return
            send(EXPORT, ["THEME"], { path: get(dataPath), content: theme })

            return
        }

        if (obj.contextElem.classList.value.includes("project")) {
            if (obj.sel.id !== "project" && !get(activeProject)) return
            let projectId: string = obj.sel.data[0]?.id || get(activeProject)
            exportProject(get(projects)[projectId])

            return
        }
    },
    close: (obj: any) => {
        if (get(currentWindow) === "output") {
            hideDisplay()
            return
        }

        if (obj.contextElem.classList.contains("media")) {
            if (get(previousShow)) {
                activeShow.set(JSON.parse(get(previousShow)))
                previousShow.set(null)
            } else {
                activeShow.set(null)
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
        activeEdit.set({ items: [] })
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
    view_simple: () => {
        slidesOptions.set({ ...get(slidesOptions), mode: "simple" })
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
    slide_transition: (obj: any) => {
        if (obj.sel.id !== "slide") return

        activePopup.set("transition")
    },
    disable: (obj: any) => {
        if (obj.sel.id === "slide") {
            showsCache.update((a) => {
                obj.sel.data.forEach((b: any) => {
                    let ref = GetLayoutRef()[b.index]
                    let slides = a[get(activeShow)!.id].layouts?.[a[get(activeShow)!.id]?.settings?.activeLayout]?.slides
                    if (!slides) return

                    if (ref.type === "child") {
                        if (!slides[ref.layoutIndex].children) slides[ref.layoutIndex].children = {}
                        slides[ref.layoutIndex].children[ref.id] = { ...slides[ref.layoutIndex].children[ref.id], disabled: !obj.enabled }
                    } else slides[ref.index].disabled = !obj.enabled
                })
                return a
            })
            return
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
    editSlideText: (obj) => {
        if (obj.sel.id === "slide") {
            let slide = obj.sel.data[0]
            activeEdit.set({ slide: slide.index, items: [], showId: slide.showId })
            activePage.set("edit")
            setTimeout(() => selected.set({ id: null, data: [] }))
        }
    },

    edit: (obj: any) => {
        if (obj.sel.id === "slide") {
            let slide = obj.sel.data[0]
            activeEdit.set({ slide: slide.index, items: [], showId: slide.showId || get(activeShow)?.id })
            activePage.set("edit")
            setTimeout(() => selected.set({ id: null, data: [] }))
        } else if (obj.sel.id === "media") {
            activeEdit.set({ type: "media", id: obj.sel.data[0].path, items: [] })
            activePage.set("edit")
        } else if (["overlay", "template", "effect"].includes(obj.sel.id)) {
            activeEdit.set({ type: obj.sel.id, id: obj.sel.data[0], items: [] })
            activePage.set("edit")
            refreshEditSlide.set(true)
        } else if (obj.sel.id === "global_group") {
            settingsTab.set("groups")
            activePage.set("settings")
        } else if (obj.sel.id === "timer") {
            activePopup.set("timer")
        } else if (obj.sel.id === "global_timer") {
            select("timer", { id: obj.sel.data[0].id })
            activePopup.set("timer")
        } else if (obj.sel.id === "variable") {
            activePopup.set("variable")
        } else if (obj.sel.id === "trigger") {
            activePopup.set("trigger")
        } else if (obj.sel.id === "audio_stream") {
            activePopup.set("audio_stream")
        } else if (obj.sel.id === "action") {
            popupData.set(obj.sel.data[0])
            activePopup.set("action")
        } else if (obj.contextElem?.classList.value.includes("#event")) {
            eventEdit.set(obj.contextElem.id)
            activePopup.set("edit_event")
        } else if (obj.contextElem?.classList.value.includes("output_button")) {
            currentOutputSettings.set(obj.contextElem.id)
            settingsTab.set("display_settings")
            activePage.set("settings")
        }
    },

    // chords
    chord_list: (obj: any) => actions.keys(obj),
    keys: (obj: any) => {
        if (get(selected).id !== "chord") return
        let data = get(selected).data[0]

        let item: any = _show().slides([data.slideId]).items([data.itemIndex]).get()[0][0]
        if (!item) return

        let newLines: any = clone(item.lines)
        if (data.chord) {
            let currentChordIndex = newLines[data.index].chords.findIndex((a) => a.id === data.chord.id)
            newLines[data.index].chords[currentChordIndex].key = obj.menu.id
        } else {
            if (!newLines[0].chords) newLines[0].chords = []
            newLines[0].chords.push({ id: uid(5), pos: 0, key: obj.menu.id })
        }

        _show()
            .slides([data.slideId])
            .items([data.itemIndex])
            .set({ key: "lines", values: [newLines] })
    },
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
    item_actions: (obj: any) => {
        let action = obj.menu.id
        popupData.set({ action })

        if (action === "transition") {
            activePopup.set("transition")
        } else if (action.includes("Timer")) {
            activePopup.set("set_time")
        }
    },
    template_actions: (obj: any) => {
        let templateId = obj.sel.data[0]
        let template = get(templates)[templateId]
        if (!template) return

        let existingActions = template.settings?.actions || []

        popupData.set({ mode: "template", templateId, existing: existingActions.map((a) => a.triggers?.[0]) })
        activePopup.set("action")
    },
    remove_layers: (obj: any) => {
        let type: "image" | "overlays" | "music" | "microphone" | "action" = obj.menu.type || obj.menu.icon
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
        } else if (type === "microphone") {
            let mics = layoutSlide.mics
            // remove clicked
            mics.splice(mics.indexOf(obj.menu.id), 1)
            newData = { key: "mics", data: mics, dataIsArray: true, indexes: [slide] }
        } else if (type === "action") {
            let actions = layoutSlide.actions || {}
            let slideActions = actions.slideActions || []

            let actionId = obj.menu.id
            let actionIndex = slideActions.findIndex((a) => a.id === actionId)
            if (actionIndex > -1) slideActions.splice(actionIndex, 1)

            actions.slideActions = slideActions
            newData = { key: "actions", data: actions, indexes: [slide] }
        }

        if (newData) history({ id: "SHOW_LAYOUT", newData })
    },

    // media
    preview: (obj: any) => {
        let path: string = obj.sel.data[0].path || obj.sel.data[0].id || obj.sel.data[0]
        if (!path) return

        let type = obj.sel.id || "media"
        if (type === "media") activeEdit.set({ id: path, type: "media", items: [] })

        let name = removeExtension(getFileName(path))
        let mediaType = type === "media" ? getMediaType(getExtension(path)) : type

        let showRef: any = { id: path, type: mediaType }
        if (name) showRef.name = name
        activeShow.set(showRef)

        activePage.set("show")
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

        let mediaStyle: MediaStyle = getMediaStyle(get(media)[path], { name: "" })
        if (!get(outLocked)) setOutput("background", { path, ...mediaStyle })
    },
    play_no_filters: (obj: any) => {
        let path = obj.sel.data[0].path || obj.sel.data[0].id
        if (!path) return
        if (!get(outLocked)) setOutput("background", { path, type: getMediaType(getExtension(path)) })
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
    system_open: (obj: any) => {
        let data = obj.sel.data[0]
        if (obj.sel.id === "category_media") data = get(mediaFolders)[data]
        else if (obj.sel.id === "category_audio") data = get(audioFolders)[data]

        let path = data?.path
        if (!path) return

        send(MAIN, ["SYSTEM_OPEN"], path)
    },

    // live
    recording: (obj: any) => {
        if (get(activeRecording)) {
            stopMediaRecorder()
        } else {
            let media = JSON.parse(obj.contextElem.getAttribute("data-media") || "{}")
            if (!media.video) {
                newToast("$toast.error_media")
                return
            }

            activeRecording.set(media)
        }
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
    place_under_slide: (obj: any) => {
        if (obj.sel.id !== "overlay") return
        let setUnder: boolean = !get(overlays)[obj.sel.data[0]]?.placeUnderSlide

        overlays.update((a) => {
            obj.sel.data.forEach((id: string) => {
                a[id].placeUnderSlide = setUnder
            })
            return a
        })
    },

    // stage
    move_connections: (obj: any) => {
        let stageId = obj.sel.data[0]?.id
        moveStageConnection(stageId)
    },

    // drawer navigation
    changeIcon: () => activePopup.set("icon"),

    selectAll: (obj: any) => selectAll(obj.sel),

    bind_slide: (obj: any) => {
        let layoutSlide: number = obj.sel.data[0]?.index || 0
        let ref = _show().layouts("active").ref()[0]

        let bindings: string[] = ref[layoutSlide]?.data?.bindings || []
        let outputId = obj.menu.id
        let existingIndex = bindings.indexOf(outputId)
        if (existingIndex >= 0) bindings.splice(existingIndex, 1)
        else bindings.push(outputId)

        history({ id: "SHOW_LAYOUT", newData: { key: "bindings", data: bindings, indexes: [layoutSlide], dataIsArray: true } })
    },
    // bind item
    bind_item: (obj: any) => {
        let id = obj.menu?.id
        let items = get(activeEdit).items

        if (get(activeEdit).id) {
            let currentItems = get($[(get(activeEdit).type || "") + "s"])?.[get(activeEdit).id!]?.items
            let itemValues = items.map((index) => currentItems[index].bindings || [])
            let newValues: string[][] = []
            itemValues.forEach((value) => {
                if (!id) value = []
                else if (value.includes(id)) value.splice(value.indexOf(id, 1))
                else value.push(id)

                newValues.push(value)
            })

            history({
                id: "UPDATE",
                oldData: { id: get(activeEdit).id },
                newData: { key: "items", subkey: "bindings", data: newValues, indexes: items },
                location: { page: "edit", id: get(activeEdit).type + "_items", override: true },
            })

            return
        }

        let slideIndex: number = get(activeEdit).slide || 0
        let ref = _show().layouts("active").ref()[0]
        let slideRef = ref[slideIndex]

        let itemValues = _show().slides([slideRef.id]).items(items).get("bindings")[0]
        itemValues = itemValues.map((a) => a || [])
        let newValues: string[][] = []
        itemValues.forEach((value) => {
            if (!id) value = []
            else if (value.includes(id)) value.splice(value.indexOf(id, 1))
            else value.push(id)

            newValues.push(value)
        })

        history({
            id: "setItems",
            newData: { style: { key: "bindings", values: newValues } },
            location: { page: "edit", show: get(activeShow)!, slide: slideRef.id, items, override: "itembind_" + slideRef.id + "_items_" + items.join(",") },
        })
        // _show().slides([slideID!]).set({ key: "items", value: items })
    },
    dynamic_values: (obj: any) => {
        let id = obj.menu.id

        let sel = getSelectionRange()
        let lineIndex = sel.findIndex((a) => a?.start !== undefined)
        console.log(sel, lineIndex)
        if (lineIndex < 0) return

        let edit = get(activeEdit)
        let caret = { line: lineIndex || 0, pos: sel[lineIndex].start || 0 }

        if (edit.id) {
            if (edit.type === "overlay") {
                overlays.update((a) => {
                    a[edit.id!].items = updateItemText(a[edit.id!].items)
                    return a
                })
            } else if (edit.type === "template") {
                templates.update((a) => {
                    a[edit.id!].items = updateItemText(a[edit.id!].items)
                    console.log(a[edit.id!].items)
                    return a
                })
            }

            refreshEditSlide.set(true)
            return
        }

        let showId = get(activeShow)?.id || ""
        let ref = _show(showId).layouts("active").ref()[0]
        let slideId = ref[edit.slide || 0]?.id || ""

        showsCache.update((a) => {
            if (!a[showId]?.slides?.[slideId]) return a

            a[showId].slides[slideId].items = updateItemText(a[showId].slides[slideId].items)
            return a
        })

        refreshEditSlide.set(true)

        function updateItemText(items) {
            let replaced = false

            items[edit.items?.[0]]?.lines?.[caret.line].text.forEach((text) => {
                if (replaced) return

                let value = text.value
                if (value.length < caret.pos) {
                    caret.pos -= value.length
                    return
                }

                let newValue = value.slice(0, caret.pos) + dynamicValueText(id) + value.slice(caret.pos)
                text.value = newValue
                replaced = true
            })

            return items
        }
    },
    to_front: () => rearrangeItems("to_front"),
    forward: () => rearrangeItems("forward"),
    backward: () => rearrangeItems("backward"),
    to_back: () => rearrangeItems("to_back"),

    // formats
    find_replace: (obj: any) => {
        popupData.set(obj)
        activePopup.set("find_replace")
        // format("find_replace", obj)
    },
    cut_in_half: (obj: any) => {
        if (obj.sel.id === "slide") {
            let oldLayoutRef = clone(_show().layouts("active").ref()[0])
            let previousSpiltIds: string[] = []

            // go backwards to prevent wrong index when splitted
            let selectedSlides = obj.sel.data.sort((a, b) => b.index - a.index)

            selectedSlides.forEach(({ index }) => {
                let slideRef = oldLayoutRef[index]
                if (!slideRef || previousSpiltIds.includes(slideRef.id)) return
                previousSpiltIds.push(slideRef.id)

                let slideItems = _show().slides([slideRef.id]).get("items")[0]

                let firstTextItemIndex = slideItems.findIndex((a) => a.lines) ?? -1
                if (firstTextItemIndex < 0) return

                splitItemInTwo(slideRef, firstTextItemIndex)
            })
        } else if (!obj.sel.id) {
            // textbox
            let editSlideIndex: number = get(activeEdit).slide ?? -1
            if (editSlideIndex < 0) return

            let textItemIndex: number = get(activeEdit).items[0] ?? -1
            if (textItemIndex < 0) return

            let slideRef = _show().layouts("active").ref()[0][editSlideIndex]
            if (!slideRef) return
            splitItemInTwo(slideRef, textItemIndex)
        }
    },
    merge: (obj: any) => {
        if (obj.sel.id === "slide") {
            let selectedSlides = obj.sel.data // .sort((a, b) => a.index - b.index) [merge based on selected order]
            if (selectedSlides.length > 1) mergeSlides(selectedSlides)
        } else if (!obj.sel.id) {
            // textbox
            mergeTextboxes()
        }
    },
    uppercase: (obj: any) => format("uppercase", obj),
    lowercase: (obj: any) => format("lowercase", obj),
    capitalize: (obj: any) => format("capitalize", obj),
    trim: (obj: any) => format("trim", obj),

    // settings
    reset_theme: (obj: any) => {
        obj.sel.data.forEach(({ id }) => {
            let oldTheme = get(themes)[id]
            let defaultTheme = defaultThemes[id] || defaultThemes.default
            let data = { ...defaultTheme, default: oldTheme.default || false, name: oldTheme.name }

            history({ id: "UPDATE", newData: { data }, oldData: { id }, location: { page: "settings", id: "settings_theme" } })
            updateThemeValues(get(themes)[id])
        })
    },
    reset: (obj: any) => {
        if (obj.sel.id === "style") {
            const defaultStyle = { name: get(dictionary).example?.default || "Default" }

            obj.sel.data.forEach(({ id }) => {
                let styleId = id || (get(styles).default ? uid() : "default")
                let style = get(styles)[styleId] || clone(defaultStyle)

                let name = style?.name || ""
                style = { name }

                styles.update((a) => {
                    a[styleId] = style

                    return a
                })
            })

            return
        }

        if (obj.sel.id === "output") {
            obj.sel.data.forEach(({ id }) => {
                let currentOutput = clone(get(outputs)[id] || defaultOutput)

                let newOutput = clone(defaultOutput)

                // don't reset these values
                newOutput.name = currentOutput.name
                newOutput.out = currentOutput.out
                if (!currentOutput.enabled) newOutput.active = true
                if (currentOutput.stageOutput) newOutput.stageOutput = currentOutput.stageOutput

                history({ id: "UPDATE", newData: { data: newOutput }, oldData: { id }, location: { page: "settings", id: "settings_output" } })
            })

            return
        }
    },
}

function changeSlideAction(obj: any, id: string) {
    let layoutSlide: number = obj.sel.data[0]?.index || 0
    let ref = _show().layouts("active").ref()[0]
    if (!ref[layoutSlide]) return

    let actions = clone(ref[layoutSlide].data?.actions) || {}

    if (id === "action") {
        let id = uid()
        if (!actions.slideActions) actions.slideActions = []
        actions.slideActions.push({ id })

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [layoutSlide] } })

        popupData.set({ id, mode: "slide", index: layoutSlide, existing: actions.slideActions.map((a) => a.triggers?.[0]) })
        activePopup.set("action")

        return
    }

    if (id === "receiveMidi") {
        let midiId: string = uid()

        if (actions[id]) midiId = actions[id]
        else actions[id] = midiId

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [layoutSlide] } })

        let data: any = { id: midiId, index: layoutSlide, mode: "slide_midi" } // , index: layoutSlide

        popupData.set(data)
        activePopup.set("action")

        return
    }

    let indexes: number[] = obj.sel.data.map(({ index }) => index)

    if (id === "animate") {
        if (!actions[id]) {
            actions[id] = { actions: [{ type: "change", duration: 3, id: "text", key: "font-size", extension: "px" }] }
            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes }, location: { page: "show", override: "animate_slide" } })
        }

        let data: any = { data: actions[id], indexes }

        popupData.set(data)
        activePopup.set("animate")

        return
    }

    if (id === "nextTimer") {
        let nextTimer = clone(ref[layoutSlide]?.data?.nextTimer) || 0

        history({ id: "SHOW_LAYOUT", newData: { key: "nextTimer", data: nextTimer, indexes }, location: { page: "show", override: "change_style_slide" } })

        let data: any = { value: nextTimer, indexes }

        popupData.set(data)
        activePopup.set("next_timer")

        return
    }

    // this is old and has to be stored as this
    if (id === "loop") {
        let loop = ref[layoutSlide]?.data?.end || false
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
    let ref = _show().layouts("active").ref()[0]
    let firstSlideId = ref[0].id

    let removeSlideIds: any[] = []
    data.forEach((slideRef) => {
        if (!slideRef.index) return
        let refSlide = ref.find((a) => a.layoutIndex === slideRef.index)
        if (refSlide?.type === "child" || refSlide?.id === firstSlideId) return

        removeSlideIds.push(refSlide.id)
    })
    removeSlideIds = removeDuplicates(removeSlideIds)
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
            if (ref[index].type === "child" && parents.find((a) => a.id === ref[index].parent?.id)) return

            index = ref[index].parent?.layoutIndex ?? index
            parents.push({ index: ref[index].index, id: ref[index].id })
            return
        }

        if (ref[index].type === "parent") parents.push({ index: ref[index].index, id: ref[index].id })
        else childs.push({ id: ref[index].id })
    })

    let slides = parents
    // don't do anything with the children if it's removing parents
    if (type === "remove") slides = removeDuplicates(slides)
    else slides.push(...childs)

    if (!slides.length) return

    history({ id: "SLIDES", oldData: { type, data: slides } })
}

export function format(id: string, obj: any, data: any = null) {
    let slides: any[] = []

    let editing = get(activeEdit)
    let items = editing.items || []

    // WIP let slide = getEditSlide()

    if (editing.id) {
        let currentItems: any[] = []
        if (editing.type === "overlay") currentItems = get(overlays)[editing.id]?.items || []
        if (editing.type === "template") currentItems = get(templates)[editing.id]?.items || []

        let newItems: any[] = []
        currentItems.forEach((item: any) => {
            item.lines?.forEach((line: any, j: number) => {
                line.text?.forEach((text: any, k: number) => {
                    item.lines[j].text[k].value = formatting[id](text.value, data)
                })
            })
            newItems.push(item)
        })

        let override = editing.id + "_format#" + items.join(",")
        history({
            id: "UPDATE",
            oldData: { id: editing.id },
            newData: { key: "items", data: newItems, indexes: items },
            location: { page: "edit", id: editing.type + "_items", override },
        })

        refreshEditSlide.set(true)
        return
    }

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
        let slideItems: any = _show().slides([slide]).items(get(activeEdit).items).get()[0]
        let newData: any = { style: { values: [] } }

        let newItems: any[] = []
        slideItems.forEach((item: any) => {
            item.lines?.forEach((line: any, j: number) => {
                line.text?.forEach((text: any, k: number) => {
                    item.lines[j].text[k].value = formatting[id](text.value, data)
                })
            })
            newItems.push(item)
        })
        newData.style.values = newItems

        history({ id: "setItems", newData, location: { page: get(activePage) as any, show: get(activeShow)!, items, slide } })
    })

    refreshEditSlide.set(true)
}

const formatting: any = {
    find_replace: (t: string, data) => {
        if (!data.findValue) return t

        let flags = "g"
        if (data.caseSentitive === false) flags += "i"
        var regExp = new RegExp(data.findValue, flags)
        return t.replace(regExp, data.replaceValue)
    },
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

// SORT

function sort(obj: any, id: string) {
    let type = obj.menu.id

    sorted.update((a) => {
        if (!a[id]) a[id] = {}
        a[id].type = type
        return a
    })

    if (id === "shows") updateShowsList(get(shows))
}
