// ----- FreeShow -----
// Here are all the global app variables

import { Writable, writable } from "svelte/store"
import type { Bible } from "../types/Bible"
import type { Event } from "../types/Calendar"
import type { Draw, DrawSettings, DrawTools } from "../types/Draw"
import type { ActiveEdit, DefaultProjectNames, Media, MediaOptions, NumberObject, Popups, Selected, SlidesOptions } from "../types/Main"
import type { Folders, Projects, ShowRef } from "../types/Projects"
import type { Dictionary, Styles, Themes } from "../types/Settings"
import type { ID, MidiIn, Overlays, ShowList, Shows, Templates, Timer, Transition } from "../types/Show"
import type { ActiveStage, StageShows } from "../types/Stage"
import type { Categories, Category, DrawerTabs, SettingsTabs, TopViews } from "../types/Tabs"
import type { Outputs } from "./../types/Output"
import type { DrawerTabIds } from "./../types/Tabs"
import type { History } from "./components/helpers/history"

// ----- TEMPORARY VARIABLES -----

// GENERAL
export const version: Writable<string> = writable("0.0.0")
export const currentWindow: Writable<null | "output" | "pdf"> = writable(null)
export const dictionary: Writable<Dictionary> = writable({})
export const saved: Writable<boolean> = writable(true)
export const loaded: Writable<boolean> = writable(true)

// ACTIVE
export const selected: Writable<Selected> = writable({ id: null, data: [] })
export const clipboard: Writable<{ id: null | string; data: any[] }> = writable({ id: null, data: [] })
export const connections: Writable<{ [key: string]: any }> = writable({})
export const activePopup: Writable<null | Popups> = writable(null)
export const activePage: Writable<TopViews> = writable("show")
export const activeShow: Writable<null | ShowRef> = writable(null)
export const activeEdit: Writable<ActiveEdit> = writable({ items: [] })
export const activeStage: Writable<ActiveStage> = writable({ id: null, items: [] })
export const activeDays: Writable<number[]> = writable([])
export const activeTimers: Writable<any[]> = writable([])
export const activeRename: Writable<any> = writable(null)
export const activeDrawerTab: Writable<DrawerTabIds> = writable("shows")
export const settingsTab: Writable<SettingsTabs> = writable("general")
export const projectView: Writable<boolean> = writable(false)
export const eventEdit: Writable<null | string> = writable(null)
export const globalGroupViewEnabled: Writable<boolean> = writable(false)

// AUDIO
export const audioChannels: Writable<{ left: number; right: number }> = writable({ left: 0, right: 0 })
export const playingAudio: Writable<{ [key: string]: any }> = writable({})
export const playingVideos: Writable<any[]> = writable([])

// DRAW
export const drawTool: Writable<DrawTools> = writable("focus")
export const draw: Writable<null | Draw> = writable(null)
export const paintCache: Writable<any[]> = writable([])

// OUTPUTS
export const outputDisplay: Writable<boolean> = writable(false)
export const currentOutputSettings: Writable<string | null> = writable(null)
export const slideTimers: Writable<{ [key: string]: any }> = writable({})

// EXPORT
export const exportOptions: Writable<any> = writable({ pdf: { rows: 5, columns: 2, slide: true, text: true } })

// CACHE
export const sortedShowsList: Writable<ShowList[]> = writable([])
export const cachedShowsData: Writable<any> = writable({})

// OTHER
export const notFound: Writable<any> = writable({ show: [], bible: [] })
export const toastMessages: Writable<string[]> = writable([])
export const alertMessage: Writable<string> = writable("")
export const popupData: Writable<any> = writable({})
export const systemFonts: Writable<string[]> = writable([])
export const previousShow: Writable<any> = writable(null)
export const projectToolSize: Writable<number> = writable(150)
export const forceClock: Writable<boolean> = writable(false)
export const lastSavedCache: Writable<any> = writable(null)
export const playScripture: Writable<boolean> = writable(false)

// ----- SAVED VARIABLES -----

// GENERAL
export const os: Writable<any> = writable({ platform: "", name: "Computer" }) // get os

// HISTORY
export const undoHistory: Writable<History[]> = writable([])
export const redoHistory: Writable<History[]> = writable([])
export const historyCacheCount: Writable<number> = writable(250)

// SHOW
export const shows: Writable<any> = writable({}) // {default}
export const showsCache: Writable<Shows> = writable({}) // {default}
export const textCache: Writable<any> = writable({}) // {}
export const groups: Writable<any> = writable({}) // {default}
export const categories: Writable<Categories> = writable({}) // {default}
export const transitionData: Writable<{ text: Transition; media: Transition }> = writable({
    text: { type: "fade", duration: 500, easing: "sine" },
    media: { type: "fade", duration: 800, easing: "sine" },
}) // {default}
export const slidesOptions: Writable<SlidesOptions> = writable({ columns: 4, mode: "grid" }) // {default}

// PROJECT
export const openedFolders: Writable<ID[]> = writable([]) // []
export const activeProject: Writable<null | ID> = writable(null) // null
export const projects: Writable<Projects> = writable({}) // {default}
export const folders: Writable<Folders> = writable({}) // {default}

// TIMERS
export const timers: Writable<{ [key: string]: Timer }> = writable({}) // {}

// MEDIA
export const media: Writable<Media> = writable({}) // {}
export const mediaFolders: Writable<Categories> = writable({}) // {default}
export const mediaCache: Writable<any> = writable({}) // {}

// OVERLAYS
export const overlayCategories: Writable<Categories> = writable({}) // {default}
export const overlays: Writable<Overlays> = writable({}) // {default}

// AUDIO
export const audioFolders: Writable<Categories> = writable({}) // {default}
export const volume: Writable<number> = writable(100) // 100

// PLAYER
export const playerVideos: Writable<Categories> = writable({}) // {default}

// WEB (WIP)
export const webFavorites: Writable<Categories> = writable({
    youtube: { name: "YouTube", icon: "web", url: "https://youtube.com/" },
    google: { name: "Google", icon: "web", url: "https://google.com/" },
    example: { name: "Example", icon: "web", url: "https://example.com/" },
})

// TEMPLATES
export const templateCategories: Writable<Categories> = writable({}) // {default}
export const templates: Writable<Templates> = writable({}) // {default}

// CALENDAR
export const events: Writable<{ [key: string]: Event }> = writable({}) // {}

// DRAW
export const drawSettings: Writable<DrawSettings> = writable({}) // {}

// STAGE
export const stageShows: Writable<StageShows> = writable({}) // {default}

// SCRIPTURE
interface BibleCategories extends Category {
    api?: boolean
    collection?: {
        versions: string[]
    }
}
export const scriptures: Writable<{ [key: string]: BibleCategories }> = writable({}) // {default}
export const scripturesCache: Writable<{ [key: string]: Bible }> = writable({}) // {}
export const scriptureSettings: Writable<any> = writable({ template: "scripture", versesPerSlide: 3, verseNumbers: false, showVersion: false, showVerse: true }) // {default}

// DRAWER
export const drawerTabsData: Writable<DrawerTabs> = writable({}) // {default}
export const drawer: Writable<{ height: number; stored: null | number }> = writable({ height: 300, stored: null }) // {default}
export const mediaOptions: Writable<MediaOptions> = writable({ columns: 5, mode: "grid" }) // {default}

// OTHER
export const resized: Writable<NumberObject> = writable({ leftPanel: 300, rightPanel: 300, leftPanelDrawer: 300, rightPanelDrawer: 300 }) // {default}
export const exportPath: Writable<null | string> = writable(null) // null

// SETTINGS
export const language: Writable<string> = writable("en") // get locale
export const timeFormat: Writable<string> = writable("24") // "24"
export const alertUpdates: Writable<boolean> = writable(true) // true
export const autoOutput: Writable<boolean> = writable(false) // false
export const labelsDisabled: Writable<boolean> = writable(false) // false
export const groupNumbers: Writable<boolean> = writable(true) // true
export const fullColors: Writable<boolean> = writable(true) // true
export const formatNewShow: Writable<boolean> = writable(true) // true
export const splitLines: Writable<number> = writable(0) // 0
export const showsPath: Writable<null | string> = writable(null) // null

// THEME
export const theme: Writable<string> = writable("default") // "default"
export const themes: Writable<{ [key: string]: Themes }> = writable({}) // {default}

// STYLES
export const styles: Writable<{ [key: string]: Styles }> = writable({})

// OUTPUTS
export const outputs: Writable<Outputs> = writable({}) // {default}
export const outLocked: Writable<boolean> = writable(false) // false

// MIDI
export const midiIn: Writable<{ [key: string]: MidiIn }> = writable({})

// CONNECTIONS
export const ports: Writable<any> = writable({ remote: 5510, stage: 5511, controller: 5512 }) // {default}
export const maxConnections: Writable<number> = writable(10) // 10
export const remotePassword: Writable<string> = writable("1234") // generate 4 numbers

// HIDDEN
export const defaultProjectName: Writable<DefaultProjectNames> = writable("date") // "date"
export const presenterControllerKeys: Writable<boolean> = writable(true) // true
export const videoExtensions: Writable<string[]> = writable(["mp4", "mov", "wmv", "avi", "avchd", "flv", "mkv", "webm", "mpeg", "m4v"]) // [default]
export const imageExtensions: Writable<string[]> = writable(["tif", "tiff", "bmp", "jpg", "jpeg", "gif", "png", "eps", "jfif", "webp"]) // [default]
export const audioExtensions: Writable<string[]> = writable(["mp3", "wav", "m4a", "flac", "wma", "aac", "ogg", "weba", "aiff"])

// CLOUD
export const driveKeys: Writable<any> = writable({})
export const driveData: Writable<any> = writable({ mainFolderId: null, disabled: false, initializeMethod: null, disableUpload: false })

// ----- STORES LIST -----

// export all stores as object for easy calling
export type StoreKey = keyof typeof $
export const $ = {
    version,
    currentWindow,
    dictionary,
    saved,
    selected,
    clipboard,
    connections,
    activePopup,
    activePage,
    activeShow,
    activeEdit,
    activeStage,
    activeDays,
    activeTimers,
    activeRename,
    activeDrawerTab,
    settingsTab,
    projectView,
    eventEdit,
    audioChannels,
    playingAudio,
    playingVideos,
    drawTool,
    draw,
    paintCache,
    outputDisplay,
    currentOutputSettings,
    slideTimers,
    exportOptions,
    notFound,
    alertMessage,
    systemFonts,
    previousShow,
    projectToolSize,
    forceClock,
    os,
    undoHistory,
    redoHistory,
    shows,
    showsCache,
    textCache,
    groups,
    categories,
    transitionData,
    slidesOptions,
    openedFolders,
    activeProject,
    projects,
    folders,
    timers,
    media,
    mediaFolders,
    mediaCache,
    overlayCategories,
    overlays,
    audioFolders,
    volume,
    playerVideos,
    webFavorites,
    templateCategories,
    templates,
    events,
    drawSettings,
    stageShows,
    scriptures,
    scripturesCache,
    scriptureSettings,
    drawerTabsData,
    drawer,
    mediaOptions,
    resized,
    exportPath,
    language,
    timeFormat,
    alertUpdates,
    autoOutput,
    labelsDisabled,
    groupNumbers,
    fullColors,
    formatNewShow,
    splitLines,
    showsPath,
    theme,
    themes,
    outputs,
    outLocked,
    ports,
    maxConnections,
    remotePassword,
    defaultProjectName,
    presenterControllerKeys,
    videoExtensions,
    imageExtensions,
    audioExtensions,
}
