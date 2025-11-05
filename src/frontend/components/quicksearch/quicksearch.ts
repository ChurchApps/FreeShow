import { get } from "svelte/store"
import { uid } from "uid"
import { sendMain } from "../../IPC/main"
import {
    actions,
    activeEdit,
    activePage,
    activePopup,
    activeProject,
    activeShow,
    activeStage,
    activeStyle,
    alertMessage,
    categories,
    companion,
    currentOutputSettings,
    disabledServers,
    focusMode,
    folders,
    groups,
    openToolsTab,
    outputs,
    overlays,
    profiles,
    projects,
    projectView,
    quickSearchActive,
    refreshEditSlide,
    selectedProfile,
    settingsTab,
    showRecentlyUsedProjects,
    showsCache,
    slidesOptions,
    sortedShowsList,
    stageShows,
    styles,
    textEditActive
} from "../../stores"
import { triggerFunction } from "../../utils/common"
import { translateText } from "../../utils/language"
import { getAccess } from "../../utils/profile"
import { showSearch } from "../../utils/search"
import { runAction } from "../actions/actions"
import { sortByClosestMatch } from "../actions/apiHelper"
import { menuClick } from "../context/menuClick"
import { openDrawer } from "../edit/scripts/edit"
import { keysToID } from "../helpers/array"
import { duplicate } from "../helpers/clipboard"
import { history } from "../helpers/history"
import { Main } from "./../../../types/IPC/Main"

interface QuickSearchValue {
    type: keyof typeof triggerActions
    icon?: string
    id: string
    name: string
    color?: string
    aliasMatch: string | null
    description?: string
    data?: any
}

const MAX_RESULTS = 10
export function quicksearch(searchValue: string) {
    const values: QuickSearchValue[] = []
    const shouldReturn = () => values.length >= MAX_RESULTS
    const trimValues = () => values.slice(0, MAX_RESULTS)
    const sort = (array: any[]) => sortByClosestMatch(array, searchValue)

    if (get(activePage) === "show" && get(activeShow)?.type === "show") {
        addValues(sort(getShowActions()).slice(0, 5), "custom_actions")
        if (shouldReturn()) return trimValues()
    }

    if (get(activePage) === "edit" && !get(activeEdit)?.id && get(activeShow)?.type === "show") {
        addValues(sort(getEditActions()).slice(0, 5), "custom_actions")
        if (shouldReturn()) return trimValues()
    }

    // outputs
    addValues(sort(keysToID(get(outputs))).slice(0, 5), "settings_output", "display_settings")
    if (shouldReturn()) return trimValues()

    // styles
    addValues(sort(keysToID(get(styles))).slice(0, 5), "settings_styles", "styles")
    if (shouldReturn()) return trimValues()

    // profiles
    addValues(sort(keysToID(get(profiles))).slice(0, 5), "settings_profiles", "profiles")
    if (shouldReturn()) return trimValues()

    // stage layouts
    addValues(sort(keysToID(get(stageShows))).slice(0, 5), "stage_layout", "stage")
    if (shouldReturn()) return trimValues()

    // overlays
    addValues(sort(keysToID(get(overlays))).slice(0, 5), "overlay", "overlays")
    if (shouldReturn()) return trimValues()

    // projects
    addValues(sort(keysToID(get(projects))).slice(0, 5), "project", "project")
    if (shouldReturn()) return trimValues()

    // actions
    addValues(sort(keysToID(get(actions))).slice(0, 2), "action", "actions")
    if (shouldReturn()) return trimValues()

    // main pages
    addValues(sort(getMainPages()).slice(0, 2), "main_page")
    if (shouldReturn()) return trimValues()

    // drawer submenus
    addValues(sort(getDrawerSubmenus()).slice(0, 3), "drawer_submenu")
    if (shouldReturn()) return trimValues()

    // menu bar
    addValues(sort(getMenubarItems()).slice(0, 3), "context_menu")
    if (shouldReturn()) return trimValues()

    // popups
    addValues(sort(getPopups()).slice(0, 3), "popups")
    if (shouldReturn()) return trimValues()

    // settings
    addValues(sort(getSettings()).slice(0, 3), "settings")
    if (shouldReturn()) return trimValues()

    // connections
    addValues(sort(connectionsList), "settings_connection", "connection")
    if (shouldReturn()) return trimValues()

    // faq
    addValues(sort(getFaq()).slice(0, 3), "faq")
    if (shouldReturn()) return trimValues()

    // shows
    const shows = showSearch(searchValue, get(sortedShowsList).filter(a => !get(categories)[a.category || ""]?.isArchive))
    addValues(shows, "show", "slide")

    return trimValues()

    function addValues(items: any[], type: keyof typeof triggerActions, icon = "") {
        const newValues: QuickSearchValue[] = items.map((a) => ({ type, icon: a.icon || icon, id: a.id, name: a.name, color: a.color, data: a.data || null, aliasMatch: a.aliasMatch || null }))
        values.push(...newValues)
    }
}

const triggerActions = {
    custom_actions: (id: string, data: any) => {
        if (id === "layout") {
            duplicate({ id: "layout" })
            return
        }

        if (id === "textedit") {
            textEditActive.set(!get(textEditActive))
            return
        }

        if (data.toolsTab) {
            openToolsTab.set(data.toolsTab)
            return
        }

        if (data.globalGroup) {
            const show = get(showsCache)[get(activeShow)!.id]
            if (show?.locked) {
                alertMessage.set("show.locked_info")
                activePopup.set("alert")
                return
            }

            const profile = getAccess("shows")
            const readOnly = profile.global === "read" || profile[show?.category || ""] === "read"
            if (readOnly) {
                alertMessage.set("profile.locked")
                activePopup.set("alert")
                return
            }

            history({ id: "SLIDES", newData: { data: [{ ...data.globalGroup, id: uid() }] } })
            return
        }

        if (data.menuClick) {
            menuClick(data.menuClick)
            return
        }

        if (data.popup) {
            activePopup.set(id as any)
            return
        }

        if (data.view) {
            slidesOptions.set({ ...get(slidesOptions), mode: data.view })
            return
        }
    },
    settings_output: (id: string) => {
        currentOutputSettings.set(id)
        settingsTab.set("display_settings")
        activePage.set("settings")
    },
    settings_styles: (id: string) => {
        activeStyle.set(id)
        settingsTab.set("styles")
        activePage.set("settings")
    },
    settings_profiles: (id: string) => {
        selectedProfile.set(id)
        settingsTab.set("profiles")
        activePage.set("settings")
    },
    stage_layout: (id: string) => {
        activeStage.set({ id, items: [] })
        activePage.set("stage")
    },
    overlay: (id: string) => {
        if (get(activePage) === "edit") {
            activeEdit.set({ id, type: "overlay", items: [] })
            refreshEditSlide.set(true)
        } else {
            activeShow.set({ id, type: "overlay" })
            activePage.set("show")

            openDrawer("overlays")
        }
    },
    project: (id: string) => {
        showRecentlyUsedProjects.set(false)
        activeProject.set(id)
        projectView.set(false)
        activePage.set("show")
    },
    action: (id: string) => {
        const action = get(actions)[id]
        runAction(action)
    },
    main_page: (id: string) => {
        if (id === "projects") {
            projectView.set(true)
            activePage.set("show")
            return
        }

        if (!top.includes(id)) {
            openDrawer(id)
            return
        }

        if (id === "settings") settingsTab.set("general")

        activePage.set(id as any)

        // if (id === "edit") openActiveShow()
    },
    drawer_submenu: (id: string) => {
        openDrawer(id)
    },
    context_menu: (id: string) => {
        menuClick(id)
    },
    popups: (id: string, data: any) => {
        if (id === "project") {
            projectView.set(true)
            activePage.set("show")
            history({
                id: "UPDATE",
                newData: { replace: { parent: get(folders)[get(projects)[get(activeProject) || ""]?.parent] ? get(projects)[get(activeProject) || ""]?.parent || "/" : "/" } },
                location: { page: "show", id: "project" }
            })
            return
        }

        if (data?.drawerTab) openDrawer(data.drawerTab)
        if (data?.settingsTab) {
            settingsTab.set(data.settingsTab)
            activePage.set("settings")
        }

        if (id === "overlay" || id === "template" || id === "effect") {
            // make sure tab is opened before creating so rename input gets focused
            setTimeout(() => history({ id: "UPDATE", location: { page: "drawer", id } }))
            return
        }

        if (id === "output") {
            triggerFunction("create_output")
            return
        }
        if (id === "style") {
            triggerFunction("create_style")
            return
        }
        if (id === "profile") {
            triggerFunction("create_profile")
            return
        }

        if (id === "category") {
            history({ id: "UPDATE", location: { page: "drawer", id: "category_shows" } })
            return
        }

        if (id === "error_log") {
            sendMain(Main.OPEN_LOG)
            return
        }

        activePopup.set(id as any)
    },
    settings: (id: string) => {
        settingsTab.set(id as any)
        activePage.set("settings")
    },
    settings_connection: (id: string) => {
        enableConnection(id)

        settingsTab.set("connection")
        activePage.set("settings")

        activePopup.set(null)
        // let popup close first
        setTimeout(() => triggerFunction("open_connection_" + id), 110)
    },
    faq: (id: string) => {
        sendMain(Main.URL, id)
    },
    show: (id: string, _data: any, control: boolean) => {
        const currentIndex = get(activeShow)?.index

        const newShow: any = { id, type: "show" }
        activeShow.set(newShow)

        // ShowButton.svelte
        // if (type === "image" || type === "video") activeEdit.set({ id, type: "media", items: [] })
        if (get(activeEdit).id) activeEdit.set({ type: "show", slide: 0, items: [], showId: get(activeShow)?.id })

        if (get(activePage) === "edit") refreshEditSlide.set(true)
        else {
            activePage.set("show")

            // add to project
            if (control) {
                const newIndex = (currentIndex ?? get(projects)[get(activeProject) || ""]?.shows?.length - 1) + 1
                history({ id: "UPDATE", newData: { key: "shows", index: newIndex, data: { id } }, oldData: { id: get(activeProject) }, location: { page: "show", id: "project_ref" } })
                activeShow.set({ ...newShow, index: newIndex })
            }
        }
    }
}

export function selectQuicksearchValue(value: QuickSearchValue, control: boolean) {
    if (!triggerActions[value.type]) {
        console.error("Unknown Quick search type:", value.type)
        return
    }

    if (get(focusMode) && value.id !== "focus_mode") focusMode.set(false)
    quickSearchActive.set(false)

    triggerActions[value.type](value.id, value.data, control)
}

// HELPERS

const translateNames = (array: any[]) => array.map((a) => ({ ...a, name: translateText(a.name) })).map(translateAliases)

function translateAliases(options: any) {
    options.aliases = (options.aliases || []).map(translateText)
    return options
}

const connectionsList = [
    { id: "remote", name: "RemoteShow", aliases: ["-Remote"] },
    { id: "stage", name: "StageShow", aliases: ["-Remote"] },
    { id: "controller", name: "ControlShow", aliases: ["-Remote"] },
    { id: "output_stream", name: "OutputShow", aliases: ["-Remote"] },
    { id: "companion", name: "API", aliases: ["Companion", "WebSocket", "REST", "OSC"] }
]

function enableConnection(id: string) {
    if (id === "companion") {
        companion.set({ enabled: true })
        return
    }

    const enabledByDefault = ["remote", "stage"].includes(id)
    const isEnabled = enabledByDefault ? get(disabledServers)[id] !== true : get(disabledServers)[id] === false
    if (isEnabled) return

    disabledServers.set({ ...get(disabledServers), [id]: false })
}

/// //

const top = ["show", "edit", "stage", "draw", "settings"]
const mainPages = [
    // top pages
    { id: "show", name: "menu.show", icon: "show", aliases: ["-Home"] },
    { id: "edit", name: "menu.edit", icon: "edit" },
    { id: "stage", name: "menu.stage", icon: "stage" },
    { id: "draw", name: "menu.draw", icon: "draw" },
    { id: "settings", name: "menu.settings", icon: "settings" },
    // drawer tabs
    { id: "shows", name: "tabs.shows", icon: "shows", aliases: ["category.song", "category.presentation", "-Library", "-Preview"] },
    { id: "media", name: "tabs.media", icon: "media", aliases: ["category.pictures", "category.videos", "-Photos", "-Images", "-Films"] },
    { id: "audio", name: "tabs.audio", icon: "audio", aliases: ["category.music", "media.volume", "audio.metronome", "audio.settings"] },
    { id: "overlays", name: "tabs.overlays", icon: "overlays", aliases: ["-Props", "-Alerts", "-Messages", "-Popups", "-Notices"] },
    { id: "templates", name: "tabs.templates", icon: "templates" },
    { id: "scripture", name: "tabs.scripture", icon: "scripture", aliases: ["-Bibles"] },
    { id: "calendar", name: "tabs.calendar", icon: "calendar", aliases: ["menu._title_calendar"] },
    { id: "functions", name: "tabs.functions", icon: "functions" },
    // other
    { id: "projects", name: "remote.projects", icon: "project", aliases: ["-Playlists", "-Schedules", "-Agendas", "-Services", "-Sermons", "-Events"] }
    // { id: "project", name: "remote.project", icon: "project" },
]

function getMainPages() {
    return translateNames(mainPages)
}

const menubarItems = [
    { id: "save", name: "actions.save", icon: "save" },
    { id: "import_more", name: "actions.import", icon: "import", aliases: ["-PDF", "-PowerPoint"] },
    { id: "export_more", name: "actions.export", icon: "export" },
    { id: "history", name: "popup.history", icon: "history", aliases: ["-Undo"] },
    { id: "shortcuts", name: "popup.shortcuts", icon: "shortcut", aliases: ["-Keyboard"] },
    { id: "about", name: "popup.about", icon: "info", aliases: ["-Report", "-Bug", "-Issue", "-Contact", "-Email", "-Translate", "-Donate"] },

    { id: "focus_mode", name: "actions.focus_mode", icon: "focus_mode" },
    { id: "fullscreen", name: "actions.fullscreen", icon: "fullscreen" }
]

function getMenubarItems() {
    return translateNames(menubarItems)
}

const drawerSubmenus = [
    // media
    { id: "online", name: "media.online", icon: "web" },
    { id: "screens", name: "live.screens", icon: "screen" },
    { id: "cameras", name: "live.cameras", icon: "camera" },
    // audio
    { id: "microphones", name: "live.microphones", icon: "microphone" },
    { id: "audio_streams", name: "live.audio_streams", icon: "audio_stream" },
    // overlays
    { id: "effects", name: "tabs.effects", icon: "effect" },
    // calendar
    { id: "action", name: "calendar.schedule_action", icon: "actions" },
    // functions
    { id: "actions", name: "tabs.actions", icon: "actions", aliases: ["-Macros"] },
    { id: "timer", name: "tabs.timers", icon: "timer" },
    { id: "variables", name: "tabs.variables", icon: "variable" },
    { id: "triggers", name: "tabs.triggers", icon: "trigger" }
]

function getDrawerSubmenus() {
    // WIP categories etc.?
    return translateNames(drawerSubmenus)
}

const popups = [
    // general manage
    { id: "manage_groups", name: "popup.manage_groups", icon: "groups" },
    { id: "manage_metadata", name: "popup.manage_metadata", icon: "info" },
    { id: "manage_dynamic_values", name: "popup.manage_dynamic_values", icon: "dynamic" },
    { id: "manage_icons", name: "popup.manage_icons", icon: "star" },
    { id: "manage_colors", name: "popup.manage_colors", icon: "color" },
    //
    { id: "manage_emitters", name: "popup.manage_emitters", icon: "emitter", data: { drawerTab: "actions" } },
    { id: "transition", name: "popup.transition", icon: "transition" },
    // CREATE NEW
    { id: "show", name: "new.show", icon: "add", data: { drawerTab: "shows" }, aliases: ["-Create", "-New song", "-New presentation", "-Create song", "-Create presentation", "timer.create"] },
    { id: "action", name: "new.action", icon: "add", data: { drawerTab: "actions" }, aliases: ["-New macro"] },
    { id: "timer", name: "new.timer", icon: "add", data: { drawerTab: "timer" } },
    { id: "variable", name: "new.variable", icon: "add", data: { drawerTab: "variables" } },
    { id: "trigger", name: "new.trigger", icon: "add", data: { drawerTab: "triggers" } },
    { id: "audio_stream", name: "new.audio_stream", icon: "add", data: { drawerTab: "audio_streams" } },
    { id: "output", name: "settings.new_output", icon: "add", data: { settingsTab: "display_settings" } },
    { id: "style", name: "new.style", icon: "add", data: { settingsTab: "styles" } },
    { id: "profile", name: "new.profile", icon: "add", data: { settingsTab: "profiles" } },
    { id: "edit_event", name: "new.event", icon: "add", data: { drawerTab: "calendar" } },
    { id: "edit_event", name: "new.event_action", icon: "add", data: { drawerTab: "action" } },
    // custom (no popup)
    { id: "category", name: "new.category", icon: "add", data: { drawerTab: "shows" } },
    { id: "project", name: "new.project", icon: "add", aliases: ["-New Playlist", "-New Schedule", "-New Agenda", "-New Service", "-New Sermon", "-New Event"] },
    { id: "overlay", name: "new.overlay", icon: "add", data: { drawerTab: "overlays" } },
    { id: "effect", name: "new.effect", icon: "add", data: { drawerTab: "effects" } },
    { id: "template", name: "new.template", icon: "add", data: { drawerTab: "templates" } },
    // logs
    { id: "error_log", name: "actions.open_error_log", icon: "document", data: { settingsTab: "other" }, aliases: ["-Freeze"] },
]

function getPopups() {
    return translateNames(popups)
}

const settings = [
    {
        id: "general",
        name: "settings.general",
        icon: "general",
        aliases: [
            "settings.language",
            "settings.use24hClock",
            "settings.disable_labels",
            "settings.default_project_name",
            "settings.startup_projects_list",
            "settings.auto_output",
            "settings.hide_cursor_in_output",
            "settings.clear_media_when_finished",
            "settings.capitalize_words",
            "settings.transparent_slides",
            "settings.full_colors",
            "settings.slide_number_keys",
            "settings.auto_shortcut_first_letter"
        ]
    },
    { id: "display_settings", name: "settings.display_settings", icon: "display_settings", aliases: ["settings.active_style", "settings.output_screen", "settings.always_on_top", "NDI®", "-Livestream", "-Stage", "-HDMI"] },
    {
        id: "styles",
        name: "settings.styles",
        icon: "styles",
        aliases: [
            "-Looks",
            "edit.background_color",
            "edit.background_media",
            "popup.transition",
            "edit.media_fit",
            "settings.aspect_ratio",
            "settings.active_layers",
            "settings.lines",
            "settings.override_with_template",
            "settings.override_scripture_with_template",
            "meta.display_metadata"
        ]
    },
    { id: "connection", name: "settings.connection", icon: "connection", aliases: ["Planning Center", "ChurchApps", "-Network", "-LAN"] },
    {
        id: "files",
        name: "settings.files",
        icon: "files",
        aliases: ["settings.autosave", "settings.auto_backup", "settings.data_location", "settings.show_location", "settings.user_data_location", "settings.cloud", "-Cloud sync", "-Sync", "settings.backup_all", "settings.restore"]
    },
    { id: "profiles", name: "settings.profiles", icon: "profiles" },
    { id: "theme", name: "settings.theme", icon: "theme" }
    // { id: "other", name: "settings.other", icon: "other" }
]

function getSettings() {
    return translateNames(settings)
}

const faq = [
    // Docs About
    { id: "https://freeshow.app/docs/projects", name: "About Projects", icon: "help" },
    { id: "https://freeshow.app/docs/show-type", name: "About Shows", icon: "help" },
    { id: "https://freeshow.app/docs/overlays", name: "About Overlays", icon: "help" },
    { id: "https://freeshow.app/docs/templates", name: "About Templates", icon: "help" },
    { id: "https://freeshow.app/docs/outputs", name: "Multiple Outputs", icon: "help", aliases: ["-Livestream", "-OBS"] },
    // Docs Help
    { id: "https://freeshow.app/docs/scripture#create-a-collection", name: "Multiple Scripture Versions", icon: "help", aliases: ["-Multilingual", "-Multiple translations", "-Multiple Bibles", "-Multiple languages"] },
    { id: "https://freeshow.app/docs/faq#multilingual-songs", name: "Multilingual Song Lyrics", icon: "help", aliases: ["-Multilingual", "-translations", "-lyrics", "-languages", "-translated"] },
    { id: "https://freeshow.app/docs/outputs#how-to-create-lower-third-display-for-a-live-stream", name: "Lower Third Display", icon: "help", aliases: ["-Lower thirds", "-Livestream"] },
    { id: "https://freeshow.app/docs/features#system-requirements", name: "System Requirements", icon: "help", aliases: ["-Specs"] },
    { id: "https://freeshow.app/docs/faq#how-to-import-a-powerpoint-presentation", name: "How to import a PowerPoint presentation", icon: "help", aliases: ["-PowerPoint", "-Keynote", "-slides", "-presentation"] },
    { id: "https://freeshow.app/docs/importing#powerpoint", name: "How to import PowerPoint as text", icon: "help", aliases: ["-PowerPoint", "-slides", "-presentation"] },
    { id: "https://freeshow.app/docs/importing#pdf", name: "How to import a PDF file", icon: "help", aliases: ["-PDF"] },
    { id: "https://freeshow.app/docs/faq#videos-are-muted", name: "Videos are muted", icon: "help", aliases: ["-No audio"] },
    { id: "https://freeshow.app/docs/faq#ccli-integration", name: "CCLI Integration", icon: "help", aliases: ["-SongSelect"] },
    { id: "https://freeshow.app/docs/faq#cloud-sync-between-two-computers", name: "Cloud Sync Between Multiple Computers", icon: "help" },
    { id: "https://freeshow.app/docs/faq#how-to-transfer-the-files-between-computers", name: "Transfer Files Between Computers", icon: "help" },
    { id: "https://freeshow.app/docs/faq#the-app-is-slow", name: "The App is Slow", icon: "help", aliases: ["-Lagging", "-Performance"] },
    { id: "https://freeshow.app/docs/faq#freeshow-keeps-freezing", name: "FreeShow Freezed Suddenly", icon: "help", aliases: ["-Freezing", "-Crash"] },
    { id: "https://freeshow.app/docs/items#line-by-line-reveal", name: "Line by line reveal", icon: "help" },
    { id: "https://freeshow.app/docs/items#click-reveal", name: "Click reveal", icon: "help" },
    { id: "https://freeshow.app/docs/editing#virtual-line-breaks-virtual-breaks", name: "Virtual breaks", icon: "help", aliases: ["-Line breaks"] },
    // GitHub
    { id: "https://github.com/ChurchApps/FreeShow/issues/693#issuecomment-2255167635", name: "Delete Slide vs Remove Group", icon: "help", aliases: ["-Delete group vs remove slide"] },
    { id: "https://github.com/ChurchApps/FreeShow/issues/1175#issuecomment-2581935274", name: "Custom Bible Version", icon: "help", aliases: ["-Missing scripture", "-Missing Bible"] },
    { id: "https://github.com/ChurchApps/FreeShow/issues/178", name: "Video Loop Behaviour", icon: "help", aliases: ["-Video looping"] },
    { id: "https://github.com/ChurchApps/FreeShow/issues/1123", name: "Unsupported Video Codec", icon: "help", aliases: ["-Video dont play", "-Video not playing", "-MOV", "-MP4"] },
    { id: "https://github.com/ChurchApps/FreeShow/issues/251", name: "Embed PowerPoint/Google Slides", icon: "help", aliases: ["-PowerPoint online", "-Google Presentations"] },
    // Videos (Garry B Jr.)
    { id: "https://youtu.be/1A4GUMu-pdA", name: "Silent Communication for Media Leaders", icon: "youtube" },
    { id: "https://youtu.be/L_e_bZzu7ec", name: "Bold Color Labels with High Contrast Mode", icon: "youtube" },
    { id: "https://youtu.be/EzaXKRkOG30", name: "Build and Master Shows Like a Pro", icon: "youtube" },
    { id: "https://youtu.be/hHZ67O5Axh0", name: "Why Choose FreeShow for Your Church?", icon: "youtube" },
    { id: "https://youtu.be/-PopxVxhj_A", name: "Best Video Types (Codecs)", icon: "youtube" },
    { id: "https://youtu.be/7E5nlsslC0k", name: "Deep Dive Into Templates", icon: "youtube" },
    { id: "https://youtu.be/G8ia0h6HiGA", name: "Advanced Level Game Show", icon: "youtube" },
    { id: "https://youtu.be/nTsVXk8FcmU", name: "Activate Focus Mode in FreeShow for a Distraction-Free Service", icon: "youtube" },
    { id: "https://youtu.be/NF3tN5ucW1Q", name: "Control FreeShow from Your iPad", icon: "youtube" },
    { id: "https://youtu.be/qtfMrtV1pos", name: "Create a Game Show in FreeShow", icon: "youtube" },
    { id: "https://youtu.be/douLurEcrkI", name: "Add Motion to Your Logo", icon: "youtube" },
    { id: "https://youtu.be/Huafy4bScYA", name: "Understand FreeShow Settings", icon: "youtube" },
    { id: "https://youtu.be/v08hZMJuPfY", name: "Find Anything in FreeShow with Quick Search", icon: "youtube" },
    { id: "https://youtu.be/r_e9f502wD8", name: "Profiles", icon: "youtube" },
    { id: "https://youtu.be/1ioOmYJxXPM", name: "Actions & Project Templates", icon: "youtube" },
    { id: "https://youtu.be/Gwfw59sgW2Y", name: "Livestream & Backgrounds", icon: "youtube" },
    { id: "https://youtu.be/7xJAeexrtkA", name: "Stage & Timers", icon: "youtube" },
    { id: "https://youtu.be/ljbKz2uqHL4", name: "Setting Up Styles & Templates", icon: "youtube" },
    { id: "https://youtu.be/GgiLGc5fUNw", name: "Setting Up Shows & Outputs", icon: "youtube" },
    { id: "https://youtu.be/EHlE8q_1jcY", name: "How to Import Files & Bibles", icon: "youtube" },
    { id: "https://youtu.be/sCyVzfwn6hg", name: "Expand Your Computer Displays for More Outputs", icon: "youtube" },
    { id: "https://youtu.be/FeQ70DDsDPw", name: "Understanding Conditions", icon: "youtube" },
    { id: "https://youtu.be/SsckYv_JD00", name: "Emergency Messages", icon: "youtube" },
    { id: "https://youtu.be/3UFsD3vlhqg", name: "Add Stage Display Notes for Your Pastor", icon: "youtube" },
    { id: "https://youtu.be/MEmu5g_2fts", name: "Show 2 Verses on 1 Slide", icon: "youtube", aliases: ["-scripture", "-bible"] },
    { id: "https://youtu.be/uyyHESkdEwg", name: "Manage Pictures in Your Livestream", icon: "youtube" },
    { id: "https://youtu.be/89skyZYD4jo", name: "Livestream Lower Thirds w/OBS+FreeShow", icon: "youtube" },
    { id: "https://youtu.be/Xnh1ddZldBc", name: "Bullet Points", icon: "youtube" },
    { id: "https://youtu.be/2iQq1mWKw4Y", name: "How to Setup a Vertical Display", icon: "youtube" },
    { id: "https://youtu.be/4dL8p0_OIqY", name: "How to Connect FreeShow to a Screen and OBS", icon: "youtube" },
    { id: "https://youtu.be/ZLS5HgBsSaM", name: "Fireworks Effect", icon: "youtube" },
    { id: "https://youtu.be/2KnCfvXBabQ", name: "Countdown Timer Setup", icon: "youtube" },
    { id: "https://youtu.be/lxPHFwQEZWM", name: "How to Backup and Restore", icon: "youtube" },
    { id: "https://youtu.be/h0nCm2D2dCg", name: "How to Use Chords", icon: "youtube" },
    { id: "https://youtu.be/vxMqvUrVMo4", name: "Pre Record Shows for Easy Playback", icon: "youtube" },
    { id: "https://youtu.be/YT5Dil_54Rw", name: "Get MIDI Signals Into FreeShow", icon: "youtube" },
    { id: "https://youtu.be/moCy2bjWpvo", name: "Gradients and SFX", icon: "youtube" },
    { id: "https://youtu.be/-Db08iXoYzI", name: "Cool Music Visualizer Affect", icon: "youtube" },
    { id: "https://youtu.be/rvrkaMbvGBs", name: "Start Your Video When You Want with Time Markers for Videos", icon: "youtube" },
    { id: "https://youtu.be/hxPU8ZSoDhE", name: "Import Bibles, Templates, & Projects", icon: "youtube" },
    { id: "https://youtu.be/GLNMQRH-F1c", name: "Download and Create Custom Organic Templates", icon: "youtube" },
    { id: "https://youtu.be/XP3y8kW3c6k", name: "Create Gradient Backgrounds", icon: "youtube" },
    { id: "https://youtu.be/DEbn8XLrQJA", name: "Actions Are Your Best Friend", icon: "youtube" },
    { id: "https://youtu.be/Jm4forUHP9M", name: "Using MIDI Outputs", icon: "youtube" },
    { id: "https://youtu.be/r2R_TcvGCqQ", name: "Make Multiple Versions of the Same Song", icon: "youtube" },
    { id: "https://youtu.be/H7iqWjXzlpw", name: "Autoplay Your Playlists", icon: "youtube" },
    { id: "https://youtu.be/b6Q5qe9Re44", name: "Schedule Shows to Start Automatically", icon: "youtube" },
    { id: "https://youtu.be/CFPZVG_UY3s", name: "Customize Scriptures in Stage Display", icon: "youtube" },
    { id: "https://youtu.be/y3wUt--XFOs", name: "Loop Videos", icon: "youtube" },
    { id: "https://youtu.be/J5qM3xVv7yo", name: "Control the Show from Stage View", icon: "youtube" },
    { id: "https://youtu.be/LVKtNrP2y-Y", name: "Stage View Made Simple", icon: "youtube" },
    { id: "https://youtu.be/Y6Kdmvdc1PM", name: "Customize Companion Buttons for FreeShow & OBS", icon: "youtube" },
    { id: "https://youtu.be/HWN1Mp0bRsM", name: "Use Bitfocus Companion with FreeShow & OBS", icon: "youtube" },
    { id: "https://youtu.be/7_q0zNe7N8o", name: "Best Ways to Use Keynote with FreeShow", icon: "youtube" },
    { id: "https://youtu.be/gM4uqQxHlKg", name: "Setup Audio for Livestream with FreeShow & OBS", icon: "youtube" },
    { id: "https://youtu.be/1FpO7DiA3bs", name: "The Secret Power of Variables", icon: "youtube" },
    { id: "https://youtu.be/aZI25Woh5s4", name: "Organize Your Content Better w/Categories", icon: "youtube" },
    { id: "https://youtu.be/nXAoQ3ADPyE", name: "Setting Up Your Outputs the Right Way", icon: "youtube" },
    { id: "https://youtu.be/61WDOgihjqY", name: "Change the Look of Your Bible Collection Styles", icon: "youtube" },
    { id: "https://youtu.be/HwvZZgncg2U", name: "Show Camera & Scriptures Side-by-Side", icon: "youtube" },
    { id: "https://youtu.be/Siv9jAxRIn4", name: "Best Practices for Using Videos", icon: "youtube" },
    { id: "https://youtu.be/qt52fpuW7Wo", name: "Create a ScoreBoard", icon: "youtube" },
    { id: "https://youtu.be/dsW4FWb4VRs", name: "Change the Look of Your Show", icon: "youtube" },
    { id: "https://youtu.be/yUpwGu7fY64", name: "How to Add Captions", icon: "youtube" },
    { id: "https://youtu.be/wGbSi3cBCTk", name: "How to Play Youtube Videos", icon: "youtube" },
    { id: "https://youtu.be/FDoauL0p-9A", name: "Add Automation", icon: "youtube" },
    { id: "https://youtu.be/6sfXbmCEkww", name: "Overlay Timers", icon: "youtube" },
    { id: "https://youtu.be/3hQDgP4hdZw", name: "How to Add Slide Notes in Freeshow", icon: "youtube" },
    { id: "https://youtu.be/yaBPnKsT8QU", name: "How to Edit Templates", icon: "youtube" },
    { id: "https://youtu.be/7Ykl-E_DIsE", name: "Understanding Media", icon: "youtube" },
    { id: "https://youtu.be/_D7BdZczAwA", name: "Build an Entire Service Presentation", icon: "youtube" },
    { id: "https://youtu.be/c3tTdq3A2eM", name: "Understanding How to Create and Edit Shows", icon: "youtube" },
    { id: "https://youtu.be/7tgpybjHaUg", name: "Customize Scripture Lower-Thirds for Livestream and Service", icon: "youtube" },
    { id: "https://youtu.be/8dnB4Zxuuv8", name: "Understand the Audio Tab", icon: "youtube" },
    { id: "https://youtu.be/nNBLCVvf7B4", name: "How to Use Your ATEM Mini with FreeShow", icon: "youtube" },
    { id: "https://youtu.be/zQXpKic0qCU", name: "How to Make Bigger Scripture Text", icon: "youtube" },
    { id: "https://youtu.be/ZgDWnVK2qGY", name: "How to Import Spanish Bibles", icon: "youtube" },
    { id: "https://youtu.be/Y6RewwgscWU", name: "Blended Screens - Multi-Projector/Monitor Presentation", icon: "youtube" },
    { id: "https://youtu.be/aoILB9x92hA", name: "How to Change Scripture Color", icon: "youtube" },
    { id: "https://youtu.be/Hb60X-QdNrU", name: "Scrolling Text", icon: "youtube" },
    { id: "https://youtu.be/U0FE2ROEHLo", name: "Optimize Performance", icon: "youtube" },
    { id: "https://youtu.be/k3wKUMw5zlY", name: "Scripture Search", icon: "youtube" },
    { id: "https://youtu.be/7VGm5tvq_7I", name: "Use Your Yolobox + FreeShow", icon: "youtube" },
    { id: "https://youtu.be/l-HyJIILaxw", name: "Fixing Glitchy Slide Transitions", icon: "youtube" },
    { id: "https://youtu.be/kN8hoez6bkQ", name: "Understanding OverLays", icon: "youtube" },
    { id: "https://youtu.be/NJdPaHMc8FQ", name: "Download Bibles", icon: "youtube" },
    { id: "https://youtu.be/XUYjbzKHP7U", name: "Zoom with Lower Thirds with FreeShow", icon: "youtube" },
    { id: "https://youtu.be/DGnscG6qzgo", name: "Edit Slides Fast with Quick Timer", icon: "youtube" },
    { id: "https://youtu.be/ikzQwB0r7rc", name: "Cloud Sync", icon: "youtube" },
    { id: "https://youtu.be/o6OFAT-uvpM", name: "Easy Action Shortcuts", icon: "youtube" },
    { id: "https://youtu.be/gukCeIWNBB8", name: "Loop Slides", icon: "youtube" },
    { id: "https://youtu.be/ArLVr_Bsoww", name: "Create and Edit Overlays", icon: "youtube" },
    { id: "https://youtu.be/OxqJ7Z-VvYs", name: "Virtual Outputs", icon: "youtube" },
    { id: "https://youtu.be/Bo2TatjZJf0", name: "Display Multiple Bible Versions at Once", icon: "youtube" },
    { id: "https://youtu.be/mzGclx6C9vY", name: "Multiple Ways to Show Scriptures", icon: "youtube" },
    { id: "https://youtu.be/3hZ9GNUS10s", name: "How to Navigate Scriptures Fast", icon: "youtube" },
    { id: "https://youtu.be/RVqV1nNjqgY", name: "Learn Timer Settings", icon: "youtube" },
    { id: "https://youtu.be/Twh5RlMtXI8", name: "How to Adjust Background Video in Real-time", icon: "youtube" },
    { id: "https://youtu.be/CmSXXyvtVpg", name: "How to Make a Music Playlist", icon: "youtube" },
    { id: "https://youtu.be/iSWum8-52k0", name: "Understanding Output Settings", icon: "youtube" },
    { id: "https://youtu.be/Mz-Vk-fvCqk", name: "Edit Photos", icon: "youtube" }
]

function getFaq() {
    return faq.map(translateAliases)
    // return translateNames(faq)
}

const showActions = [
    // { id: "verse", name: "new.slide", icon: "add", data: { globalGroup: { group: "", color: null, globalGroup: "verse", settings: {}, notes: "", items: [] } } },
    { id: "slide", name: "new.slide", icon: "add", data: { menuClick: "newSlide" }, aliases: ["-Add", "-Add slide"] },
    { id: "layout", name: "show.new_layout", icon: "add" },

    { id: "groups", name: "tools.groups", icon: "groups", data: { toolsTab: "groups" } },
    // { id: "media", name: "tools.media", icon: "media", data: { toolsTab: "media" } },
    { id: "metadata", name: "tools.metadata", icon: "info", data: { toolsTab: "metadata" } },
    { id: "recording", name: "example.recording", icon: "record", data: { toolsTab: "recording" } },
    { id: "notes", name: "tools.notes", icon: "notes", data: { toolsTab: "notes" } },

    { id: "next_timer", name: "popup.next_timer", icon: "clock", data: { popup: "next_timer" } },
    { id: "translate", name: "popup.translate", icon: "translate", data: { popup: "translate" }, aliases: ["-Translate", "-Language"] },

    { id: "grid", name: "show.grid", icon: "grid", data: { view: "grid" } },
    { id: "list", name: "show.list", icon: "list", data: { view: "list" } },
    { id: "lyrics", name: "show.lyrics", icon: "lyrics", data: { view: "lyrics" } },
    { id: "simple", name: "show.simple", icon: "simple", data: { view: "simple" } },
    { id: "groups", name: "show.groups", icon: "groups", data: { view: "groups" } }
]

function getShowActions() {
    const globalGroups = Object.entries(get(groups)).map(([id, group]) => {
        let name = group.name
        if (group.default) name = translateText("groups." + group.name)
        const globalGroup = { group: name, color: group.color || null, globalGroup: id, settings: {}, notes: "", items: [] }
        return { id, name, color: group.color || null, icon: "groups", data: { globalGroup }, aliases: ["-Group"] }
    })

    // templates ?

    return [...translateNames(showActions), ...globalGroups]
}

const editActions = [
    { id: "slide", name: "new.slide", icon: "add", data: { menuClick: "newSlide" }, aliases: ["-Add", "-Add slide"] },

    { id: "textedit", name: "show.text", icon: "text" }

    // edit page specific: chords, dynamic values, conditions
]

function getEditActions() {
    return translateNames(editActions)
}
