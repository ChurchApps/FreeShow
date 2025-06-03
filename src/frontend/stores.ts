// ----- FreeShow -----
// Here are all the global app variables

import type { Family } from "css-fonts"
import type { ICommonTagsResult } from "music-metadata"
import { type Writable, writable } from "svelte/store"
import type { Bible } from "../types/Bible"
import type { Event } from "../types/Calendar"
import type { Draw, DrawLine, DrawSettings, DrawTools } from "../types/Draw"
import type { Effects } from "../types/Effects"
import type { History, HistoryNew } from "../types/History"
import type { ActiveEdit, Clipboard, Media, MediaOptions, NumberObject, OS, Popups, Selected, SlidesOptions, Trigger, Variable } from "../types/Main"
import type { Folders, Projects, ShowRef } from "../types/Projects"
import type { Dictionary, Styles, Themes } from "../types/Settings"
import type { Action, Emitter, ID, Overlays, ShowGroups, ShowList, Shows, ShowType, SlideTimer, Tag, Templates, Timer, Transition, TrimmedShows } from "../types/Show"
import type { ServerData } from "../types/Socket"
import type { ActiveStage, StageLayouts } from "../types/Stage"
import type { BibleCategories, Categories, DrawerTabs, SettingsTabs, TopViews } from "../types/Tabs"
import type { AudioChannel, AudioStream, Playlist } from "./../types/Audio"
import type { Outputs } from "./../types/Output"
import type { DrawerTabIds } from "./../types/Tabs"
import type { AudioData } from "./audio/audioPlayer"
import type { API_metronome } from "./components/actions/api"

// ----- TEMPORARY VARIABLES -----

// GENERAL
export const os: Writable<OS> = writable({ platform: "win32", name: "", arch: "" })
export const deviceId: Writable<string> = writable("")
export const version: Writable<string> = writable("0.0.0")
export const currentWindow: Writable<null | "output" | "pdf"> = writable(null)
export const localeDirection: Writable<"rtl" | "ltr"> = writable("ltr")
export const dictionary: Writable<Dictionary> = writable({})
export const saved: Writable<boolean> = writable(true)
export const loaded: Writable<boolean> = writable(false)
export const loadedState: Writable<string[]> = writable([])
export const isDev: Writable<boolean> = writable(false)
export const windowState: Writable<any> = writable({})

// ACTIVE
export const selected: Writable<Selected> = writable({ id: null, data: [] })
export const clipboard: Writable<Clipboard> = writable({ id: null, data: [] })
export const connections: Writable<{ [key: string]: { [key: string]: { entered?: boolean; active?: string } } }> = writable({})
export const activePopup: Writable<null | Popups> = writable(null)
export const activePage: Writable<TopViews> = writable("show")
export const contextActive: Writable<boolean> = writable(false)
export const topContextActive: Writable<boolean> = writable(false)
export const quickSearchActive: Writable<boolean> = writable(false)
export const focusMode: Writable<boolean> = writable(false)
export const activeFocus: Writable<{ id: string; index?: number; type?: ShowType }> = writable({ id: "" })
export const activeShow: Writable<null | ShowRef> = writable(null)
export const activeEdit: Writable<ActiveEdit> = writable({ items: [] })
export const activeStage: Writable<ActiveStage> = writable({ id: null, items: [] })
export const activeTimers: Writable<any[]> = writable([])
export const activeRename: Writable<any> = writable(null)
export const activeDrawerTab: Writable<DrawerTabIds> = writable("shows")
export const drawerOpenedInEdit: Writable<boolean> = writable(false)
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
export const activeTriggerFunction: Writable<string> = writable("")
export const guideActive: Writable<boolean> = writable(false)
export const runningActions: Writable<string[]> = writable([])
export const activeSlideRecording: Writable<any> = writable(null)
export const pcoConnected: Writable<boolean> = writable(false)
export const chumsConnected: Writable<boolean> = writable(false)
export const chumsSyncCategories: Writable<string[]> = writable([])

// TAGS
export const activeTagFilter: Writable<string[]> = writable([])
export const activeMediaTagFilter: Writable<string[]> = writable([])
export const activeActionTagFilter: Writable<string[]> = writable([])
export const activeVariableTagFilter: Writable<string[]> = writable([])

// CALENDAR
export const activeDays: Writable<number[]> = writable([])
export const eventEdit: Writable<null | string> = writable(null)
export const nextActionEventStart: Writable<any> = writable({})
export const nextActionEventPaused: Writable<boolean> = writable(false)

// AUDIO
export const audioChannels: Writable<AudioChannel[]> = writable([])
export const playingAudio: Writable<{ [key: string]: AudioData }> = writable({})
export const playingAudioPaths: Writable<string[]> = writable([])
export const playingVideos: Writable<any[]> = writable([])
export const activePlaylist: Writable<any> = writable(null)
export const playingMetronome: Writable<boolean> = writable(false)
export const visualizerData: Writable<any> = writable(null)
export const isFadingOut: Writable<any> = writable(false)

// DRAW
export const drawTool: Writable<DrawTools> = writable("focus")
export const draw: Writable<null | Draw> = writable(null)
export const paintCacheSlide: Writable<{ [key: string]: DrawLine[] }> = writable({})
export const paintCache: Writable<DrawLine[]> = writable([])

// OUTPUTS
export const outputDisplay: Writable<boolean> = writable(false)
export const currentOutputSettings: Writable<string | null> = writable(null)
export const slideTimers: Writable<{ [key: string]: SlideTimer }> = writable({})
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
export const overlayTimers: Writable<{ [key: string]: { outputId: string; overlayId: string; timer: NodeJS.Timeout } }> = writable({})

// EXPORT
export const exportOptions: Writable<any> = writable({ pdf: { rows: 5, columns: 2, slide: true, text: true } })

// CACHE
export const sortedShowsList: Writable<ShowList[]> = writable([])
export const cachedShowsData: Writable<any> = writable({})
export const quickTextCache: Writable<string> = writable("")
export const loadedMediaThumbnails: Writable<{ [key: string]: string }> = writable({})
export const tempPath: Writable<string> = writable("")
export const scriptureHistory: Writable<any[]> = writable([])
export const actionHistory: Writable<{ action: string; data: any; time: number; count: number }[]> = writable([])
export const audioData: Writable<{ [key: string]: { metadata: ICommonTagsResult } }> = writable({})

// EDIT
export const editColumns: Writable<number> = writable(1)
export const editHistory: Writable<any[]> = writable([])
export const refreshEditSlide: Writable<boolean> = writable(false)
export const refreshListBoxes: Writable<number> = writable(-1)
export const triggerAutoSplit: Writable<boolean> = writable(false)
export const storedEditMenuState: Writable<any> = writable({})
export const copyPasteEdit: Writable<any> = writable({})
export const textEditActive: Writable<boolean> = writable(false)
export const includeEmptySlides: Writable<boolean> = writable(false)
export const textEditZoom: Writable<number> = writable(10)
export const spellcheck: Writable<{ misspelled: string; suggestions: string[] } | null> = writable(null)

// OTHER
export const notFound: Writable<any> = writable({ show: [], bible: [] })
export const toastMessages: Writable<string[]> = writable([])
export const alertMessage: Writable<string> = writable("")
export const popupData: Writable<any> = writable({})
export const systemFonts: Writable<Family[]> = writable([])
export const previousShow: Writable<any> = writable(null)
export const projectToolSize: Writable<number> = writable(150)
export const forceClock: Writable<boolean> = writable(false)
export const lastSavedCache: Writable<any> = writable(null)
export const playScripture: Writable<boolean> = writable(false)
export const openScripture: Writable<any> = writable(null)
export const deletedShows: Writable<{ name: string; id: string }[]> = writable([])
export const renamedShows: Writable<{ id: string; name: string; oldName: string }[]> = writable([])
export const selectAllMedia: Writable<boolean> = writable(false)
export const selectAllAudio: Writable<boolean> = writable(false)
export const openToolsTab: Writable<string> = writable("")
export const refreshSlideThumbnails: Writable<boolean> = writable(false)
export const contextData: Writable<any> = writable({})
export const lessonsLoaded: Writable<any> = writable({})
export const storedChordsData: Writable<any> = writable({})
export const photoApiCredits: Writable<any> = writable({})
export const errorHasOccured: Writable<boolean> = writable(false)
export const disableDragging: Writable<boolean> = writable(false)
export const activeDropId: Writable<string> = writable("")
export const randomNumberVariable: Writable<{ [key: string]: boolean }> = writable({})
export const dynamicValueData: Writable<{ [key: string]: any }> = writable({})

// ----- SAVED VARIABLES -----

// HISTORY
export const undoHistory: Writable<(History | HistoryNew)[]> = writable([])
export const redoHistory: Writable<(History | HistoryNew)[]> = writable([])
export const historyCacheCount: Writable<number> = writable(250)
export const usageLog: Writable<any> = writable({ all: [] })

// SHOW
export const shows: Writable<TrimmedShows> = writable({}) // {default}
export const showsCache: Writable<Shows> = writable({}) // {default}
export const textCache: Writable<any> = writable({}) // {}
export const groups: Writable<ShowGroups> = writable({}) // {default}
export const categories: Writable<Categories> = writable({}) // {default}
export const transitionData: Writable<{ text: Transition; media: Transition }> = writable({
    text: { type: "fade", duration: 500, easing: "sine" },
    media: { type: "fade", duration: 800, easing: "sine" }
}) // {default}
export const slidesOptions: Writable<SlidesOptions> = writable({ columns: 4, mode: "grid" }) // {default}
export const customMetadata: Writable<{ disabled: string[]; custom: string[] }> = writable({ disabled: [], custom: [] }) // {disabled: [], custom: []}

// PROJECT
export const openedFolders: Writable<ID[]> = writable([]) // []
export const activeProject: Writable<null | ID> = writable(null) // null
export const projects: Writable<Projects> = writable({}) // {default}
export const projectTemplates: Writable<Projects> = writable({}) // {}
export const folders: Writable<Folders> = writable({}) // {default}

// TIMERS
export const timers: Writable<{ [key: string]: Timer }> = writable({}) // {}

// VARIABLES
export const variables: Writable<{ [key: string]: Variable }> = writable({}) // {}

// TRIGGERS
export const triggers: Writable<{ [key: string]: Trigger }> = writable({}) // {}

// MEDIA
export const media: Writable<Media> = writable({}) // {}
export const mediaFolders: Writable<Categories> = writable({}) // {default}
export const videoMarkers: Writable<{ [key: string]: { name: string; time: number }[] }> = writable({}) // {}
export const checkedFiles: Writable<any[]> = writable([])
export const effects: Writable<Effects> = writable({
    // DEBUG
    test: {
        name: "Test",
        color: null,
        style: "background: linear-gradient(#003366, #001d3d);filter:;",
        items: [
            { type: "stars", count: 800, size: 0.7, speed: 1 },
            { type: "stars", count: 300, size: 1.2, speed: 1 },

            // { type: "galaxy", count: 500, size: 12, swirlStrength: 0.2, rotationSpeed: 0.5, color: "rgba(255,255,255,0.8)" },
            // { type: "galaxy", count: 2000, size: 1.5, swirlStrength: 0.6, rotationSpeed: 12, armCount: 5, nebula: true, colors: ["white", "#a0c8ff", "#e0b3ff", "#ffccff"] },

            // { type: "sun", x: 1600, y: 200, radius: 60, rayCount: 12, rayLength: 40, rayWidth: 3, color: "rgba(255, 223, 220, 0.8)" },

            // { type: "aurora", bandCount: 4, amplitude: 50, wavelength: 250, speed: 0.6, colorStops: ["#00ffcc", "#6600ff", "#ff00cc"], opacity: 0.25 },
            // { type: "aurora", bandCount: 10, amplitude: 60, wavelength: 800, speed: 0.6, colorStops: ["#00ffcc", "#00ffb7", "#00ff88"], opacity: 0.25 },
            // { type: "aurora", bandCount: 10, amplitude: 60, wavelength: 800, speed: 0.6, colorStops: ["#ff00cc", "#00ff88", "#6600ff"], opacity: 0.25 },
            { type: "wave", amplitude: 20, wavelength: 180 * 4, speed: 1, color: "rgba(10, 40, 90, 0.6)", offset: 0.4 },
            // { type: "bubbles", count: 50, size: 20, maxSizeVariation: 10, pulseSpeed: 1, speed: 1 }, // , borderRadius: 50
            // { type: "rain", count: 300, speed: 10, length: 10, width: 1, color: "rgba(135,206,250,0.6)" },
            // { type: "snow", count: 300, size: 2, speed: 1, drift: 0.3, color: "white" },
            { type: "wave", amplitude: 15, wavelength: 120 * 4, speed: 1.5, color: "rgba(40, 90, 140, 0.5)", offset: 0.37 },
            { type: "wave", amplitude: 10, wavelength: 90 * 4, speed: 3, color: "rgba(80, 140, 200, 0.4)", offset: 0.35 },
            { type: "wave", amplitude: 5, wavelength: 60 * 4, speed: 8, color: "rgba(150, 200, 255, 0.3)", offset: 0.33 }
            // { type: "wave", amplitude: 0, wavelength: 1, speed: 0, color: "rgba(150, 200, 255, 0.2)", offset: 0.31 },

            // { type: "wave", side: "top", amplitude: 15, wavelength: 120 * 4, speed: 1.5, color: "rgba(40, 90, 140, 0.5)", offset: 0.17 },
            // { type: "wave", side: "top", amplitude: 10, wavelength: 90 * 4, speed: 3, color: "rgba(80, 140, 200, 0.4)", offset: 0.15 },
            // { type: "wave", side: "top", amplitude: 5, wavelength: 60 * 4, speed: 8, color: "rgba(150, 200, 255, 0.3)", offset: 0.13 },
            // { type: "wave", side: "left", amplitude: 5, wavelength: 60 * 4, speed: 8, color: "rgba(150, 200, 255, 0.3)", offset: 0.13 },
            // { type: "wave", side: "right", amplitude: 5, wavelength: 60 * 4, speed: 8, color: "rgba(150, 200, 255, 0.3)", offset: 0.13 }

            // { type: "neon", radius: 80, thickness: 6, speed: 0.002, angle: 0, color: "cyan" },
            // { type: "neon", radius: 120, thickness: 8, speed: -0.0015, angle: 0, color: "magenta" },
            // { type: "neon", radius: 180, thickness: 10, speed: 0.001, angle: 0, color: "lime" },

            // { type: "lens_flare", radius: 150 }

            // { type: "rain_screen", count: 120, minRadius: 10, maxRadius: 30, gravity: 0.2, smear: true, color: "rgba(180,200,255,0.2)" }

            // { type: "bloom", blobCount: 25, blurAmount: 60, speed: 2 },
            // { type: "fog", count: 120, size: 120, speed: -1, opacity: 0.05, blur: 45, offset: 0.6, spread: 200 }

            // { type: "spotlight", x: 300, y: 0, length: 2000, baseWidth: 1000, color: "rgba(255, 255, 200, 0.6)", swayAmplitude: 1, swaySpeed: 1 },
            // { type: "spotlight", x: 600, y: 0, length: 2000, baseWidth: 1000, color: "rgba(255, 200, 207, 0.6)", swayAmplitude: 1, swaySpeed: 1 },
            // { type: "spotlight", x: 900, y: 0, length: 2000, baseWidth: 1000, color: "rgba(200, 208, 255, 0.6)", swayAmplitude: 1, swaySpeed: 1 },
            // { type: "spotlight", x: 1200, y: 0, length: 2000, baseWidth: 1000, color: "rgba(234, 140, 255, 0.6)", swayAmplitude: 1, swaySpeed: 1 }

            // { type: "city", buildingCount: 40, minWidth: 30, maxWidth: 70, minHeight: 100, maxHeight: 400, color: "#222", windowColor: "#ffff99", night: true, flickerSpeed: 1 },

            // { type: "shape", shape: "triangle", x: 300, y: 300, size: 50, rotationSpeed: 20, color: "#ff0055" },
            // { type: "shape", shape: "circle", x: 600, y: 400, size: 40, rotationSpeed: 0, color: "#00ddff" }
        ]
    }
})

// OVERLAYS
export const overlayCategories: Writable<Categories> = writable({}) // {default}
export const overlays: Writable<Overlays> = writable({}) // {default}

// AUDIO
export const audioFolders: Writable<Categories> = writable({}) // {default}
export const audioStreams: Writable<{ [key: string]: AudioStream }> = writable({}) // {}
export const audioPlaylists: Writable<{ [key: string]: Playlist }> = writable({}) // {}
export const volume: Writable<number> = writable(1) // 1
export const gain: Writable<number> = writable(1) // 1
export const metronome: Writable<API_metronome> = writable({}) // {}
export const effectsLibrary: Writable<{ path: string; name: string }[]> = writable([]) // []

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

// DRAWER
export const drawerTabsData: Writable<DrawerTabs> = writable({}) // {default}
export const mediaOptions: Writable<MediaOptions> = writable({ columns: 5, mode: "grid" }) // {default}
export const drawer: Writable<{ height: number; stored: null | number }> = writable({ height: 300, stored: null }) // {default}

// TAGS
export const globalTags: Writable<{ [key: string]: Tag }> = writable({}) // {}
export const mediaTags: Writable<{ [key: string]: Tag }> = writable({}) // {}
export const actionTags: Writable<{ [key: string]: Tag }> = writable({}) // {}
export const variableTags: Writable<{ [key: string]: Tag }> = writable({}) // {}

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
export const actions: Writable<{ [key: string]: Action }> = writable({}) // {}
export const emitters: Writable<{ [key: string]: Emitter }> = writable({}) // {}

// CONNECTIONS
export const ports: Writable<{ [key: string]: number }> = writable({ remote: 5510, stage: 5511, controller: 5512, output_stream: 5513 }) // {default}
export const disabledServers: Writable<any> = writable({ remote: false, stage: false, controller: true, output_stream: true }) // {}
export const serverData: Writable<{ [key: string]: ServerData }> = writable({}) // {}
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
    triggers,
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
    direction: localeDirection,
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
    remotePassword
}

// DEBUG STORE UPDATES
const debugStores = false
const updates: { [key: string]: number } = {}
if (debugStores) startSubscriptions()
function startSubscriptions() {
    Object.entries($).forEach(([key, store]) => {
        store.subscribe(() => {
            if (!updates[key]) updates[key] = 0
            updates[key]++

            // first update is initializing empty store, second update sets saved value
            // eslint-disable-next-line
            if (updates[key] > 2) console.trace("STORE UPDATE:", key, updates[key])
        })
    })
}
