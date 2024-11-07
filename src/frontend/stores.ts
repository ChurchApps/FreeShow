// ----- FreeShow -----
// Here are all the global app variables

import { Writable, writable } from "svelte/store"
import type { Bible } from "../types/Bible"
import type { Event } from "../types/Calendar"
import type { Draw, DrawSettings, DrawTools } from "../types/Draw"
import type { ActiveEdit, Media, MediaOptions, NumberObject, Popups, Selected, SlidesOptions } from "../types/Main"
import type { Folders, Projects, ShowRef } from "../types/Projects"
import type { Dictionary, Styles, Themes } from "../types/Settings"
import type { ID, MidiIn, Overlays, ShowList, Shows, Templates, Timer, Transition } from "../types/Show"
import type { ActiveStage, StageLayouts } from "../types/Stage"
import type { BibleCategories, Categories, DrawerTabs, SettingsTabs, TopViews } from "../types/Tabs"
import type { Channels, Playlist } from "./../types/Audio"
import type { Outputs } from "./../types/Output"
import type { DrawerTabIds } from "./../types/Tabs"
import type { API_metronome } from "./components/actions/api"
import type { History } from "./components/helpers/history"

// ----- TEMPORARY VARIABLES -----

// GENERAL
export const version: Writable<string> = writable("0.0.0")
export const currentWindow: Writable<null | "output" | "pdf"> = writable(null)
export const dictionary: Writable<Dictionary> = writable({})
export const saved: Writable<boolean> = writable(true)
export const loaded: Writable<boolean> = writable(false)
export const loadedState: Writable<string[]> = writable([])
export const isDev: Writable<boolean> = writable(false)
export const windowState: Writable<any> = writable({})

// ACTIVE
export const selected: Writable<Selected> = writable({ id: null, data: [] })
export const clipboard: Writable<{ id: null | string; data: any[] }> = writable({ id: null, data: [] })
export const connections: Writable<{ [key: string]: any }> = writable({})
export const activePopup: Writable<null | Popups> = writable(null)
export const activePage: Writable<TopViews> = writable("show")
export const contextActive: Writable<boolean> = writable(false)
export const topContextActive: Writable<boolean> = writable(false)
export const quickSearchActive: Writable<boolean> = writable(false)
export const focusMode: Writable<boolean> = writable(false)
export const activeFocus: Writable<{ id: string; index?: number }> = writable({ id: "" })
export const activeShow: Writable<null | ShowRef> = writable(null)
export const activeEdit: Writable<ActiveEdit> = writable({ items: [] })
export const activeStage: Writable<ActiveStage> = writable({ id: null, items: [] })
export const activeTimers: Writable<any[]> = writable([])
export const activeRename: Writable<any> = writable(null)
export const activeDrawerTab: Writable<DrawerTabIds> = writable("shows")
export const activeDrawerOnlineTab: Writable<string> = writable("youtube")
export const activeStyle: Writable<string> = writable("")
export const settingsTab: Writable<SettingsTabs> = writable("general")
export const projectView: Writable<boolean> = writable(false)
export const showRecentlyUsedProjects: Writable<boolean> = writable(true)
export const globalGroupViewEnabled: Writable<boolean> = writable(false)
export const activeRecording: Writable<any> = writable(null)
export const currentRecordingStream: Writable<any> = writable(null)
export const focusedArea: Writable<string> = writable("")
export const activeAnimate: Writable<any> = writable({ slide: -1, index: -1 })
export const allOutputs: Writable<Outputs> = writable({}) // stage data in output windows
export const activeScripture: Writable<any> = writable({})
export const activeTagFilter: Writable<string[]> = writable([])
export const activeTriggerFunction: Writable<string> = writable("")
export const guideActive: Writable<boolean> = writable(false)
export const runningActions: Writable<string[]> = writable([])
export const activeSlideRecording: Writable<any> = writable(null)

// CALENDAR
export const activeDays: Writable<number[]> = writable([])
export const eventEdit: Writable<null | string> = writable(null)
export const nextActionEventStart: Writable<any> = writable({})
export const nextActionEventPaused: Writable<boolean> = writable(false)

// AUDIO
export const audioChannels: Writable<Channels> = writable({})
export const playingAudio: Writable<{ [key: string]: any }> = writable({})
export const playingVideos: Writable<any[]> = writable([])
export const activePlaylist: Writable<any> = writable(null)
export const playingMetronome: Writable<any> = writable(null)
export const visualizerData: Writable<any> = writable(null)

// DRAW
export const drawTool: Writable<DrawTools> = writable("focus")
export const draw: Writable<null | Draw> = writable(null)
export const paintCache: Writable<any[]> = writable([])

// OUTPUTS
export const outputDisplay: Writable<boolean> = writable(false)
export const currentOutputSettings: Writable<string | null> = writable(null)
export const slideTimers: Writable<{ [key: string]: any }> = writable({})
export const outputCache: Writable<any> = writable(null)
export const outputSlideCache: Writable<any> = writable({})
export const previewBuffers: Writable<any> = writable({})
export const ndiData: Writable<any> = writable({})
export const closeAd: Writable<boolean> = writable(false)
export const videosData: Writable<any> = writable({})
export const videosTime: Writable<any> = writable({})
export const textLoaded: Writable<boolean> = writable(false)
export const toggleOutputEnabled: Writable<boolean> = writable(false)
export const customMessageCredits: Writable<string> = writable("")
export const presentationData: Writable<any> = writable({})
export const presentationApps: Writable<null | string[]> = writable(null)
export const colorbars: Writable<string> = writable("")

// EXPORT
export const exportOptions: Writable<any> = writable({ pdf: { rows: 5, columns: 2, slide: true, text: true } })

// CACHE
export const sortedShowsList: Writable<ShowList[]> = writable([])
export const cachedShowsData: Writable<any> = writable({})
export const quickTextCache: Writable<string> = writable("")
export const loadedMediaThumbnails: Writable<{ [key: string]: string }> = writable({})
export const tempPath: Writable<string> = writable("")
export const scriptureHistory: Writable<any[]> = writable([])
export const fontData: Writable<any> = writable({})

// EDIT
export const editHistory: Writable<any[]> = writable([])
export const refreshEditSlide: Writable<boolean> = writable(false)
export const refreshListBoxes: Writable<number> = writable(-1)
export const triggerAutoSplit: Writable<boolean> = writable(false)
export const storedEditMenuState: Writable<any> = writable({})
export const copyPasteEdit: Writable<any> = writable({})

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
export const openScripture: Writable<any> = writable(null)
export const deletedShows: Writable<any[]> = writable([])
export const renamedShows: Writable<any[]> = writable([])
export const selectAllMedia: Writable<boolean> = writable(false)
export const openToolsTab: Writable<string> = writable("")
export const refreshSlideThumbnails: Writable<boolean> = writable(false)
export const contextData: Writable<any> = writable({})
export const lessonsLoaded: Writable<any> = writable({})
export const storedChordsData: Writable<any> = writable({})
export const photoApiCredits: Writable<any> = writable({})
export const errorHasOccured: Writable<boolean> = writable(false)

// ----- SAVED VARIABLES -----

// GENERAL
export const os: Writable<any> = writable({ platform: "", name: "Computer" }) // get os
export const deviceId: Writable<string> = writable("")

// HISTORY
export const undoHistory: Writable<History[]> = writable([])
export const redoHistory: Writable<History[]> = writable([])
export const historyCacheCount: Writable<number> = writable(250)
export const usageLog: Writable<any> = writable({ all: [] })

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
export const globalTags: Writable<{ [key: string]: { name: string; color: string } }> = writable({}) // {}

// PROJECT
export const openedFolders: Writable<ID[]> = writable([]) // []
export const activeProject: Writable<null | ID> = writable(null) // null
export const projects: Writable<Projects> = writable({}) // {default}
export const folders: Writable<Folders> = writable({}) // {default}

// TIMERS
export const timers: Writable<{ [key: string]: Timer }> = writable({}) // {}

// VARIABLES
export const variables: Writable<{ [key: string]: any }> = writable({}) // {}

// TRIGGERS
export const triggers: Writable<{ [key: string]: any }> = writable({}) // {}

// MEDIA
export const media: Writable<Media> = writable({}) // {}
export const mediaFolders: Writable<Categories> = writable({}) // {default}
export const videoMarkers: Writable<{ [key: string]: { name: string; time: number }[] }> = writable({}) // {}
export const checkedFiles: Writable<any[]> = writable([])

// OVERLAYS
export const overlayCategories: Writable<Categories> = writable({}) // {default}
export const overlays: Writable<Overlays> = writable({}) // {default}

// AUDIO
export const audioFolders: Writable<Categories> = writable({}) // {default}
export const audioStreams: Writable<any> = writable({}) // {}
export const audioPlaylists: Writable<{ [key: string]: Playlist }> = writable({}) // {}
export const volume: Writable<number> = writable(1) // 1
export const gain: Writable<number> = writable(1) // 1
export const metronome: Writable<API_metronome> = writable({}) // {}

// PLAYER
export const playerVideos: Writable<Categories> = writable({}) // {default}

// TEMPLATES
export const templateCategories: Writable<Categories> = writable({}) // {default}
export const templates: Writable<Templates> = writable({}) // {default}

// CALENDAR
export const events: Writable<{ [key: string]: Event }> = writable({}) // {}
export const calendarAddShow: Writable<string> = writable("") // ""

// DRAW
export const drawSettings: Writable<DrawSettings> = writable({}) // {}

// STAGE
export const stageShows: Writable<StageLayouts> = writable({}) // {default}

// SCRIPTURE
export const scriptures: Writable<{ [key: string]: BibleCategories }> = writable({}) // {default}
export const scripturesCache: Writable<{ [key: string]: Bible }> = writable({}) // {}
export const scriptureSettings: Writable<any> = writable({ template: "scripture", versesPerSlide: 3, verseNumbers: false, showVersion: false, showVerse: true, referenceDivider: ":" }) // {default}
export const bibleApiKey: Writable<string> = writable("") // ""

// DRAWER
export const drawerTabsData: Writable<DrawerTabs> = writable({}) // {default}
export const drawer: Writable<{ height: number; stored: null | number }> = writable({ height: 300, stored: null }) // {default}
export const mediaOptions: Writable<MediaOptions> = writable({ columns: 5, mode: "grid" }) // {default}

// OTHER
export const resized: Writable<NumberObject> = writable({ leftPanel: 290, rightPanel: 290, leftPanelDrawer: 290, rightPanelDrawer: 290 }) // {default}
export const sorted: Writable<any> = writable({}) // {}
export const dataPath: Writable<string> = writable("") // ""
export const lockedOverlays: Writable<string[]> = writable([]) // []
export const special: Writable<any> = writable({}) // {}

// SETTINGS
export const language: Writable<string> = writable("en") // get locale
export const autosave: Writable<string> = writable("never") // "never"
export const timeFormat: Writable<string> = writable("24") // "24"
export const alertUpdates: Writable<boolean> = writable(true) // true
export const autoOutput: Writable<boolean> = writable(false) // false
export const labelsDisabled: Writable<boolean> = writable(false) // false
export const groupNumbers: Writable<boolean> = writable(true) // true
export const fullColors: Writable<boolean> = writable(false) // false
export const formatNewShow: Writable<boolean> = writable(false) // false
export const splitLines: Writable<number> = writable(0) // 0
export const showsPath: Writable<null | string> = writable(null) // null
export const customizedIcons: Writable<any> = writable({ disabled: [], svg: [] }) // {disabled: [], svg: []}

// THEME
export const theme: Writable<string> = writable("default") // "default"
export const themes: Writable<{ [key: string]: Themes }> = writable({}) // {default}

// STYLES
export const styles: Writable<{ [key: string]: Styles }> = writable({}) // {}

// OUTPUTS
export const outputs: Writable<Outputs> = writable({}) // {default}
export const outLocked: Writable<boolean> = writable(false) // false

// MIDI
// this is repurposed as "actions"
export const midiIn: Writable<{ [key: string]: MidiIn }> = writable({}) // {}

// CONNECTIONS
export const ports: Writable<any> = writable({ remote: 5510, stage: 5511, controller: 5512, output_stream: 5513 }) // {default}
export const disabledServers: Writable<any> = writable({ remote: false, stage: false, controller: true, output_stream: true }) // {}
export const serverData: Writable<any> = writable({}) // {}
export const maxConnections: Writable<number> = writable(10) // 10
export const remotePassword: Writable<string> = writable("1234") // generate 4 numbers
export const companion: Writable<any> = writable({ enabled: false }) // {}

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
    visualizerData,
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
    variables,
    media,
    mediaFolders,
    overlayCategories,
    overlays,
    audioFolders,
    volume,
    playerVideos,
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
    dataPath,
    special,
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
    styles,
    outLocked,
    ports,
    maxConnections,
    remotePassword,
}

// DEBUG STORE UPDATES
const debugStores = false
let updates: any = {}
if (debugStores) startSubscriptions()
function startSubscriptions() {
    Object.entries($).forEach(([key, store]) => {
        store.subscribe(() => {
            if (!updates[key]) updates[key] = 0
            updates[key]++

            // first update is initializing empty store, second update sets saved value
            if (updates[key] > 2) console.trace("STORE UPDATE:", key, updates[key])
        })
    })
}
