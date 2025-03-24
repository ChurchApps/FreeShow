import { get } from "svelte/store"
import { uid } from "uid"
import { EXPORT, OUTPUT } from "../../../types/Channels"
import type { HistoryPages } from "../../../types/History"
import { Main } from "../../../types/IPC/Main"
import type { MediaStyle, Selected, SelectIds } from "../../../types/Main"
import type { Item, Slide, SlideData } from "../../../types/Show"
import { sendMain } from "../../IPC/main"
import { changeSlideGroups, mergeSlides, mergeTextboxes, splitItemInTwo } from "../../show/slides"
import {
    $,
    activeActionTagFilter,
    activeDrawerTab,
    activeEdit,
    activeFocus,
    activeMediaTagFilter,
    activePage,
    activePopup,
    activeRecording,
    activeRename,
    activeShow,
    activeTagFilter,
    activeTimers,
    audioFolders,
    categories,
    contextActive,
    currentOutputSettings,
    currentWindow,
    dataPath,
    dictionary,
    drawerTabsData,
    effectsLibrary,
    eventEdit,
    events,
    focusMode,
    forceClock,
    guideActive,
    media,
    mediaFolders,
    midiIn,
    outLocked,
    outputs,
    overlayCategories,
    overlays,
    popupData,
    previousShow,
    projects,
    projectTemplates,
    projectView,
    refreshEditSlide,
    scriptures,
    selected,
    settingsTab,
    showRecentlyUsedProjects,
    shows,
    showsCache,
    slidesOptions,
    sorted,
    stageShows,
    styles,
    templateCategories,
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
import { getItemText, getSelectionRange } from "../edit/scripts/textStyle"
import { exportProject } from "../export/project"
import { clone, removeDuplicates } from "../helpers/array"
import { copy, cut, deleteAction, duplicate, paste, selectAll } from "../helpers/clipboard"
import { history, redo, undo } from "../helpers/history"
import { getExtension, getFileName, getMediaStyle, getMediaType, removeExtension } from "../helpers/media"
import { defaultOutput, getActiveOutputs, getCurrentStyle, setOutput, toggleOutput } from "../helpers/output"
import { select } from "../helpers/select"
import { removeTemplatesFromShow, updateShowsList } from "../helpers/show"
import { dynamicValueText, sendMidi } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import { defaultThemes } from "../settings/tabs/defaultThemes"
import { activeProject } from "./../../stores"
import type { ContextMenuItem } from "./contextMenus"

interface ObjData {
    sel: Selected | null
    actionItem: HTMLElement | null
    enabled: boolean
    contextElem: HTMLElement | null
    menu: ContextMenuItem
}

export function menuClick(id: string, enabled: boolean = true, menu: ContextMenuItem | null = null, contextElem: HTMLElement | null = null, actionItem: HTMLElement | null = null, sel: Selected | null = null) {
    if (!actions[id]) return console.log("MISSING CONTEXT: ", id)

    if (sel?.id) sel.id = sel.id.split("___")[0] as SelectIds // different selection ID, same action (currently used to seperate scripture navigation buttons)

    let obj = { sel, actionItem, enabled, contextElem, menu }
    console.log("MENU CLICK: " + id, obj)

    actions[id](obj)
}

const actions = {
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
        showRecentlyUsedProjects.set(false)

        let firstItem = project.shows[0]
        if (firstItem) activeFocus.set({ id: firstItem.id, index: 0, type: firstItem.type })

        activePage.set("show")
        focusMode.set(!get(focusMode))
    },
    fullscreen: () => sendMain(Main.FULLSCREEN),
    // edit
    undo: () => undo(),
    redo: () => redo(),
    history: () => activePopup.set("history"),
    cut: () => cut(),
    copy: () => copy(),
    paste: (obj: ObjData) => paste(null, {}, obj.contextElem),
    // view
    // help
    docs: () => sendMain(Main.URL, "https://freeshow.app/docs"),
    shortcuts: () => activePopup.set("shortcuts"),
    about: () => activePopup.set("about"),
    quick_start_guide: () => guideActive.set(true),

    // main
    rename: (obj: ObjData) => {
        let id = obj.sel?.id || obj.contextElem?.id
        if (!id) return
        let data = obj.sel?.data?.[0] || {}

        const renameById = ["show_drawer", "project", "folder", "stage", "theme", "style", "output", "tag"]
        const renameByIdDirect = ["overlay", "template", "player", "layout"]

        if (renameById.includes(id)) activeRename.set(id + "_" + data.id)
        else if (renameByIdDirect.includes(id)) activeRename.set(id + "_" + data)
        else if (id === "slide" || id === "group" || id === "audio_effect") activePopup.set("rename")
        else if (id === "show") activeRename.set("show_" + data.id + "#" + data.index)
        else if (obj.contextElem?.classList?.contains("#project_template")) activeRename.set("project_" + id)
        else if (obj.contextElem?.classList?.contains("#video_subtitle")) activeRename.set("subtitle_" + id)
        else if (obj.contextElem?.classList?.contains("#video_marker")) activeRename.set("marker_" + id)
        else if (id?.includes("category")) activeRename.set("category_" + get(activeDrawerTab) + "_" + data)
        else console.log("Missing rename", obj)
    },
    sort_shows: (obj: ObjData) => sort(obj, "shows"),
    sort_projects: (obj: ObjData) => sort(obj, "projects"),
    remove: (obj: ObjData) => {
        if (obj.sel && deleteAction(obj.sel)) return

        if (obj.contextElem?.classList.contains("#slide_recorder_item")) {
            const index = obj.contextElem.id.slice(1)
            const activeLayout = _show().get("settings.activeLayout")
            let layout = clone(_show().get("layouts")[activeLayout] || {})
            layout.recording?.[0].sequence.splice(index, 1)

            history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: get(activeShow)!.id }, location: { page: "show", id: "show_layout" } })
            return
        }

        let id = obj.sel?.id
        if (id === "audio_effect") {
            effectsLibrary.update((a) => {
                obj.sel?.data.forEach((audio) => {
                    const path = audio.path || audio.id
                    let index = a.findIndex((a) => a.path === path)
                    if (index < 0) return

                    a.splice(index, 1)
                })
                return a
            })
            return
        }

        console.error("COULD NOT REMOVE", obj)
    },
    recolor: () => {
        // "slide" || "group" || "overlay" || "template" || "output"
        activePopup.set("color")
    },
    // not currently in use:
    remove_group: (obj: ObjData) => removeGroup(obj.sel?.data || []),
    remove_slide: (obj: ObjData) => {
        removeSlide(obj.sel?.data || [], "remove")
        if (get(activePage) === "edit") refreshEditSlide.set(true)
    },
    delete_slide: (obj: ObjData) => actions.delete(obj),
    delete_group: (obj: ObjData) => actions.delete(obj),
    delete: (obj: ObjData) => {
        // delete shows from project
        if (obj.sel?.id === "show") {
            // wait to delete until after they are removed from project
            setTimeout(() => {
                let sel: Selected = { ...obj.sel!, id: "show_drawer" }
                selected.set(sel)
                actions.delete({ ...obj, sel })
            })
        }

        if (obj.sel && deleteAction(obj.sel)) return

        if (obj.contextElem?.classList.value.includes("#project_template")) {
            deleteAction({ id: "project_template", data: [{ id: obj.contextElem.id }] })
            return
        }
        if (obj.contextElem?.classList.value.includes("#video_subtitle")) {
            deleteAction({ id: "video_subtitle", data: { index: obj.contextElem.id } })
            return
        }
        if (obj.contextElem?.classList.value.includes("#video_marker")) {
            deleteAction({ id: "video_marker", data: { index: obj.contextElem.id } })
            return
        }
        // delete slide item using context menu, or menubar action
        if (obj.contextElem?.classList.value.includes("#edit_box") || (!obj.sel?.id && get(activeEdit).slide !== undefined && get(activeEdit).items.length)) {
            deleteAction({ id: "item", data: { slide: get(activeEdit).slide } })
            return
        }
        if (obj.contextElem?.classList.value.includes("#event")) {
            deleteAction({ id: "event", data: { id: obj.contextElem.id } })
            return
        }

        console.error("COULD NOT DELETE", obj)
    },
    delete_all: (obj: ObjData) => {
        if (obj.contextElem?.classList.value.includes("#event")) {
            let group = get(events)[obj.contextElem.id].group
            if (!group) return

            let eventIds: string[] = []
            Object.entries(get(events)).forEach(([id, event]) => {
                if (event.group === group) eventIds.push(id)
            })

            history({ id: "UPDATE", newData: { id: "keys" }, oldData: { keys: eventIds }, location: { page: "drawer", id: "event" } })
        }
    },
    duplicate: (obj: ObjData) => {
        if (duplicate(obj.sel)) return

        if (obj.contextElem?.classList.value.includes("#event")) {
            duplicate({ id: "event", data: { id: obj.contextElem.id } })
            return
        }
    },

    // drawer
    enabled_drawer_tabs: (obj: ObjData) => {
        let m = { hide: false, enabled: !obj.enabled }
        drawerTabsData.update((a) => {
            if (!a[obj.menu.id!]) a[obj.menu.id!] = { enabled: false, activeSubTab: null }
            a[obj.menu.id!].enabled = !obj.enabled
            return a
        })
        return m
    },

    // TAGS
    manage_show_tags: () => {
        contextActive.set(false)
        popupData.set({ type: "show" })
        activePopup.set("manage_tags")
    },
    tag_set: (obj: ObjData) => {
        let tagId = obj.menu.id
        if (tagId === "create") {
            actions.manage_show_tags()
            return
        }

        let disable = get(shows)[obj.sel?.data?.[0].id]?.quickAccess?.tags?.includes(tagId)

        obj.sel?.data?.forEach(({ id }) => {
            // WIP similar to Tag.svelte - toggleTag()
            let quickAccess = get(shows)[id]?.quickAccess || {}

            let tags = quickAccess.tags || []
            let existingIndex = tags.indexOf(tagId)
            if (disable) {
                if (existingIndex > -1) tags.splice(existingIndex, 1)
            } else {
                if (existingIndex < 0) tags.push(tagId)
            }

            quickAccess.tags = tags

            shows.update((a) => {
                a[id].quickAccess = quickAccess
                return a
            })
            if (get(showsCache)[id]) {
                showsCache.update((a) => {
                    a[id].quickAccess = quickAccess
                    return a
                })
            }

            // history({ id: "UPDATE", newData: { data: quickAccess, key: "quickAccess" }, oldData: { id }, location: { page: "show", id: "show_key", override: "toggle_tag" } })
        })
    },
    tag_filter: (obj: ObjData) => {
        let tagId = obj.menu.id || ""

        let activeTags = get(activeTagFilter)
        let currentIndex = activeTags.indexOf(tagId)
        if (currentIndex < 0) activeTags.push(tagId)
        else activeTags.splice(currentIndex, 1)

        activeTagFilter.set(activeTags || [])
    },
    manage_media_tags: () => {
        contextActive.set(false)
        popupData.set({ type: "media" })
        activePopup.set("manage_tags")
    },
    media_tag_set: (obj: ObjData) => {
        let tagId = obj.menu.id || ""
        if (tagId === "create") {
            actions.manage_media_tags()
            return
        }

        let disable = get(media)[get(selected).data[0]?.path]?.tags?.includes(tagId)

        obj.sel?.data?.forEach(({ path }) => {
            let tags = get(media)[path]?.tags || []

            let existingIndex = tags.indexOf(tagId)
            if (disable) {
                if (existingIndex > -1) tags.splice(existingIndex, 1)
            } else {
                if (existingIndex < 0) tags.push(tagId)
            }

            media.update((a) => {
                if (!a[path]) a[path] = {}
                a[path].tags = tags
                return a
            })
        })
    },
    media_tag_filter: (obj: ObjData) => {
        let tagId = obj.menu.id || ""

        let activeTags = get(activeMediaTagFilter)
        let currentIndex = activeTags.indexOf(tagId)
        if (currentIndex < 0) activeTags.push(tagId)
        else activeTags.splice(currentIndex, 1)

        activeMediaTagFilter.set(activeTags || [])
    },
    manage_action_tags: () => {
        contextActive.set(false)
        popupData.set({ type: "action" })
        activePopup.set("manage_tags")
    },
    action_tag_set: (obj: ObjData) => {
        let tagId = obj.menu.id || ""
        if (tagId === "create") {
            actions.manage_action_tags()
            return
        }

        let disable = get(midiIn)[get(selected).data[0]?.id]?.tags?.includes(tagId)

        obj.sel?.data?.forEach(({ id }) => {
            let tags = get(midiIn)[id]?.tags || []

            let existingIndex = tags.indexOf(tagId)
            if (disable) {
                if (existingIndex > -1) tags.splice(existingIndex, 1)
            } else {
                if (existingIndex < 0) tags.push(tagId)
            }

            midiIn.update((a) => {
                if (a[id]) a[id].tags = tags
                return a
            })
        })
    },
    action_tag_filter: (obj: ObjData) => {
        let tagId = obj.menu.id || ""

        let activeTags = get(activeActionTagFilter)
        let currentIndex = activeTags.indexOf(tagId)
        if (currentIndex < 0) activeTags.push(tagId)
        else activeTags.splice(currentIndex, 1)

        activeActionTagFilter.set(activeTags || [])
    },

    addToProject: (obj: ObjData) => {
        if (!obj.sel) return
        if ((obj.sel.id !== "show" && obj.sel.id !== "show_drawer" && obj.sel.id !== "player" && obj.sel.id !== "media" && obj.sel.id !== "audio") || !get(activeProject)) return

        if (obj.sel.id === "player") obj.sel.data = obj.sel.data.map((id: string) => ({ id, type: "player" }))
        else if (obj.sel.id === "audio") obj.sel.data = obj.sel.data.map(({ path, name }) => ({ id: path, name, type: "audio" }))
        else if (obj.sel.id === "media")
            obj.sel.data = obj.sel.data.map(({ path, name }) => ({
                id: path,
                name,
                type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length)),
            }))

        projects.update((a) => {
            if (!a[get(activeProject)!]) return a

            a[get(activeProject)!].shows.push(...obj.sel!.data)
            return a
        })
    },
    addToShow: (obj: ObjData) => {
        let data = obj.sel?.data || []

        let slides = data.map((a) => ({ id: a.id || uid(), group: removeExtension(a.name || a.path || ""), color: null, settings: {}, notes: "", items: [] }))

        let videoData: any = {}
        // videos are probably not meant to be background if they are added in bulk
        if (data.length > 1) videoData = { muted: false, loop: false }

        data = data.map((a) => ({ ...a, path: a.path || a.id, ...(a.type === "video" ? videoData : {}) }))
        let activeLayout = get(showsCache)[get(activeShow)!.id]?.settings?.activeLayout
        let layoutLength = _show().layouts([activeLayout]).get()[0]?.length
        let newData = { index: layoutLength, data: slides, layout: { backgrounds: data } }

        history({ id: "SLIDES", newData, location: { page: get(activePage) as HistoryPages, show: get(activeShow)!, layout: activeLayout } })
    },
    lock_show: (obj: ObjData) => {
        if (!obj.sel) return
        let shouldBeLocked = !get(shows)[obj.sel.data[0]?.id]?.locked

        showsCache.update((a) => {
            obj.sel!.data.forEach((b) => {
                if (!a[b.id]) return
                a[b.id].locked = shouldBeLocked

                removeTemplatesFromShow(b.id)
            })
            return a
        })
        shows.update((a) => {
            obj.sel!.data.forEach((b) => {
                if (shouldBeLocked) a[b.id].locked = true
                else delete a[b.id].locked
            })
            return a
        })
    },
    category_action: (obj: ObjData) => {
        let id = obj.sel?.data[0]
        if (!id) return

        popupData.set({ id })
        activePopup.set("category_action")
    },
    use_as_archive: (obj: ObjData) => {
        const categoryStores = {
            category_shows: () => categories.update(toggleArchive),
            category_overlays: () => overlayCategories.update(toggleArchive),
            category_templates: () => templateCategories.update(toggleArchive),
        }

        if (!categoryStores[obj.sel?.id || ""]) return
        categoryStores[obj.sel!.id!]()

        function toggleArchive(a) {
            obj.sel!.data.forEach((id) => {
                a[id].isArchive = !a[id].isArchive
            })
            return a
        }
    },
    toggle_clock: () => {
        forceClock.set(!get(forceClock))
    },

    // output
    force_output: () => {
        let enabledOutputs = getActiveOutputs(get(outputs), false)
        enabledOutputs.forEach((id) => {
            let output = { id, ...get(outputs)[id] }
            // , force: e.ctrlKey || e.metaKey
            send(OUTPUT, ["DISPLAY"], { enabled: true, output, force: true })
        })
    },
    align_with_screen: () => send(OUTPUT, ["ALIGN_WITH_SCREEN"]),
    choose_screen: () => {
        popupData.set({ activateOutput: true })
        activePopup.set("choose_screen")
    },
    toggle_output: (obj: ObjData) => {
        let id = obj.contextElem?.id || ""
        toggleOutput(id)
    },
    move_to_front: (obj: ObjData) => {
        send(OUTPUT, ["TO_FRONT"], obj.contextElem?.id)
    },
    hide_from_preview: (obj: ObjData) => {
        let outputId = obj.contextElem?.id || ""
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
    newProject: (obj: ObjData) => {
        let parent: string = obj.sel?.data[0]?.id || obj.contextElem?.id || "/" // obj.contextElem.getAttribute("data-parent")
        if (parent === "projectsArea") parent = "/"
        history({ id: "UPDATE", newData: { replace: { parent } }, location: { page: "show", id: "project" } })
    },
    newFolder: (obj: ObjData) => {
        if (obj.contextElem?.classList.contains("#folder__projects") || obj.contextElem?.classList.contains("#projects")) {
            let parent = obj.sel?.data[0]?.id || obj.contextElem.id || "/"
            if (parent === "projectsArea") parent = "/"
            history({ id: "UPDATE", newData: { replace: { parent } }, location: { page: "show", id: "project_folder" } })
            return
        }

        if (obj.contextElem?.classList.contains("#category_media") || obj.sel?.id === "category_media") {
            sendMain(Main.OPEN_FOLDER, { channel: "MEDIA", title: get(dictionary).new?.folder })
            return
        }

        if (obj.contextElem?.classList.contains("#category_audio") || obj.sel?.id === "category_audio") {
            sendMain(Main.OPEN_FOLDER, { channel: "AUDIO", title: get(dictionary).new?.folder })
            return
        }
    },
    newSlide: () => {
        history({ id: "SLIDES" })
    },
    newCategory: (obj: ObjData) => {
        let classList = obj.contextElem?.classList?.value || ""
        let index = classList.indexOf("#category")
        let id = classList.slice(index + 1, classList.indexOf(" ", index))
        id = id.split("__")[1] || id
        history({ id: "UPDATE", location: { page: "drawer", id } })
    },
    newScripture: () => activePopup.set("import_scripture"),

    // scripture collection
    createCollection: (obj: ObjData) => {
        if (obj.sel?.id !== "category_scripture") return
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
                let bibleName: string = (get(scriptures)[id] || Object.values(get(scriptures)).find((a) => a.id === id))?.name || ""
                name += getShortBibleName(bibleName)
            }
        })

        scriptures.update((a) => {
            a[uid()] = { name, collection: { versions } }
            return a
        })
    },
    create_show: (obj: ObjData) => {
        if (obj.contextElem?.classList.contains("chapters")) {
            triggerFunction("scripture_selectAll")
            setTimeout(() => triggerFunction("scripture_newShow"))
        } else if (obj.sel?.id === "scripture") {
            triggerFunction("scripture_newShow")
        }
    },

    // project
    export: (obj: ObjData) => {
        if (obj.sel?.id === "template") {
            let template = get(templates)[obj.sel.data[0]]
            if (!template) return
            send(EXPORT, ["TEMPLATE"], { path: get(dataPath), content: template })

            return
        }

        if (obj.sel?.id === "theme") {
            let theme = get(themes)[obj.sel.data[0]?.id]
            if (!theme) return
            send(EXPORT, ["THEME"], { path: get(dataPath), content: theme })

            return
        }

        if (obj.contextElem?.classList.value.includes("project")) {
            if (obj.sel?.id !== "project" && !get(activeProject)) return
            let projectId: string = obj.sel?.data[0]?.id || get(activeProject)
            exportProject(get(projects)[projectId])

            return
        }
    },
    close: (obj: ObjData) => {
        if (get(currentWindow) === "output") {
            hideDisplay()
            return
        }

        if (obj.contextElem?.classList.contains("media") || obj.contextElem?.classList.contains("overlayPreview")) {
            if (get(previousShow)) {
                activeShow.set(JSON.parse(get(previousShow)))
                previousShow.set(null)
            } else {
                activeShow.set(null)
            }
            return
        }

        // project
        if (obj.contextElem?.classList.contains("#projectTab")) {
            activeProject.set(null)
            projectView.set(true)
            return
        }

        // shows
        if (!obj.contextElem?.closest(".center")) return
        activeShow.set(null)
        activeEdit.set({ items: [] })
    },
    private: (obj: ObjData) => {
        if (!obj.sel) return

        showsCache.update((a) => {
            obj.sel!.data.forEach((b) => {
                if (!a[b.id]) return
                a[b.id].private = !a[b.id].private
            })
            return a
        })
        shows.update((a) => {
            obj.sel!.data.forEach((b) => {
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
    copy_to_template: (obj: ObjData) => {
        let project = clone(get(projects)[obj.sel?.data?.[0]?.id])
        if (!project) return

        project = { name: project.name, parent: "/", shows: project.shows, created: 0 }

        let id = uid()

        // find existing with the same name
        const existing = Object.entries(get(projectTemplates)).find(([_id, a]) => a.name === project.name)
        if (existing) id = existing[0]

        history({ id: "UPDATE", newData: { data: project }, oldData: { id }, location: { page: "show", id: "project_template" } })
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

    // show
    slide_transition: (obj: ObjData) => {
        if (obj.sel?.id !== "slide") return

        activePopup.set("transition")
    },
    disable: (obj: ObjData) => {
        if (obj.sel?.id === "slide") {
            showsCache.update((a) => {
                obj.sel!.data.forEach((b) => {
                    let ref = _show().layouts("active").ref()[0]?.[b.index] || []
                    let slides = a[get(activeShow)!.id].layouts?.[a[get(activeShow)!.id]?.settings?.activeLayout]?.slides
                    if (!slides) return

                    if (ref.type === "child") {
                        if (!slides[ref.parent!.index].children) slides[ref.parent!.index].children = {}
                        slides[ref.parent!.index].children![ref.id] = { ...slides[ref.parent!.index].children![ref.id], disabled: !obj.enabled }
                    } else slides[ref.index].disabled = !obj.enabled
                })
                return a
            })
            return
        }

        if (obj.sel?.id === "stage") {
            // history({ id: "changeStage", newData: {key: "disabled", value: }, location: { page: "stage", slide: obj.sel.data.map(({id}) => (id)) } })
            stageShows.update((a) => {
                let value: boolean = !a[obj.sel!.data[0].id].disabled
                obj.sel!.data.forEach((b) => {
                    a[b.id].disabled = value
                })
                return a
            })
            return
        }

        if (obj.sel?.id === "action") {
            let enabledState = get(midiIn)[obj.sel.data[0].id].enabled
            let value = enabledState === undefined ? false : !enabledState
            midiIn.update((a) => {
                obj.sel!.data.forEach((b) => {
                    let action = a[b.id]
                    if (action && (action.keypressActivate || action.customActivation)) {
                        a[b.id].enabled = value
                    }
                })
                return a
            })
            return
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

    edit: (obj: ObjData) => {
        if (!obj.sel) return

        if (obj.sel.id === "slide") {
            let slide = obj.sel.data[0]
            activeEdit.set({ slide: slide.index, items: [], showId: slide.showId || get(activeShow)?.id })
            activePage.set("edit")
            setTimeout(() => selected.set({ id: null, data: [] }))
        } else if (obj.sel.id === "media") {
            const path = obj.sel.data[0].path
            activeEdit.set({ type: "media", id: path, items: [] })
            activePage.set("edit")
            if (!get(activeShow) || (get(activeShow)!.type || "show") !== "show") activeShow.set({ id: path, type: getMediaType(getExtension(path)) })
        } else if (obj.sel.id === "audio") {
            const path = obj.sel.data[0].path
            activeEdit.set({ type: "audio", id: path, items: [] })
            activePage.set("edit")
            if (!get(activeShow) || (get(activeShow)!.type || "show") !== "show") activeShow.set({ id: path, type: "audio" })
        } else if (["overlay", "template", "effect"].includes(obj.sel.id || "")) {
            activeEdit.set({ type: obj.sel.id as any, id: obj.sel.data[0], items: [] })
            activePage.set("edit")
            refreshEditSlide.set(true)
        } else if (obj.sel.id === "global_group") {
            settingsTab.set("groups")
            activePage.set("settings")
        } else if (obj.sel.id === "action") {
            let firstActionId = obj.sel.data[0]?.id
            let action = get(midiIn)[firstActionId]
            let mode = action.shows?.length ? "slide_midi" : ""
            popupData.set({ id: firstActionId, mode })
            activePopup.set("action")
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
    chord_list: (obj: ObjData) => actions.keys(obj),
    keys: (obj: ObjData) => {
        if (get(selected).id !== "chord") return
        let data = get(selected).data[0]

        let item: Item = _show().slides([data.slideId]).items([data.itemIndex]).get()[0][0]
        if (!item) return

        let newLines = clone(item.lines)
        if (!newLines?.[data.index].chords) return

        if (data.chord) {
            let currentChordIndex = newLines[data.index].chords!.findIndex((a) => a.id === data.chord.id)
            if (currentChordIndex > -1) newLines[data.index].chords![currentChordIndex].key = obj.menu.id || ""
        } else {
            if (!newLines[0].chords) newLines[0].chords = []
            newLines[0].chords.push({ id: uid(5), pos: 0, key: obj.menu.id || "" })
        }

        _show()
            .slides([data.slideId])
            .items([data.itemIndex])
            .set({ key: "lines", values: [newLines] })
    },
    custom_key: (obj: ObjData) => {
        if (!obj.sel) return

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
    slide_groups: (obj: ObjData) => changeSlideGroups({ sel: { data: [{ index: obj.sel?.data?.[0]?.index }] }, menu: { id: obj.menu.id! } }),

    actions: (obj: ObjData) => changeSlideAction(obj, obj.menu.id || ""),
    transition: () => {
        // item transition
        popupData.set({ action: "transition" })
        activePopup.set("transition")
    },
    item_actions: (obj: ObjData) => {
        let action = obj.menu.id || ""
        popupData.set({ action })

        // if (action === "transition") {
        //     activePopup.set("transition")
        if (action.includes("Timer")) {
            activePopup.set("set_time")
        }
    },
    template_actions: (obj: ObjData) => {
        let templateId = obj.sel?.data[0]
        let template = get(templates)[templateId]
        if (!template) return

        let existingActions = template.settings?.actions || []

        popupData.set({ mode: "template", templateId, existing: existingActions.map((a) => a.triggers?.[0]) })
        activePopup.set("action")
    },
    remove_layers: (obj: ObjData) => {
        if (!obj.sel || !obj.menu.id) return

        let type: null | "image" | "overlays" | "music" | "microphone" | "action" = obj.menu.type || (obj.menu.icon as any) || null
        let slide: number = obj.sel.data[0].index
        let indexes: number[] = obj.sel.data.map(({ index }) => index)
        let newData: any = null

        let ref = _show().layouts("active").ref()[0]
        let layoutSlide = ref[slide]?.data || {}

        if (type === "image") {
            newData = { key: "background", data: null, indexes: [slide] }
        } else if (type === "overlays") {
            let ol = layoutSlide.overlays || []
            // remove clicked
            ol.splice(ol.indexOf(obj.menu.id), 1)
            newData = { key: "overlays", data: ol, dataIsArray: true, indexes: [slide] }
        } else if (type === "music") {
            let audio = layoutSlide.audio || []
            // remove clicked
            audio.splice(audio.indexOf(obj.menu.id), 1)
            newData = { key: "audio", data: audio, dataIsArray: true, indexes: [slide] }
        } else if (type === "microphone") {
            let mics = layoutSlide.mics || []
            // remove clicked
            mics.splice(
                mics.findIndex((a) => a.id === obj.menu.id),
                1
            )
            newData = { key: "mics", data: mics, dataIsArray: true, indexes: [slide] }
        } else if (type === "action") {
            let newActions: any[] = []
            indexes.forEach((i) => {
                let actions = ref[i]?.data?.actions || {}
                let slideActions = actions.slideActions || []

                let actionId = obj.menu.id
                let actionIndex = slideActions.findIndex((a) => a.id === actionId)
                if (actionIndex > -1) slideActions.splice(actionIndex, 1)

                actions.slideActions = slideActions
                newActions.push(actions)
            })
            newData = { key: "actions", data: newActions, indexes }
        }

        if (newData) history({ id: "SHOW_LAYOUT", newData })
    },

    // media
    preview: (obj: ObjData) => {
        if (!obj.sel) return

        let path: string = obj.sel.data[0].path || obj.sel.data[0].id || obj.sel.data[0]
        if (!path) return

        let type = obj.sel.id || "media"
        if (type === "media" || type === "audio") activeEdit.set({ id: path, type, items: [] })

        let name = removeExtension(getFileName(path))
        let mediaType = type === "media" ? getMediaType(getExtension(path)) : type

        let showRef: any = { id: path, type: mediaType }
        if (name) showRef.name = name
        activeShow.set(showRef)

        activePage.set("show")
        if (get(focusMode)) focusMode.set(false)
    },
    play: (obj: ObjData) => {
        if (!obj.sel?.id) return

        if (obj.sel.id === "midi") {
            sendMidi(obj.sel.data[0])
            return
        }

        if (obj.sel.id.includes("timer")) {
            let firstTimer = get(activeTimers).find((a) => a.id === obj.sel!.data[0]?.id)
            let shouldPlay = firstTimer?.paused === undefined ? true : firstTimer.paused
            obj.sel.data.forEach((data) => {
                playPauseGlobal(data.id, data, false, !shouldPlay)
            })
            return
        }

        // THIS IS NOT IN USE:

        // video
        let path = obj.sel.data[0].path || obj.sel.data[0].id
        if (!path) return

        let outputId: string = getActiveOutputs(get(outputs), false, true, true)[0]
        let currentOutput = get(outputs)[outputId] || {}
        let outputStyle = get(styles)[currentOutput.style || ""]
        let mediaStyle: MediaStyle = getMediaStyle(get(media)[path], outputStyle)
        if (!get(outLocked)) setOutput("background", { path, ...mediaStyle })
    },
    play_no_audio: (obj: ObjData) => {
        let path = obj.sel?.data[0].path || obj.sel?.data[0].id
        if (!path) return

        let outputId = getActiveOutputs(get(outputs))[0]
        let currentOutput = get(outputs)[outputId] || {}
        let currentStyle = getCurrentStyle(get(styles), currentOutput.style)

        const mediaStyle: MediaStyle = getMediaStyle(get(media)[path], currentStyle)

        if (!get(outLocked)) setOutput("background", { path, ...mediaStyle, type: getMediaType(getExtension(path)), muted: true })
    },
    play_no_filters: (obj: ObjData) => {
        let path = obj.sel?.data[0].path || obj.sel?.data[0].id
        if (!path) return
        if (!get(outLocked)) setOutput("background", { path, type: getMediaType(getExtension(path)) })
    },
    favourite: (obj: ObjData) => {
        if (!obj.sel) return

        let favourite: boolean = get(media)[obj.sel.data[0].path || obj.sel.data[0].id]?.favourite !== true
        obj.sel.data.forEach((card) => {
            let path = card.path || card.id
            media.update((a) => {
                if (!a[path]) a[path] = { filter: "" }
                if (obj.sel!.id === "audio") a[path].audio = true
                a[path].favourite = favourite
                return a
            })
        })
    },
    effects_library_add: (obj: ObjData) => {
        if (!obj.sel) return

        const path = obj.sel.data[0].path || obj.sel.data[0].id
        let existing: boolean = !!get(effectsLibrary).find((a) => a.path === path)

        effectsLibrary.update((a) => {
            obj.sel!.data.forEach((audio) => {
                let path = audio.path || audio.id

                let index = a.findIndex((a) => a.path === path)
                if (existing) {
                    if (index < 0) return
                    a.splice(index, 1)
                    return
                }

                if (index < 0) a.push({ path, name: removeExtension(getFileName(path)) })
                return
            })
            return a
        })
    },
    system_open: (obj: ObjData) => {
        if (!obj.sel) return

        let data = obj.sel.data[0]
        if (obj.sel.id === "category_media") data = get(mediaFolders)[data]
        else if (obj.sel.id === "category_audio") data = get(audioFolders)[data]

        let path = data?.path
        if (!path) return

        sendMain(Main.SYSTEM_OPEN, path)
    },

    // live
    recording: (obj: ObjData) => {
        if (get(activeRecording)) {
            stopMediaRecorder()
        } else {
            let media = JSON.parse(obj.contextElem?.getAttribute("data-media") || "{}")
            if (!media.video) {
                newToast("$toast.error_media")
                return
            }

            activeRecording.set(media)
        }
    },

    // overlays
    lock_to_output: (obj: ObjData) => {
        if (obj.sel?.id !== "overlay") return
        let setLocked: boolean = !get(overlays)[obj.sel.data[0]]?.locked

        overlays.update((a) => {
            obj.sel!.data.forEach((id: string) => {
                a[id].locked = setLocked
            })
            return a
        })
    },
    place_under_slide: (obj: ObjData) => {
        if (obj.sel?.id !== "overlay") return
        let setUnder: boolean = !get(overlays)[obj.sel.data[0]]?.placeUnderSlide

        overlays.update((a) => {
            obj.sel!.data.forEach((id: string) => {
                a[id].placeUnderSlide = setUnder
            })
            return a
        })
    },
    display_duration: () => {
        activePopup.set("display_duration")
    },

    // stage
    move_connections: (obj: ObjData) => {
        let stageId = obj.sel?.data[0]?.id
        moveStageConnection(stageId)
    },

    // drawer navigation
    changeIcon: () => activePopup.set("icon"),

    selectAll: (obj: ObjData) => selectAll(obj.sel),

    bind_slide: (obj: ObjData) => {
        let ref = _show().layouts("active").ref()[0]
        let outputId = obj.menu.id || ""

        let indexes: number[] = obj.sel?.data.map(({ index }) => index) || []
        let newBindings: string[][] = []

        let add = !ref[indexes[0]]?.data?.bindings?.includes(outputId)

        indexes.forEach((i) => {
            let bindings: string[] = ref[i]?.data?.bindings || []
            let existingIndex = bindings.indexOf(outputId)
            if (add && existingIndex < 0) bindings.push(outputId)
            else if (!add && existingIndex >= 0) bindings.splice(existingIndex, 1)

            newBindings.push(bindings)
        })

        history({ id: "SHOW_LAYOUT", newData: { key: "bindings", data: newBindings, indexes, dataIsArray: false } })
    },
    // bind item
    bind_item: (obj: ObjData) => {
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
    dynamic_values: (obj: ObjData) => {
        let id = obj.menu.id || ""

        if (obj.contextElem?.classList.contains("#meta_message")) {
            let message = _show().get("message") || {}
            let data = { ...message, text: (message.text || "") + `{${id}}` }
            let override = "show#" + get(activeShow)!.id + "_message"

            history({ id: "UPDATE", newData: { data, key: "message" }, oldData: { id: get(activeShow)!.id }, location: { page: "show", id: "show_key", override } })
            return
        }

        if (!obj.contextElem?.classList.contains("editItem")) return

        let sel = getSelectionRange()
        let lineIndex = sel.findIndex((a) => a?.start !== undefined)
        if (lineIndex < 0) lineIndex = 0

        let edit = get(activeEdit)
        let caret = { line: lineIndex || 0, pos: sel[lineIndex]?.start || 0 }

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
    find_replace: (obj: ObjData) => {
        popupData.set(obj)
        activePopup.set("find_replace")
        // format("find_replace", obj)
    },
    cut_in_half: (obj: ObjData) => {
        if (obj.sel?.id === "slide") {
            let oldLayoutRef = clone(_show().layouts("active").ref()[0])
            let previousSpiltIds: string[] = []

            // go backwards to prevent wrong index when splitted
            let selectedSlides = obj.sel.data.sort((a, b) => b.index - a.index)

            selectedSlides.forEach(({ index }) => {
                let slideRef = oldLayoutRef[index]
                if (!slideRef || previousSpiltIds.includes(slideRef.id)) return
                previousSpiltIds.push(slideRef.id)

                let slideItems: Item[] = _show().slides([slideRef.id]).get("items")[0]

                // check lines array & text array first, then text value
                let firstTextItemIndex = slideItems.findIndex((a) => getItemText(a).length && ((a.lines?.length || 0) > 1 || (a.lines?.[0]?.text?.length || 0) > 1))
                if (firstTextItemIndex < 0) firstTextItemIndex = slideItems.findIndex((a) => getItemText(a).length > 18)
                if (firstTextItemIndex < 0) return

                splitItemInTwo(slideRef, firstTextItemIndex)
            })
        } else if (!obj.sel?.id) {
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
    merge: (obj: ObjData) => {
        if (obj.sel?.id === "slide") {
            let selectedSlides = obj.sel.data // .sort((a, b) => a.index - b.index) [merge based on selected order]
            if (selectedSlides.length > 1) mergeSlides(selectedSlides)
            else if (selectedSlides[0]?.index) mergeTextboxes(selectedSlides[0].index)
        } else if (!obj.sel?.id) {
            // textbox
            mergeTextboxes()
        }
    },
    uppercase: (obj: ObjData) => format("uppercase", obj),
    lowercase: (obj: ObjData) => format("lowercase", obj),
    capitalize: (obj: ObjData) => format("capitalize", obj),
    trim: (obj: ObjData) => format("trim", obj),

    // settings
    reset_theme: (obj: ObjData) => {
        obj.sel?.data.forEach(({ id }) => {
            let oldTheme = get(themes)[id]
            let defaultTheme = defaultThemes[id] || defaultThemes.default
            let data = { ...defaultTheme, default: oldTheme.default || false, name: oldTheme.name }

            history({ id: "UPDATE", newData: { data }, oldData: { id }, location: { page: "settings", id: "settings_theme" } })
            updateThemeValues(get(themes)[id])
        })
    },
    reset: (obj: ObjData) => {
        if (obj.sel?.id === "style") {
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

        if (obj.sel?.id === "output") {
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

function changeSlideAction(obj: ObjData, id: string) {
    let layoutSlide: number = obj.sel?.data[0]?.index || 0
    let ref = _show().layouts("active").ref()[0]
    if (!ref[layoutSlide]) return

    // ONLY ONE

    if (id === "slide_shortcut") {
        let data = { index: layoutSlide, mode: "slide_shortcut" }

        popupData.set(data)
        activePopup.set("assign_shortcut")
        return
    }

    let actions = clone(ref[layoutSlide].data?.actions) || {}

    if (id === "receiveMidi") {
        let midiId: string = uid()

        if (actions[id]) midiId = actions[id]!
        else actions[id] = midiId

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [layoutSlide] } })

        let data = { id: midiId, index: layoutSlide, mode: "slide_midi" }

        popupData.set(data)
        activePopup.set("action")

        return
    }

    // MULTIPLE

    let indexes: number[] = obj.sel?.data.map(({ index }) => index) || []

    if (id === "action") {
        let id = uid()
        let existing: any[] = []
        let actions = clone(
            indexes
                .map((i) => {
                    let a = ref[i]?.data?.actions || {}
                    if (!a.slideActions) a.slideActions = []
                    a.slideActions.push({ id, triggers: [] })

                    existing.push(...a.slideActions.map((a) => a.triggers?.[0]))
                    return a
                })
                .filter(Boolean) || []
        )

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes } })

        popupData.set({ id, mode: "slide", indexes, existing })
        activePopup.set("action")

        return
    }

    if (id === "animate") {
        if (!actions[id]) {
            actions[id] = { actions: [{ type: "change", duration: 3, id: "text", key: "font-size", extension: "px" }] }
            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes }, location: { page: "show", override: "animate_slide" } })
        }

        let data = { data: actions[id], indexes }

        popupData.set(data)
        activePopup.set("animate")

        return
    }

    if (id === "nextTimer") {
        let nextTimer = clone(ref[layoutSlide]?.data?.nextTimer) || 0

        history({ id: "SHOW_LAYOUT", newData: { key: "nextTimer", data: nextTimer, indexes }, location: { page: "show", override: "change_style_slide" } })

        let data = { value: nextTimer, indexes }

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
        let actions = ref[index]?.data?.actions || {}
        actions[id] = !actions[id]
        actionsList.push(actions)
    })

    history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actionsList, indexes } })
}

export function removeGroup(data: any[]) {
    let ref = _show().layouts("active").ref()[0]
    let firstSlideId = ref[0].id

    let removeSlideIds: string[] = []
    data.forEach((slideRef) => {
        if (!slideRef.index) return
        let refSlide = ref.find((a) => a.layoutIndex === slideRef.index)
        if (!refSlide || refSlide?.type === "child" || refSlide?.id === firstSlideId) return

        removeSlideIds.push(refSlide.id)
    })
    removeSlideIds = removeDuplicates(removeSlideIds)
    if (!removeSlideIds.length) return

    let newParentIds: { [key: string]: string } = {}

    // remove from layout
    let activeLayout = _show().get("settings.activeLayout")
    let layout: SlideData[] = clone(_show().layouts([activeLayout]).get("slides")[0])
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

        let childData: any = layoutRef
        delete childData.id
        newLayoutSlides[currentIndex].children[id] = childData
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

export function removeSlide(data: any[], type: "delete" | "remove" = "delete") {
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

export function format(id: string, obj: ObjData, data: any = null) {
    let slideIds: string[] = []

    let editing = get(activeEdit)
    let items = editing.items || []

    // WIP let slide = getEditSlide()

    if (editing.id) {
        let currentItems: Item[] = []
        if (editing.type === "overlay") currentItems = get(overlays)[editing.id]?.items || []
        if (editing.type === "template") currentItems = get(templates)[editing.id]?.items || []

        let newItems: Item[] = []
        currentItems.forEach((item) => {
            item.lines?.forEach((line, j: number) => {
                line.text?.forEach((text, k: number) => {
                    if (item.lines?.[j]?.text?.[k]) item.lines[j].text[k].value = formatting[id](text.value, data)
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

    let ref = _show().layouts("active").ref()[0]
    if (obj.sel?.id?.includes("slide")) {
        slideIds = obj.sel.data.map((a) => ref[a.index].id)
    } else {
        slideIds = [
            _show()
                .slides([ref[get(activeEdit).slide!]?.id])
                .get()[0]?.id,
        ]
    }

    slideIds.forEach((slide) => {
        let slideItems: Item[] = _show().slides([slide]).items(get(activeEdit).items).get()[0]
        let newData: any = { style: { values: [] } }

        let newItems: Item[] = []
        slideItems.forEach((item) => {
            item.lines?.forEach((line, j: number) => {
                line.text?.forEach((text, k: number) => {
                    if (item.lines?.[j]?.text?.[k]) item.lines[j].text[k].value = formatting[id](text.value, data)
                })
            })
            newItems.push(item)
        })
        newData.style.values = newItems

        history({ id: "setItems", newData, location: { page: get(activePage) as any, show: get(activeShow)!, items, slide } })
    })

    refreshEditSlide.set(true)
}

const formatting = {
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

function sort(obj: ObjData, id: string) {
    let type = obj.menu.id

    sorted.update((a) => {
        if (!a[id]) a[id] = {}
        a[id].type = type
        return a
    })

    if (id === "shows") updateShowsList(get(shows))
}
