import { get } from "svelte/store"
import {
    activeEdit,
    activePage,
    activePopup,
    activeProject,
    activeShow,
    activeStage,
    activeStyle,
    companion,
    currentOutputSettings,
    disabledServers,
    focusMode,
    outputs,
    overlays,
    projects,
    projectView,
    quickSearchActive,
    refreshEditSlide,
    settingsTab,
    showRecentlyUsedProjects,
    sortedShowsList,
    stageShows,
    styles,
} from "../../stores"
import { triggerFunction } from "../../utils/common"
import { translate } from "../../utils/language"
import { showSearch } from "../../utils/search"
import { sortByClosestMatch } from "../actions/apiHelper"
import { menuClick } from "../context/menuClick"
import { openDrawer } from "../edit/scripts/edit"
import { keysToID } from "../helpers/array"

interface QuickSearchValue {
    type: keyof typeof actions
    icon?: string
    id: string
    name: string
    description?: string
}

const MAX_RESULTS = 10
export function quicksearch(searchValue: string) {
    const values: QuickSearchValue[] = []
    const shouldReturn = () => values.length >= MAX_RESULTS
    const trimValues = () => values.slice(0, MAX_RESULTS)
    const sort = (array: any[]) => sortByClosestMatch(array, searchValue)

    // outputs
    addValues(sort(keysToID(get(outputs))), "settings_output", "display_settings")
    if (shouldReturn()) return trimValues()

    // styles
    addValues(sort(keysToID(get(styles))), "settings_styles", "styles")
    if (shouldReturn()) return trimValues()

    // stage layouts
    addValues(sort(keysToID(get(stageShows))), "stage_layout", "stage")
    if (shouldReturn()) return trimValues()

    // overlays
    addValues(sort(keysToID(get(overlays))), "overlay", "overlays")
    if (shouldReturn()) return trimValues()

    // projects
    addValues(sort(keysToID(get(projects))), "project", "project")
    if (shouldReturn()) return trimValues()

    // drawer submenus
    addValues(sort(getDrawerSubmenus()), "drawer_submenu")
    if (shouldReturn()) return trimValues()

    // menu bar
    addValues(sort(getMenubarItems()), "context_menu")
    if (shouldReturn()) return trimValues()

    // connections
    addValues(sort(connectionsList), "settings_connection", "connection")
    if (shouldReturn()) return trimValues()

    // shows
    const shows = showSearch(searchValue, get(sortedShowsList))
    addValues(shows, "show", "slide")

    return trimValues()

    function addValues(items: any[], type: keyof typeof actions, icon = "") {
        const newValues: QuickSearchValue[] = items.map((a) => ({ type, icon: a.icon || icon, id: a.id, name: a.name }))
        values.push(...newValues)
    }
}

const actions = {
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
        }
    },
    project: (id: string) => {
        showRecentlyUsedProjects.set(false)
        activeProject.set(id)
        projectView.set(false)
        activePage.set("show")
    },
    drawer_submenu: (id: string) => {
        openDrawer(id)
    },
    context_menu: (id: string) => {
        menuClick(id)
    },
    settings_connection: (id: string) => {
        enableConnection(id)

        settingsTab.set("connection")
        activePage.set("settings")

        activePopup.set(null)
        // let popup close first
        setTimeout(() => triggerFunction("open_connection_" + id), 110)
    },
    show: (id: string) => {
        const newShow: any = { id, type: "show" }
        activeShow.set(newShow)

        // ShowButton.svelte
        // if (type === "image" || type === "video") activeEdit.set({ id, type: "media", items: [] })
        if (get(activeEdit).id) activeEdit.set({ type: "show", slide: 0, items: [], showId: get(activeShow)?.id })

        if (get(activePage) === "edit") refreshEditSlide.set(true)
        else activePage.set("show")
    },
}

export function selectQuicksearchValue(value: QuickSearchValue) {
    if (!actions[value.type]) {
        console.error("Unknown Quick search type:", value.type)
        return
    }

    if (get(focusMode)) focusMode.set(false)
    quickSearchActive.set(false)

    actions[value.type](value.id)
}

// HELPERS

const translateNames = (array: any[]) => array.map((a) => ({ ...a, name: translate(a.name) }))

const connectionsList = [
    { id: "remote", name: "RemoteShow" },
    { id: "stage", name: "StageShow" },
    { id: "controller", name: "ControlShow" },
    { id: "output_stream", name: "OutputShow" },
    { id: "companion", name: "API" },
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

const menubarItems = [
    { id: "import", name: "actions.import", icon: "import" },
    { id: "export_more", name: "actions.export", icon: "export" },
    { id: "history", name: "popup.history", icon: "history" },
    { id: "shortcuts", name: "popup.shortcuts", icon: "shortcut" },
    { id: "about", name: "popup.about", icon: "info" },
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
    // functions
    { id: "actions", name: "tabs.actions", icon: "actions" },
    { id: "timer", name: "tabs.timers", icon: "timer" },
    { id: "variables", name: "tabs.variables", icon: "variable" },
    { id: "triggers", name: "tabs.triggers", icon: "trigger" },
]

function getDrawerSubmenus() {
    // WIP categories etc.?
    return translateNames(drawerSubmenus)
}
