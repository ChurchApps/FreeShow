import { get } from "svelte/store"
import { uid } from "uid"
import { EXPORT, OUTPUT } from "../../../types/Channels"
import type { HistoryPages } from "../../../types/History"
import { Main } from "../../../types/IPC/Main"
import type { MediaStyle, Selected, SelectIds } from "../../../types/Main"
import type { Item, LayoutRef, Slide, SlideData } from "../../../types/Show"
import { ShowObj } from "../../classes/Show"
import { sendMain } from "../../IPC/main"
import { cameraManager } from "../../media/cameraManager"
import { changeSlideGroups, mergeSlides, mergeTextboxes, splitItemInTwo } from "../../show/slides"
import {
    $,
    actions,
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
    activeStage,
    activeTagFilter,
    activeTimers,
    activeVariableTagFilter,
    audioFolders,
    categories,
    colorbars,
    currentOutputSettings,
    currentWindow,
    dataPath,
    drawer,
    drawerTabsData,
    effects,
    effectsLibrary,
    eventEdit,
    events,
    focusMode,
    forceClock,
    guideActive,
    livePrepare,
    media,
    mediaFolders,
    outLocked,
    outputs,
    overlayCategories,
    overlays,
    popupData,
    previousShow,
    profiles,
    projects,
    projectTemplates,
    projectView,
    quickSearchActive,
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
    textEditActive,
    themes,
    toggleOutputEnabled,
    variables
} from "../../stores"
import { hideDisplay, newToast, triggerFunction, wait } from "../../utils/common"
import { translateText } from "../../utils/language"
import { confirmCustom } from "../../utils/popup"
import { send } from "../../utils/request"
import { initializeClosing, save } from "../../utils/save"
import { closeContextMenu } from "../../utils/shortcuts"
import { updateThemeValues } from "../../utils/updateSettings"
import { getActionTriggerId } from "../actions/actions"
import { moveStageConnection } from "../actions/apiHelper"
import { createScriptureShow } from "../drawer/bible/scripture"
import { stopMediaRecorder } from "../drawer/live/recorder"
import { playPauseGlobal } from "../drawer/timers/timers"
import { addChords } from "../edit/scripts/chords"
import { rearrangeItems, rearrangeStageItems } from "../edit/scripts/itemHelpers"
import { getItemText, getSelectionRange } from "../edit/scripts/textStyle"
import { exportProject } from "../export/project"
import { clone, removeDuplicates, sortObjectNumbers } from "../helpers/array"
import { copy, cut, deleteAction, duplicate, paste, selectAll } from "../helpers/clipboard"
import { history, redo, undo } from "../helpers/history"
import { getExtension, getFileName, getMediaStyle, getMediaType, removeExtension, splitPath } from "../helpers/media"
import { defaultOutput, getActiveOutputs, getCurrentStyle, setOutput, toggleOutput, toggleOutputs } from "../helpers/output"
import { select } from "../helpers/select"
import { checkName, formatToFileName, getLayoutRef, removeTemplatesFromShow, updateShowsList } from "../helpers/show"
import { sendMidi } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import { clearSlide } from "../output/clear"
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

export function menuClick(id: string, enabled = true, menu: ContextMenuItem | null = null, contextElem: HTMLElement | null = null, actionItem: HTMLElement | null = null, sel: Selected | null = null) {
    if (!clickActions[id]) return console.error("MISSING CONTEXT: ", id)

    if (sel?.id) sel.id = sel.id.split("___")[0] as SelectIds // different selection ID, same action (currently used to seperate scripture navigation buttons)

    const obj = { sel, actionItem, enabled, contextElem, menu }
    console.info("MENU CLICK: " + id, obj)

    clickActions[id](obj)
}

const clickActions = {
    // file
    save: () => save(),
    import_more: () => activePopup.set("import"),
    export_more: () => activePopup.set("export"),
    settings: () => {
        if (get(activePage) === "stage") settingsTab.set("connection")
        else if (get(activePage) === "settings") settingsTab.set("general")
        activePage.set("settings")
    },
    quit: () => initializeClosing(),
    // view
    focus_mode: () => {
        const project = get(projects)[get(activeProject) || ""]
        if (!project?.shows?.length) {
            newToast("empty.project_select")
            return
        }

        previousShow.set(null)
        activeShow.set(null)
        showRecentlyUsedProjects.set(false)

        // close drawer
        const minDrawerHeight = 40
        const drawerIsOpened = get(drawer).height > minDrawerHeight
        if (drawerIsOpened) drawer.set({ height: minDrawerHeight, stored: get(drawer).height })

        const firstItem = project.shows[0]
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
    quick_search: () => quickSearchActive.set(true),
    quick_start_guide: () => guideActive.set(true),

    // main
    custom_text: () => activePopup.set("custom_text"),
    rename: (obj: ObjData) => {
        const id = obj.sel?.id || obj.contextElem?.id
        if (!id) return
        const data = obj.sel?.data?.[0] || {}

        const renameById = ["show_drawer", "project", "folder", "stage", "theme", "style", "output", "tag", "profile"]
        const renameByIdDirect = ["overlay", "template", "player", "layout", "effect"]

        if (renameById.includes(id)) activeRename.set(id + "_" + data.id)
        else if (renameByIdDirect.includes(id)) activeRename.set(id + "_" + data)
        else if (id === "slide" || id === "group" || id === "audio_effect") activePopup.set("rename")
        else if (obj.contextElem?.classList.contains("#bible_book_local")) {
            selected.set({ id: "bible_book", data: [{ index: Number(obj.contextElem?.id) }] })
            activePopup.set("rename")
        } else if (id === "show") activeRename.set("show_" + data.id + "#" + data.index)
        else if (obj.contextElem?.classList?.contains("#project_template")) activeRename.set("project_" + id)
        else if (obj.contextElem?.classList?.contains("#video_subtitle")) activeRename.set("subtitle_" + id)
        else if (obj.contextElem?.classList?.contains("#video_marker")) activeRename.set("marker_" + id)
        else if (id?.includes("category")) activeRename.set("category_" + get(activeDrawerTab) + "_" + data)
        else console.error("Missing rename", obj)
    },
    sort_shows: (obj: ObjData) => sort(obj, "shows"),
    sort_projects: (obj: ObjData) => sort(obj, "projects"),
    sort_media: (obj: ObjData) => sort(obj, "media"),
    remove: (obj: ObjData) => {
        if (obj.sel && deleteAction(obj.sel)) return

        if (obj.contextElem?.classList.contains("#slide_recorder_item")) {
            const index = obj.contextElem.id.slice(1)
            const activeLayout = _show().get("settings.activeLayout")
            const layout = clone(_show().get("layouts")[activeLayout] || {})
            layout.recording?.[0].sequence.splice(index, 1)

            history({ id: "UPDATE", newData: { key: "layouts", subkey: activeLayout, data: layout }, oldData: { id: get(activeShow)!.id }, location: { page: "show", id: "show_layout" } })
            return
        }

        const id = obj.sel?.id
        if (id === "audio_effect") {
            effectsLibrary.update((a) => {
                obj.sel?.data.forEach((audio) => {
                    const path = audio.path || audio.id
                    const index = a.findIndex((effect) => effect.path === path)
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
        // "slide" || "group" || "overlay" || "template" || "output" || "effect"
        activePopup.set("color")
    },
    // not currently in use:
    remove_group: (obj: ObjData) => removeGroup(obj.sel?.data || []),
    remove_slide: (obj: ObjData) => {
        removeSlide(obj.sel?.data || [], "remove")
        if (get(activePage) === "edit") refreshEditSlide.set(true)
    },
    delete_slide: (obj: ObjData) => clickActions.delete(obj),
    delete_group: (obj: ObjData) => clickActions.delete(obj),
    delete: (obj: ObjData) => {
        // delete shows from project
        if (obj.sel?.id === "show") {
            // wait to delete until after they are removed from project
            setTimeout(() => {
                const sel: Selected = { ...obj.sel!, id: "show_drawer" }
                selected.set(sel)
                clickActions.delete({ ...obj, sel })
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
        if (obj.contextElem?.classList.value.includes("#event")) {
            deleteAction({ id: "event", data: { id: obj.contextElem.id } })
            return
        }

        // THIS MUST BE LAST (otherwise deleteing e.g. an event while the editbox is selected will delete that instead)
        // delete slide item using context menu, or menubar action
        if (obj.contextElem?.classList.value.includes("#edit_box") || (!obj.sel?.id && get(activeEdit).slide !== undefined && get(activeEdit).items.length)) {
            deleteAction({ id: "item", data: { slide: get(activeEdit).slide } })
            return
        }
        if (obj.contextElem?.classList.value.includes("stage_item")) {
            deleteAction({ id: "stage_item", data: { id: get(activeStage).id } })
            return
        }

        console.error("COULD NOT DELETE", obj)
    },
    delete_remove: (obj: ObjData) => clickActions.delete(obj),
    delete_all: (obj: ObjData) => {
        if (obj.contextElem?.classList.value.includes("#event")) {
            const group = get(events)[obj.contextElem.id].group
            if (!group) return

            const eventIds: string[] = []
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

        if (obj.contextElem?.classList.value.includes("stage_item")) {
            duplicate({ id: "stage_item", data: get(activeStage) })
            return
        }
    },

    // drawer
    enabled_drawer_tabs: (obj: ObjData) => {
        const m = { hide: false, enabled: !obj.enabled }
        drawerTabsData.update((a) => {
            if (!a[obj.menu.id!]) a[obj.menu.id!] = { enabled: false, activeSubTab: null }
            a[obj.menu.id!].enabled = !obj.enabled
            return a
        })
        return m
    },

    // TAGS
    manage_show_tags: () => {
        closeContextMenu()
        popupData.set({ type: "show" })
        activePopup.set("manage_tags")
    },
    tag_set: (obj: ObjData) => {
        const tagId = obj.menu.id
        if (tagId === "create") {
            clickActions.manage_show_tags()
            return
        }

        const disable = get(shows)[obj.sel?.data?.[0].id]?.quickAccess?.tags?.includes(tagId)

        obj.sel?.data?.forEach(({ id }) => {
            // WIP similar to Tag.svelte - toggleTag()
            const quickAccess = get(shows)[id]?.quickAccess || {}

            const tags = quickAccess.tags || []
            const existingIndex = tags.indexOf(tagId)
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
        const tagId = obj.menu.id || ""

        const activeTags = get(activeTagFilter)
        const currentIndex = activeTags.indexOf(tagId)
        if (currentIndex < 0) activeTags.push(tagId)
        else activeTags.splice(currentIndex, 1)

        activeTagFilter.set(activeTags || [])
    },
    manage_media_tags: () => {
        closeContextMenu()
        popupData.set({ type: "media" })
        activePopup.set("manage_tags")
    },
    media_tag_set: (obj: ObjData) => {
        const tagId = obj.menu.id || ""
        if (tagId === "create") {
            clickActions.manage_media_tags()
            return
        }

        const disable = get(media)[get(selected).data[0]?.path]?.tags?.includes(tagId)

        obj.sel?.data?.forEach(({ path }) => {
            const tags = get(media)[path]?.tags || []

            const existingIndex = tags.indexOf(tagId)
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
        const tagId = obj.menu.id || ""

        const activeTags = get(activeMediaTagFilter)
        const currentIndex = activeTags.indexOf(tagId)
        if (currentIndex < 0) activeTags.push(tagId)
        else activeTags.splice(currentIndex, 1)

        activeMediaTagFilter.set(activeTags || [])
    },
    manage_action_tags: () => {
        closeContextMenu()
        popupData.set({ type: "action" })
        activePopup.set("manage_tags")
    },
    action_tag_set: (obj: ObjData) => {
        const tagId = obj.menu.id || ""
        if (tagId === "create") {
            clickActions.manage_action_tags()
            return
        }

        const disable = get(actions)[get(selected).data[0]?.id]?.tags?.includes(tagId)

        obj.sel?.data?.forEach(({ id }) => {
            const tags = get(actions)[id]?.tags || []

            const existingIndex = tags.indexOf(tagId)
            if (disable) {
                if (existingIndex > -1) tags.splice(existingIndex, 1)
            } else {
                if (existingIndex < 0) tags.push(tagId)
            }

            actions.update((a) => {
                if (a[id]) a[id].tags = tags
                return a
            })
        })
    },
    manage_variable_tags: () => {
        closeContextMenu()
        popupData.set({ type: "variable" })
        activePopup.set("manage_tags")
    },
    action_tag_filter: (obj: ObjData) => {
        const tagId = obj.menu.id || ""

        const activeTags = get(activeActionTagFilter)
        const currentIndex = activeTags.indexOf(tagId)
        if (currentIndex < 0) activeTags.push(tagId)
        else activeTags.splice(currentIndex, 1)

        activeActionTagFilter.set(activeTags || [])
    },
    variable_tag_set: (obj: ObjData) => {
        const tagId = obj.menu.id || ""
        if (tagId === "create") {
            clickActions.manage_variable_tags()
            return
        }

        const disable = get(variables)[get(selected).data[0]?.id]?.tags?.includes(tagId)

        obj.sel?.data?.forEach(({ id }) => {
            const tags = get(variables)[id]?.tags || []

            const existingIndex = tags.indexOf(tagId)
            if (disable) {
                if (existingIndex > -1) tags.splice(existingIndex, 1)
            } else {
                if (existingIndex < 0) tags.push(tagId)
            }

            variables.update((a) => {
                if (a[id]) a[id].tags = tags
                return a
            })
        })
    },
    variable_tag_filter: (obj: ObjData) => {
        const tagId = obj.menu.id || ""

        const activeTags = get(activeVariableTagFilter)
        const currentIndex = activeTags.indexOf(tagId)
        if (currentIndex < 0) activeTags.push(tagId)
        else activeTags.splice(currentIndex, 1)

        activeVariableTagFilter.set(activeTags || [])
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
                type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length))
            }))

        projects.update((a) => {
            if (!a[get(activeProject)!]?.shows) return a

            a[get(activeProject)!].shows.push(...obj.sel!.data)
            return a
        })
    },
    addToShow: (obj: ObjData) => {
        // WIP replaced by convertToShow
        let data = obj.sel?.data || []

        const slides = data.map((a) => ({ id: a.id || uid(), group: removeExtension(a.name || a.path || ""), color: null, settings: {}, notes: "", items: [] }))

        let videoData: any = {}
        // videos are probably not meant to be background if they are added in bulk
        if (data.length > 1) videoData = { muted: false, loop: false }

        data = data.map((a) => ({ ...a, path: a.path || a.id, ...(a.type === "video" ? videoData : {}) }))
        const activeLayout = get(showsCache)[get(activeShow)!.id]?.settings?.activeLayout
        const layoutLength = _show().layouts([activeLayout]).get()[0]?.length
        const newData = { index: layoutLength, data: slides, layout: { backgrounds: data } }

        history({ id: "SLIDES", newData, location: { page: get(activePage) as HistoryPages, show: get(activeShow)!, layout: activeLayout } })
    },
    createSlideshow: (obj: ObjData) => {
        const data = obj.sel?.data || []
        const slides = data.map((a) => ({ group: removeExtension(a.name || a.path || ""), color: null, settings: {}, notes: "", items: [] }))

        const layoutId = uid()
        const show = new ShowObj(false, "presentation", layoutId, Date.now(), false)
        const folderName = splitPath(data[0]?.path).at(-2) || ""
        show.name = checkName(translateText("create_show.slideshow") + (folderName ? `" "${folderName}` : ""))

        const videoData = { muted: false, loop: false }
        const duration = 6

        const layoutSlides: SlideData[] = []
        slides.forEach((slide, i) => {
            const slideId = uid()
            show.slides[slideId] = slide

            const mediaId = uid(5)
            const mediaData = data[i]
            show.media[mediaId] = { ...mediaData, path: mediaData.path || mediaData.id, ...(mediaData.type === "video" ? videoData : {}) }

            const layoutData: SlideData = { id: slideId, background: mediaId }
            if (mediaData.type === "video") {
                layoutData.actions = { nextAfterMedia: true }
            } else if (mediaData.type === "image") {
                layoutData.nextTimer = duration
                layoutData.actions = { animate: { actions: [{ type: "change", duration: duration + 2, id: "background", key: "zoom" }] } }
            }
            if (i === slides.length - 1) layoutData.end = true

            layoutSlides.push(layoutData)
        })

        show.layouts[layoutId].slides = layoutSlides

        history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } })
    },
    lock_show: (obj: ObjData) => {
        if (!obj.sel) return
        const shouldBeLocked = !get(shows)[obj.sel.data[0]?.id]?.locked

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
        const id = obj.sel?.data[0]
        if (!id) return

        popupData.set({ id })
        activePopup.set("category_action")
    },
    category_template: (obj: ObjData) => {
        const id = obj.sel?.data[0]
        if (!id) return

        const selectedTemplate = get(categories)[id]?.template

        popupData.set({ active: selectedTemplate, allowEmpty: true, trigger: (value) => setCategoryTemplate(value) })
        activePopup.set("select_template")

        function setCategoryTemplate(templateId: string) {
            categories.update(a => {
                a[id].template = templateId
                return a
            })
        }
    },
    use_as_archive: (obj: ObjData) => {
        const categoryStores = {
            category_shows: () => categories.update(toggleArchive),
            category_overlays: () => overlayCategories.update(toggleArchive),
            category_templates: () => templateCategories.update(toggleArchive)
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
    archive: (obj: ObjData) => {
        obj.sel?.data?.forEach(({ id }) => {
            const project = get(projects)[id]
            if (!project) return

            history({ id: "UPDATE", newData: { key: "archived", data: !project.archived }, oldData: { id }, location: { page: "show", id: "project_key" } })
        })
    },
    toggle_clock: () => {
        forceClock.set(!get(forceClock))
    },

    // output
    force_output: () => toggleOutputs(null, { force: true }),
    align_with_screen: () => send(OUTPUT, ["ALIGN_WITH_SCREEN"]),
    choose_screen: () => {
        popupData.set({ activateOutput: true })
        activePopup.set("choose_screen")
    },
    toggle_output: (obj: ObjData) => {
        const id = obj.contextElem?.id || ""
        toggleOutput(id)
    },
    move_to_front: (obj: ObjData) => {
        send(OUTPUT, ["TO_FRONT"], obj.contextElem?.id)
    },
    hide_from_preview: (obj: ObjData) => {
        const outputId = obj.contextElem?.id || ""
        toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
        setTimeout(() => {
            outputs.update((output) => {
                // should match the outputs list in MultiOutputs.svelte
                const showingOutputsList = Object.values(output).filter((a) => a.enabled && !a.hideFromPreview)
                const newValue = !output[outputId].hideFromPreview

                if (newValue && showingOutputsList.length <= 1) newToast("toast.one_output")
                else output[outputId].hideFromPreview = !output[outputId].hideFromPreview

                return output
            })
        }, 100)
    },
    test_pattern: (obj: ObjData) => {
        const id = obj.contextElem?.id || ""
        const testPattern = get(colorbars)
        if (testPattern[id]) delete testPattern[id]
        else testPattern[id] = "colorbars.png"
        colorbars.set(testPattern)
    },
    live_prepare: (obj: ObjData) => {
        const id = obj.contextElem?.id || ""
        const prepare = get(livePrepare)
        if (prepare[id]) delete prepare[id]
        else prepare[id] = true
        livePrepare.set(prepare)
    },

    // new
    newShowPopup: () => activePopup.set("show"),

    newShow: () => history({ id: "UPDATE", newData: { remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } }),
    newPrivateShow: () => history({ id: "UPDATE", newData: { replace: { private: true }, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } }),
    newProject: (obj: ObjData) => {
        let parent: string = obj.sel?.data[0]?.id || obj.contextElem?.id || "/"
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
            sendMain(Main.OPEN_FOLDER, { channel: "MEDIA", title: translateText("new.folder") })
            return
        }

        if (obj.contextElem?.classList.contains("#category_audio") || obj.sel?.id === "category_audio") {
            sendMain(Main.OPEN_FOLDER, { channel: "AUDIO", title: translateText("new.folder") })
            return
        }
    },
    newSlide: () => {
        history({ id: "SLIDES" })
    },
    newCategory: (obj: ObjData) => {
        const classList = obj.contextElem?.classList?.value || ""
        const index = classList.indexOf("#category")
        let id = classList.slice(index + 1, classList.indexOf(" ", index))
        id = id.split("__")[1] || id
        history({ id: "UPDATE", location: { page: "drawer", id } })
    },
    newScripture: () => activePopup.set("import_scripture"),

    createCollection: () => {
        activePopup.set("create_collection")
    },
    create_show: (obj: ObjData) => {
        if (obj.contextElem?.classList.contains("#media_preview")) {
            const path = obj.contextElem.id
            const name = removeExtension(getFileName(path))
            const mediaType = getMediaType(getExtension(path))

            const layoutId = uid()
            const show = new ShowObj(false, "presentation", layoutId, Date.now(), false)
            show.name = checkName(name)

            const slideId = uid()
            show.slides[slideId] = { group: name, color: null, settings: {}, notes: "", items: [] }

            const mediaId = uid(5)
            show.media[mediaId] = { path, name, ...(mediaType === "video" ? { muted: false, loop: false } : {}) }

            const layoutSlides: SlideData[] = [{ id: slideId, background: mediaId }]
            show.layouts[layoutId].slides = layoutSlides

            history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } })
        } else if (obj.contextElem?.classList.contains("chapters")) {
            triggerFunction("scripture_selectAll")
            setTimeout(createScriptureShow)
        } else if (obj.sel?.id === "scripture") {
            createScriptureShow()
        }
    },

    // project
    export: (obj: ObjData) => {
        if (obj.sel?.id === "template") {
            const id = obj.sel.data[0]
            const template = get(templates)[id]
            if (!template) return

            const files: string[] = []
            template.items.forEach((item) => {
                if (item.type === "media") getFile(item.src)
            })
            getFile(template.settings?.backgroundPath)

            send(EXPORT, ["TEMPLATE"], { path: get(dataPath), name: formatToFileName(template.name), file: { template: { id, ...template }, files } })

            function getFile(path: string | undefined) {
                if (!path) return
                files.push(path)
            }

            return
        }

        if (obj.sel?.id === "theme") {
            const theme = get(themes)[obj.sel.data[0]?.id]
            if (!theme) return
            send(EXPORT, ["THEME"], { path: get(dataPath), content: theme })

            return
        }

        if (obj.contextElem?.classList.value.includes("project")) {
            if (obj.sel?.id !== "project" && !get(activeProject)) return
            const projectId: string = obj.sel?.data[0]?.id || get(activeProject)
            exportProject(get(projects)[projectId], projectId)

            return
        }
    },
    import: (obj: ObjData) => {
        if (obj.contextElem?.classList.value.includes("#projectsTab")) {
            const extensions = ["project", "shows", "json", "zip"]
            const name = translateText("formats.project")
            sendMain(Main.IMPORT, { channel: "freeshow_project", format: { extensions, name }, settings: { path: get(dataPath) } })
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
    unlink_pco: (obj: ObjData) => {
        if (!obj.sel) return

        showsCache.update((a) => {
            obj.sel!.data.forEach((b) => {
                if (!a[b.id]) return
                delete a[b.id].quickAccess.pcoLink
            })
            return a
        })
        shows.update((a) => {
            obj.sel!.data.forEach((b) => {
                delete a[b.id].quickAccess.pcoLink
            })
            return a
        })
    },
    section: (obj) => {
        const index: number = obj.sel.data[0] ? obj.sel.data[0].index + 1 : get(projects)[get(activeProject)!]?.shows?.length || 0
        history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: get(activeProject) }, location: { page: "show", id: "section" } })
    },
    mark_played: (obj: ObjData) => {
        const projectId = get(activeProject)
        const indexes = (obj.sel?.data || []).map(item => Number(item.index))
        if (!projectId || !indexes.length) return

        projects.update((a) => {
            if (!a[projectId]?.shows) return a

            const newState = !a[projectId].shows[indexes[0]]?.played

            indexes.forEach(index => {
                if (!a[projectId].shows[index]) return
                a[projectId].shows[index].played = newState
            })

            return a
        })
    },
    copy_to_template: (obj: ObjData) => {
        let project = clone(get(projects)[obj.sel?.data?.[0]?.id])
        if (!project) return

        project = { name: project.name, parent: "/", shows: project.shows, created: 0 }

        let id = uid()

        // find existing with the same name
        const existingId = Object.entries(get(projectTemplates)).find(([_id, a]) => a.name === project.name)?.[0] || ""
        if (existingId) id = existingId
        else activeRename.set("project_" + id)

        history({ id: "UPDATE", newData: { data: project }, oldData: { id }, location: { page: "show", id: "project_template" } })
    },

    // slide views
    view_grid: () => {
        slidesOptions.set({ ...get(slidesOptions), mode: "grid" })
    },
    view_simple: () => {
        slidesOptions.set({ ...get(slidesOptions), mode: "simple" })
    },
    view_groups: () => {
        slidesOptions.set({ ...get(slidesOptions), mode: "groups" })
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
                    const ref = getLayoutRef()?.[b.index] || {}
                    const slides = a[get(activeShow)!.id].layouts?.[a[get(activeShow)!.id]?.settings?.activeLayout]?.slides
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
                const value = !a[obj.sel!.data[0].id].disabled
                obj.sel!.data.forEach((b) => {
                    a[b.id].disabled = value
                })
                return a
            })
            return
        }

        if (obj.sel?.id === "action") {
            const enabledState = get(actions)[obj.sel.data[0].id].enabled
            const value = enabledState === undefined ? false : !enabledState
            actions.update((a) => {
                obj.sel!.data.forEach((b) => {
                    const action = a[b.id]
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
            const slide = obj.sel.data[0]
            activeEdit.set({ slide: slide.index, items: [], showId: slide.showId })
            activePage.set("edit")
            setTimeout(() => selected.set({ id: null, data: [] }))
        }
    },

    edit: (obj: ObjData) => {
        if (!obj.sel) return

        if (obj.sel.id === "slide") {
            const slide = obj.sel.data[0]
            activeEdit.set({ slide: slide.index, items: [], showId: slide.showId || get(activeShow)?.id })
            activePage.set("edit")
            setTimeout(() => selected.set({ id: null, data: [] }))
        } else if (obj.sel.id === "media") {
            const path = obj.sel.data[0].path
            activeEdit.set({ type: "media", id: path, items: [] })
            activePage.set("edit")
            if (!get(activeShow) || (get(activeShow)!.type || "show") !== "show") activeShow.set({ id: path, type: getMediaType(getExtension(path)) })
        } else if (obj.sel.id === "camera") {
            const data = obj.sel.data[0]
            activeEdit.set({ type: "camera", id: data.id, data, items: [] })
            activePage.set("edit")
        } else if (obj.sel.id === "player") {
            const id = obj.sel.data[0]
            const onlineTab = get(drawerTabsData).media?.openedSubSubTab?.online || "youtube"
            popupData.set({ active: onlineTab, id })
            activePopup.set("player")
        } else if (obj.sel.id === "audio") {
            const path = obj.sel.data[0].path
            activeEdit.set({ type: "audio", id: path, items: [] })
            activePage.set("edit")
            if (!get(activeShow) || (get(activeShow)!.type || "show") !== "show") activeShow.set({ id: path, type: "audio" })
        } else if (obj.sel.id === "show_drawer") {
            const showId = obj.sel.data[0].id
            activeShow.set({ type: "show", id: showId })
            activeEdit.set({ type: "show", slide: 0, items: [], showId })
            if (get(activePage) === "edit") refreshEditSlide.set(true)
            activePage.set("edit")
        } else if (["overlay", "template", "effect"].includes(obj.sel.id || "")) {
            if (get(activePage) === "edit") refreshEditSlide.set(true)
            activePage.set("edit")

            // properly set content when edit set to same type as preview, but different id
            // e.g. overlay opened in preview, then edited, then trying to edit another overlay will reset to preview without timeout
            setTimeout(() => activeEdit.set({ type: obj.sel!.id as any, id: obj.sel!.data[0], items: [] }))
        } else if (obj.sel.id === "action") {
            const firstActionId = obj.sel.data[0]?.id
            const action = get(actions)[firstActionId]

            popupData.set({ id: firstActionId })

            // slide midi
            if (action.shows?.length) {
                activePopup.set("slide_midi")
                return
            }

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
        } else if (obj.contextElem?.classList.value.includes("#edit_custom_action")) {
            activePopup.set("custom_action")
        }
    },
    manage_groups: () => {
        // settingsTab.set("general")
        // activePage.set("settings")
        activePopup.set("manage_groups")
    },
    manage_metadata: () => {
        activePopup.set("manage_metadata")
    },

    // chords
    chord_list: (obj: ObjData) => clickActions.keys(obj),
    keys: (obj: ObjData) => {
        if (get(selected).id !== "chord") return
        const data = get(selected).data[0]

        const item: Item = _show().slides([data.slideId]).items([data.itemIndex]).get()[0][0]
        if (!item) return

        const newLines = clone(item.lines)
        if (!newLines?.[data.index].chords) return

        if (data.chord) {
            const currentChordIndex = newLines[data.index].chords!.findIndex((a) => a.id === data.chord.id)
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

        const data = obj.sel.data[0]
        selected.set(obj.sel)

        if (!data.chord) {
            // create chord
            const item = _show().slides([data.slideId]).items([data.itemIndex]).get()[0][0]
            addChords(item, { showId: get(activeShow)!.id, id: data.slideId }, data.itemIndex)
        }

        activePopup.set("rename")
    },

    // change slide group
    slide_groups: (obj: ObjData) => changeSlideGroups({ sel: { data: obj.sel?.data || [] }, menu: { id: obj.menu.id! } }),

    actions: (obj: ObjData) => changeSlideAction(obj, obj.menu.id || ""),
    transition: () => {
        // item transition
        popupData.set({ action: "transition" })
        activePopup.set("transition")
    },
    item_actions: (obj: ObjData) => {
        const action = obj.menu.id || ""

        // if (action === "transition") {
        //     popupData.set({ action })
        //     activePopup.set("transition")
        if (action.includes("Timer")) {
            popupData.set({ action })
            activePopup.set("set_time")
        } else {
            const id = obj.menu?.id || ""
            const items = get(activeEdit).items

            if (get(activeEdit).id) {
                const slideItems = get($[(get(activeEdit).type || "") + "s"])?.[get(activeEdit).id!]?.items
                const toggleState = !slideItems[items[0]][id]

                history({
                    id: "UPDATE",
                    oldData: { id: get(activeEdit).id },
                    newData: { key: "items", subkey: id, data: toggleState, indexes: items },
                    location: { page: "edit", id: get(activeEdit).type + "_items", override: true }
                })

                return
            }

            const slideIndex = get(activeEdit).slide || 0
            const ref = getLayoutRef()
            const slideRef = ref[slideIndex]

            const currentItems = _show().slides([slideRef.id]).items().get()[0]
            if (!currentItems?.[items[0]]) return

            const newState = !currentItems[items[0]][id]

            // not made for booleans:
            // history({
            //     id: "setItems",
            //     newData: { style: { key: id, values: [newState] } },
            //     location: { page: "edit", show: get(activeShow)!, slide: slideRef.id, items, override: "itemaction_" + slideRef.id + "_items_" + items.join(",") }
            // })
            showsCache.update((a) => {
                items.forEach((itemIndex) => {
                    a[get(activeShow)!.id].slides[slideRef.id].items[itemIndex][id] = newState
                })
                return a
            })
        }
    },
    template_actions: (obj: ObjData) => {
        const templateId = obj.sel?.data[0]
        const template = get(templates)[templateId]
        if (!template) return

        const existingActions = template.settings?.actions || []

        popupData.set({ mode: "template", templateId, existing: existingActions.map((a) => a.triggers?.[0]) })
        activePopup.set("action")
    },
    remove_layers: (obj: ObjData) => {
        if (!obj.sel || !obj.menu.id) return

        const type: null | "image" | "overlays" | "music" | "microphone" | "action" = obj.menu.type || (obj.menu.icon as any) || null
        const slide: number = obj.sel.data[0].index
        const indexes: number[] = obj.sel.data.map(({ index }) => index)
        let newData: any = null

        const ref = getLayoutRef()
        const layoutSlide = ref[slide]?.data || {}

        if (type === "image") {
            newData = { key: "background", data: null, indexes: [slide] }
        } else if (type === "overlays") {
            const ol = layoutSlide.overlays || []
            // remove clicked
            ol.splice(ol.indexOf(obj.menu.id), 1)
            newData = { key: "overlays", data: ol, dataIsArray: true, indexes: [slide] }
        } else if (type === "music") {
            const audio = layoutSlide.audio || []
            // remove clicked
            audio.splice(audio.indexOf(obj.menu.id), 1)
            newData = { key: "audio", data: audio, dataIsArray: true, indexes: [slide] }
        } else if (type === "microphone") {
            const mics = layoutSlide.mics || []
            // remove clicked
            mics.splice(
                mics.findIndex((a) => a.id === obj.menu.id),
                1
            )
            newData = { key: "mics", data: mics, dataIsArray: true, indexes: [slide] }
        } else if (type === "action") {
            const newActions: any[] = []
            indexes.forEach((i) => {
                const layoutActions = ref[i]?.data?.actions || {}
                const slideActions = layoutActions.slideActions || []

                const actionId = obj.menu.id
                const actionIndex = slideActions.findIndex((a) => a.id === actionId || getActionTriggerId(a.triggers?.[0]) === actionId)
                if (actionIndex > -1) slideActions.splice(actionIndex, 1)

                layoutActions.slideActions = slideActions
                newActions.push(layoutActions)
            })
            newData = { key: "actions", data: newActions, indexes }
        }

        if (newData) history({ id: "SHOW_LAYOUT", newData })
    },

    // media
    preview: (obj: ObjData) => {
        if (!obj.sel) return

        const path: string = obj.sel.data[0].path || obj.sel.data[0].id || obj.sel.data[0]
        if (!path) return

        const type = obj.sel.id || "media"
        if (type === "media" || type === "audio") activeEdit.set({ id: path, type, items: [] })

        const name = removeExtension(getFileName(path))
        const mediaType = type === "media" ? getMediaType(getExtension(path)) : type

        const showRef: any = { id: path, type: mediaType }
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
            const firstTimer = get(activeTimers).find((a) => a.id === obj.sel!.data[0]?.id)
            const shouldPlay = firstTimer?.paused === undefined ? true : firstTimer.paused
            obj.sel.data.forEach((data) => {
                playPauseGlobal(data.id, data, false, !shouldPlay)
            })
            return
        }

        if (get(outLocked)) return

        // video (play in project)
        const path = obj.sel.data[0].path || obj.sel.data[0].id
        if (!path) return

        const outputId: string = getActiveOutputs(get(outputs), false, true, true)[0]
        const currentOutput = get(outputs)[outputId] || {}
        const outputStyle = get(styles)[currentOutput.style || ""]
        const mediaStyle: MediaStyle = getMediaStyle(get(media)[path], outputStyle)

        const videoType = get(media)[path]?.videoType || ""

        // clear slide text
        // if (get(projects)[get(activeProject) || ""]?.shows?.find((a) => a.id === path)) clearSlide()
        if (videoType === "foreground") clearSlide()

        const type = getMediaType(getExtension(path))
        setOutput("background", { path, ...mediaStyle, type, loop: false, muted: false })
    },
    play_no_audio: (obj: ObjData) => {
        if (get(outLocked)) return

        const path = obj.sel?.data[0].path || obj.sel?.data[0].id
        if (!path) return

        const outputId = getActiveOutputs(get(outputs))[0]
        const currentOutput = get(outputs)[outputId] || {}
        const currentStyle = getCurrentStyle(get(styles), currentOutput.style)

        const mediaStyle: MediaStyle = getMediaStyle(get(media)[path], currentStyle)

        const type = getMediaType(getExtension(path))
        setOutput("background", { path, ...mediaStyle, type, loop: true, muted: true })
    },
    play_no_filters: (obj: ObjData) => {
        if (get(outLocked)) return

        const path = obj.sel?.data[0].path || obj.sel?.data[0].id
        if (!path) return

        const videoType = get(media)[path]?.videoType || ""
        const loop = videoType === "foreground" ? false : true
        const muted = videoType === "foreground" ? false : true

        const type = getMediaType(getExtension(path))
        setOutput("background", { path, type, loop, muted })
    },
    favourite: (obj: ObjData) => {
        if (!obj.sel) return

        if (obj.sel.id === "category_scripture") {
            const isFavourite = get(scriptures)[obj.sel.data[0]]?.favorite !== true
            scriptures.update((a) => {
                obj.sel!.data.forEach((id) => {
                    a[id].favorite = isFavourite
                })
                return a
            })
            return
        }

        const favourite: boolean = get(media)[obj.sel.data[0].path || obj.sel.data[0].id]?.favourite !== true
        media.update((a) => {
            obj.sel!.data.forEach((card) => {
                const path = card.path || card.id
                if (!a[path]) a[path] = { filter: "" }
                if (obj.sel!.id === "audio") a[path].audio = true
                a[path].favourite = favourite
            })
            return a
        })
    },
    effects_library_add: (obj: ObjData) => {
        if (!obj.sel) return

        const path = obj.sel.data[0].path || obj.sel.data[0].id
        const existing = !!get(effectsLibrary).find((a) => a.path === path)

        effectsLibrary.update((a) => {
            obj.sel!.data.forEach((audio) => {
                const currentPath = audio.path || audio.id

                const index = a.findIndex((effect) => effect.path === currentPath)
                if (existing) {
                    if (index < 0) return
                    a.splice(index, 1)
                    return
                }

                if (index < 0) a.push({ path: currentPath, name: removeExtension(getFileName(currentPath)) })
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

        const path = data?.path
        if (!path) return

        sendMain(Main.SYSTEM_OPEN, path)
    },

    // live
    startup_activate: (obj: ObjData) => {
        if (obj.sel?.id !== "camera") return

        let cameraIds: string[] = obj.sel.data.filter(a => a.type === "camera").map(a => a.id)
        const currentlySelected = cameraManager.getStartupCameras()
        const shouldActivate = !currentlySelected.includes(cameraIds[0])

        if (shouldActivate) cameraIds = [...(new Set([...currentlySelected, ...cameraIds]))]
        else cameraIds = currentlySelected.filter(id => !cameraIds.includes(id))

        cameraManager.setStartupCameras(cameraIds)
    },
    recording: (obj: ObjData) => {
        if (get(activeRecording)) {
            stopMediaRecorder()
        } else {
            const mediaData = JSON.parse(obj.contextElem?.getAttribute("data-media") || "{}")
            if (!mediaData.video) {
                newToast("toast.error_media")
                return
            }

            activeRecording.set(mediaData)
        }
    },

    // overlays
    lock_to_output: (obj: ObjData) => {
        if (obj.sel?.id !== "overlay") return
        const setLocked = !get(overlays)[obj.sel.data[0]]?.locked

        overlays.update((a) => {
            obj.sel!.data.forEach((id: string) => {
                a[id].locked = setLocked
            })
            return a
        })
    },
    place_under_slide: (obj: ObjData) => {
        if (obj.sel?.id === "effect") {
            const placeUnder = !get(effects)[obj.sel.data[0]]?.placeUnderSlide
            effects.update((a) => {
                obj.sel!.data.forEach((id: string) => {
                    a[id].placeUnderSlide = placeUnder
                })
                return a
            })
            return
        }

        if (obj.sel?.id !== "overlay") return
        const setUnder = !get(overlays)[obj.sel.data[0]]?.placeUnderSlide

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
        const stageId = obj.sel?.data[0]?.id
        moveStageConnection(stageId)
    },

    // drawer navigation
    changeIcon: () => activePopup.set("icon"),

    selectAll: (obj: ObjData) => selectAll(obj.sel),

    bind_slide: (obj: ObjData) => {
        const ref = getLayoutRef()
        const outputId = obj.menu.id || ""

        const indexes: number[] = obj.sel?.data.map(({ index }) => index) || []
        const newBindings: string[][] = []

        const add = !ref[indexes[0]]?.data?.bindings?.includes(outputId)

        indexes.forEach((i) => {
            const bindings: string[] = ref[i]?.data?.bindings || []
            const existingIndex = bindings.indexOf(outputId)
            if (add && existingIndex < 0) bindings.push(outputId)
            else if (!add && existingIndex >= 0) bindings.splice(existingIndex, 1)

            newBindings.push(bindings)
        })

        history({ id: "SHOW_LAYOUT", newData: { key: "bindings", data: newBindings, indexes, dataIsArray: false } })
    },
    // bind item
    bind_item: (obj: ObjData) => {
        const id = obj.menu?.id
        const items = get(activeEdit).items

        if (get(activeEdit).id) {
            const currentItems = get($[(get(activeEdit).type || "") + "s"])?.[get(activeEdit).id!]?.items
            const itemValues1 = items.map((index) => currentItems[index].bindings || [])
            const newValues1: string[][] = []
            itemValues1.forEach((value) => {
                if (!id) value = []
                else if (value.includes(id)) value.splice(value.indexOf(id, 1))
                else value.push(id)

                newValues1.push(value)
            })

            history({
                id: "UPDATE",
                oldData: { id: get(activeEdit).id },
                newData: { key: "items", subkey: "bindings", data: newValues1, indexes: items },
                location: { page: "edit", id: get(activeEdit).type + "_items", override: true }
            })

            return
        }

        const slideIndex: number = get(activeEdit).slide || 0
        const ref = getLayoutRef()
        const slideRef = ref[slideIndex]

        let itemValues = _show().slides([slideRef.id]).items(items).get("bindings")[0]
        itemValues = itemValues.map((a) => a || [])
        const newValues: string[][] = []
        itemValues.forEach((value) => {
            if (!id) value = []
            else if (value.includes(id)) value.splice(value.indexOf(id, 1))
            else value.push(id)

            newValues.push(value)
        })

        history({
            id: "setItems",
            newData: { style: { key: "bindings", values: newValues } },
            location: { page: "edit", show: get(activeShow)!, slide: slideRef.id, items, override: "itembind_" + slideRef.id + "_items_" + items.join(",") }
        })
        // _show().slides([slideID!]).set({ key: "items", value: items })
    },
    dynamic_values: (obj: ObjData) => {
        const sel = getSelectionRange()
        let lineIndex = sel.findIndex((a) => a?.start !== undefined)
        if (lineIndex < 0) lineIndex = 0
        const caret = { line: lineIndex || 0, pos: sel[lineIndex]?.start || 0 }

        popupData.set({ obj, caret })
        activePopup.set("dynamic_values")
    },
    conditions: (obj: ObjData) => {
        popupData.set({ obj })
        activePopup.set("conditions")
    },
    to_front: () => rearrangeItems("to_front"),
    forward: () => rearrangeItems("forward"),
    backward: () => rearrangeItems("backward"),
    to_back: () => rearrangeItems("to_back"),
    to_front_stage: () => rearrangeStageItems("to_front"),
    forward_stage: () => rearrangeStageItems("forward"),
    backward_stage: () => rearrangeStageItems("backward"),
    to_back_stage: () => rearrangeStageItems("to_back"),

    // formats
    find_replace: (obj: ObjData) => {
        popupData.set(obj)
        activePopup.set("find_replace")
        // format("find_replace", obj)
    },
    cut_in_half: (obj: ObjData) => {
        if (obj.sel?.id === "slide") {
            const oldLayoutRef = clone(getLayoutRef())
            const previousSpiltIds: string[] = []

            // go backwards to prevent wrong index when splitted
            const selectedSlides = obj.sel.data.sort((a, b) => b.index - a.index)

            selectedSlides.forEach(({ index }) => {
                const slideRef = oldLayoutRef[index]
                if (!slideRef || previousSpiltIds.includes(slideRef.id)) return
                previousSpiltIds.push(slideRef.id)

                const slideItems: Item[] = _show().slides([slideRef.id]).get("items")[0]

                // check lines array & text array first, then text value
                let firstTextItemIndex = slideItems.findIndex((a) => getItemText(a).length && ((a.lines?.length || 0) > 1 || (a.lines?.[0]?.text?.length || 0) > 1))
                if (firstTextItemIndex < 0) firstTextItemIndex = slideItems.findIndex((a) => getItemText(a).length > 18)
                if (firstTextItemIndex < 0) return

                splitItemInTwo(slideRef, firstTextItemIndex)
            })
        } else if (!obj.sel?.id) {
            // textbox
            const editSlideIndex: number = get(activeEdit).slide ?? -1
            if (editSlideIndex < 0) return

            const textItemIndex: number = get(activeEdit).items[0] ?? -1
            if (textItemIndex < 0) return

            const slideRef = getLayoutRef()[editSlideIndex]
            if (!slideRef) return
            splitItemInTwo(slideRef, textItemIndex)
        }
    },
    merge: (obj: ObjData) => {
        if (obj.sel?.id === "slide") {
            const selectedSlides = obj.sel.data // .sort((a, b) => a.index - b.index) [merge based on selected order]
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
            const oldTheme = get(themes)[id]
            const defaultTheme = defaultThemes[id] || defaultThemes.default
            const data = { ...defaultTheme, default: oldTheme.default || false, name: oldTheme.name }

            history({ id: "UPDATE", newData: { data }, oldData: { id }, location: { page: "settings", id: "settings_theme" } })
            updateThemeValues(get(themes)[id])
        })
    },
    reset: (obj: ObjData) => {
        if (obj.sel?.id === "style") {
            const defaultStyle = { name: translateText("example.default") }

            obj.sel.data.forEach(({ id }) => {
                const styleId = id || (get(styles).default ? uid() : "default")
                let style = get(styles)[styleId] || clone(defaultStyle)

                const name = style?.name || ""
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
                const currentOutput = clone(get(outputs)[id] || defaultOutput)

                const newOutput = clone(defaultOutput)

                // don't reset these values
                newOutput.name = currentOutput.name
                newOutput.out = currentOutput.out
                if (!currentOutput.enabled) newOutput.active = true
                if (currentOutput.stageOutput) newOutput.stageOutput = currentOutput.stageOutput

                history({ id: "UPDATE", newData: { data: newOutput }, oldData: { id }, location: { page: "settings", id: "settings_output" } })
            })

            return
        }

        if (obj.sel?.id === "profile") {
            obj.sel.data.forEach(({ id }) => {
                const currentProfile = clone(get(profiles)[id])
                currentProfile.access = {}

                history({ id: "UPDATE", newData: { data: currentProfile }, oldData: { id }, location: { page: "settings", id: "settings_profile" } })
            })

            return
        }
    }
}

function changeSlideAction(obj: ObjData, id: string) {
    const layoutSlide: number = obj.sel?.data[0]?.index || 0
    const ref = getLayoutRef()
    if (!ref[layoutSlide]) return

    // ONLY ONE

    if (id === "slide_shortcut") {
        const data = { index: layoutSlide, mode: "slide_shortcut" }

        popupData.set(data)
        activePopup.set("assign_shortcut")
        return
    }

    const layoutActions = clone(ref[layoutSlide].data?.actions) || {}

    if (id === "receiveMidi") {
        let midiId: string = uid()

        if (layoutActions[id]) midiId = layoutActions[id]!
        else layoutActions[id] = midiId

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: layoutActions, indexes: [layoutSlide] } })

        const data = { id: midiId, index: layoutSlide }

        popupData.set(data)
        activePopup.set("slide_midi")

        return
    }

    // MULTIPLE

    const indexes: number[] = obj.sel?.data.map(({ index }) => index) || []

    if (id === "action") {
        const actionId = uid()
        const existing: any[] = []
        const filteredLayoutActions = clone(
            indexes
                .map((i) => {
                    const a = ref[i]?.data?.actions || {}
                    if (!a.slideActions) a.slideActions = []
                    a.slideActions.push({ id: actionId, triggers: [] })

                    existing.push(...a.slideActions.map((slideAction) => slideAction.triggers?.[0]))
                    return a
                })
                .filter(Boolean) || []
        )

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: filteredLayoutActions, indexes } })

        popupData.set({ id: actionId, mode: "slide", indexes, existing })
        activePopup.set("action")

        return
    }

    if (id === "animate") {
        if (!layoutActions[id]) {
            layoutActions[id] = { actions: [{ type: "change", duration: 3, id: "text", key: "font-size", extension: "px" }] }
            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: layoutActions, indexes }, location: { page: "show", override: "animate_slide" } })
        }

        const data = { data: layoutActions[id], indexes }

        popupData.set(data)
        activePopup.set("animate")

        return
    }

    if (id === "nextTimer") {
        const nextTimer = clone(ref[layoutSlide]?.data?.nextTimer) || 0

        history({ id: "SHOW_LAYOUT", newData: { key: "nextTimer", data: nextTimer, indexes }, location: { page: "show", override: "change_style_slide" } })

        const data = { value: nextTimer, indexes }

        popupData.set(data)
        activePopup.set("next_timer")

        return
    }

    // this is old and has to be stored as this
    if (id === "loop") {
        const loop = ref[layoutSlide]?.data?.end || false
        history({ id: "SHOW_LAYOUT", newData: { key: "end", data: !loop, indexes } })

        return
    }

    const actionsList: any[] = []
    indexes.forEach((index: number) => {
        const currentLayoutActions = ref[index]?.data?.actions || {}
        currentLayoutActions[id] = !currentLayoutActions[id]
        actionsList.push(currentLayoutActions)
    })

    history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actionsList, indexes } })
}

export function removeGroup(data: any[]) {
    const ref = getLayoutRef()
    const firstSlideId = ref[0].id

    let removeSlideIds: string[] = []
    data.forEach((slideRef) => {
        if (!slideRef.index) return
        const refSlide = ref.find((a) => a.layoutIndex === slideRef.index)
        if (!refSlide || refSlide?.type === "child" || refSlide?.id === firstSlideId) return

        removeSlideIds.push(refSlide.id)
    })
    removeSlideIds = removeDuplicates(removeSlideIds)
    if (!removeSlideIds.length) return

    const newParentIds: { [key: string]: string } = {}

    // remove from layout
    const activeLayout = _show().get("settings.activeLayout")
    const layout: SlideData[] = clone(_show().layouts([activeLayout]).get("slides")[0])
    const newLayoutSlides: any[] = []
    layout.forEach((layoutRef, i: number) => {
        if (!removeSlideIds.includes(layoutRef.id)) {
            newLayoutSlides.push(layoutRef)
            return
        }

        const currentIndex = newLayoutSlides.length - 1
        const layoutIndex = ref.find((a) => a.id === layoutRef.id && a.index === i)?.layoutIndex
        const isSelected = data.find((a) => a.index === layoutIndex)
        if (isSelected) newParentIds[layoutRef.id] = newLayoutSlides[currentIndex].id

        if (!Object.keys(layoutRef).length) return

        if (!newLayoutSlides[currentIndex].children) newLayoutSlides[currentIndex].children = {}
        const id = layoutRef.id

        const childData: any = layoutRef
        delete childData.id
        newLayoutSlides[currentIndex].children[id] = childData
    })

    const slides = clone(_show().get("slides"))
    Object.keys(slides).forEach((slideId) => {
        const slide: Slide = slides[slideId]
        const willChange = removeSlideIds.includes(slideId)
        if (!willChange) return

        const newParent: string = newParentIds[slideId]
        if (!newParent) return

        const children = slide.children || []
        if (!slides[newParent].children) slides[newParent].children = []

        slides[newParent].children = [...slides[newParent].children, slideId, ...children]
        delete slides[slideId].children

        delete slides[slideId].globalGroup
        slides[slideId].group = null
        slides[slideId].color = null
    })

    const newData = { slides, layout: newLayoutSlides }
    history({ id: "slide", newData, location: { layout: activeLayout, page: "show", show: get(activeShow)! } })
}

export async function removeSlide(data: any[], type: "delete" | "remove" = "delete") {
    const ref = getLayoutRef()
    const parents: any[] = []
    const childs: any[] = []

    if (type === "delete") {
        const selectedInDifferentLayout = checkIfAddedToDifferentLayout(ref, data)
        const prompt = translateText("confirm.statement_slide_exists_layout confirm.question_delete")
        if (selectedInDifferentLayout && !(await confirmCustom(prompt))) return
    }

    // sort so the correct slide indexes are removed
    data = sortObjectNumbers(data, "index")

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

export async function format(id: string, obj: ObjData, data: any = null) {
    let slideIds: string[] = []

    const editing = get(activeEdit)
    const items = editing.items || []

    // WIP let slide = getEditSlide()

    if (editing.id) {
        let currentItems: Item[] = []
        if (editing.type === "overlay") currentItems = get(overlays)[editing.id]?.items || []
        if (editing.type === "template") currentItems = get(templates)[editing.id]?.items || []

        const newItems: Item[] = []
        currentItems.forEach((item) => {
            item.lines?.forEach((line, j: number) => {
                line.text?.forEach((text, k: number) => {
                    if (item.lines?.[j]?.text?.[k]) item.lines[j].text[k].value = formatting[id](text.value, data)
                })
            })
            newItems.push(item)
        })

        const override = editing.id + "_format#" + items.join(",")
        history({
            id: "UPDATE",
            oldData: { id: editing.id },
            newData: { key: "items", data: newItems, indexes: items },
            location: { page: "edit", id: editing.type + "_items", override }
        })

        refreshEditSlide.set(true)
        return
    }

    const ref = getLayoutRef()
    if (get(textEditActive)) {
        // select all slides
        slideIds = _show().slides().get().map((a) => a.id)
    } else if (obj.sel?.id?.includes("slide")) {
        slideIds = obj.sel.data.map((a) => ref[a.index].id)
    } else {
        slideIds = [
            _show()
                .slides([ref[get(activeEdit).slide!]?.id])
                .get()[0]?.id
        ]
    }

    // async update
    for (const slide of slideIds) {
        const slideItems: Item[] = _show().slides([slide]).items(get(activeEdit).items).get()[0]
        const newData: any = { style: { values: [] } }

        const newItems: Item[] = []
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

        await wait(10)
    }

    refreshEditSlide.set(true)
}

function checkIfAddedToDifferentLayout(ref: LayoutRef[], data: any[]) {
    let showLayouts = _show().layouts().get(null, true)
    if (showLayouts.length < 2) return false

    // don't check current
    const currentLayoutId = _show().get("settings.activeLayout")
    showLayouts = showLayouts.filter((a) => a.layoutId !== currentLayoutId)

    // check if slide is added to any other layout
    return data.find(({ index }) => {
        const parentSlideId = ref[index]?.parent?.id ?? ref[index]?.id
        return showLayouts.find((a) => a.slides.find((slide) => slide.id === parentSlideId))
    })
}

const formatting = {
    find_replace: (t: string, data) => {
        if (!data.findValue) return t

        let flags = "g"
        if (data.caseSentitive === false) flags += "i"
        const regExp = new RegExp(data.findValue, flags)
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
            .trim()
}

// SORT

function sort(obj: ObjData, id: string) {
    const type = obj.menu.id

    sorted.update((a) => {
        if (!a[id]) a[id] = {}
        a[id].type = type
        return a
    })

    if (id === "shows") updateShowsList(get(shows))
}
