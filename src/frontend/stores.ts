// ----- FreeShow -----
// Here are all the global app variables

import type { Bible } from "json-bible/lib/Bible"
import type { ICommonTagsResult } from "music-metadata"
import { type Writable, writable } from "svelte/store"
import type { ContentProviderId } from "../electron/contentProviders/base/types"
import type { Event } from "../types/Calendar"
import type { Draw, DrawLine, DrawSettings, DrawTools } from "../types/Draw"
import type { Effects } from "../types/Effects"
import type { History, HistoryNew } from "../types/History"
import type { ActiveEdit, Clipboard, Media, MediaOptions, NumberObject, OS, Popups, Profiles, Selected, SlidesOptions, Trigger, Variable } from "../types/Main"
import type { Folders, Projects, ShowRef } from "../types/Projects"
import type { Dictionary, Styles, Themes } from "../types/Settings"
import type { Action, Emitter, ID, Overlays, ShowGroups, ShowList, Shows, ShowType, SlideTimer, Tag, Templates, Timer, Transition, TrimmedShows } from "../types/Show"
import type { ServerData } from "../types/Socket"
import type { ActiveStage, StageLayouts } from "../types/Stage"
import type { BibleCategories, Categories, DrawerTabs, SettingsTabs, TopViews } from "../types/Tabs"
import type { AudioChannel, AudioChannelData, AudioStream, Playlist } from "./../types/Audio"
import type { Outputs } from "./../types/Output"
import type { DrawerTabIds } from "./../types/Tabs"
import { type EQBand, type EqualizerConfig } from "./audio/audioEqualizer"
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
export const selectedProfile: Writable<string | null> = writable(null)
export const activeProfile: Writable<string | null> = writable(null)
export const settingsTab: Writable<SettingsTabs> = writable("general")
export const projectView: Writable<boolean> = writable(false)
export const showRecentlyUsedProjects: Writable<boolean> = writable(true)
export const globalGroupViewEnabled: Writable<boolean> = writable(false)
export const activeRecording: Writable<any> = writable(null)
export const currentRecordingStream: Writable<any> = writable(null)
export const focusedArea: Writable<string> = writable("")
export const activeAnimate: Writable<any> = writable({ slide: -1, index: -1 })
export const allOutputs: Writable<Outputs> = writable({}) // stage data in output windows
export const activeScripture: Writable<{ id?: string; reference?: { book: number | string; chapters: (number | string)[]; verses: (number | string)[][] } }> = writable({})
export const activeTriggerFunction: Writable<string> = writable("")
export const guideActive: Writable<boolean> = writable(false)
export const runningActions: Writable<string[]> = writable([])
export const activeSlideRecording: Writable<any> = writable(null)
export const scriptureMode: Writable<"grid" | "list"> = writable("list")
export const providerConnections: Writable<{ [key in ContentProviderId]?: boolean }> = writable({})
export const metronomeTimer: Writable<{ beat: number; timeToNext: number }> = writable({ beat: 0, timeToNext: 0 })
export const mediaDownloads: Writable<Map<string, { progress: number; total: number; status: string }>> = writable(new Map())

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
export const outputState: Writable<{ id: string; active: boolean | "invisible" }[]> = writable([])
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
export const colorbars: Writable<{ [key: string]: string }> = writable({})
export const livePrepare: Writable<{ [key: string]: boolean }> = writable({})
export const overlayTimers: Writable<{ [key: string]: { outputId: string; overlayId: string; timer: NodeJS.Timeout } }> = writable({})
export const slideVideoData: Writable<{ [key: string]: { [key: string]: { currentTime: number; duration: number; isPaused: boolean; loop?: boolean } } }> = writable({})

// EXPORT
export const exportOptions: Writable<any> = writable({ pdf: { rows: 5, columns: 2, slide: true, text: true } })

// CACHE
export const sortedShowsList: Writable<ShowList[]> = writable([])
export const cachedShowsData: Writable<any> = writable({})
export const quickTextCache: Writable<{ name: string; text: string; fromSearch?: boolean }> = writable({ name: "", text: "" })
export const loadedMediaThumbnails: Writable<{ [key: string]: string }> = writable({})
export const cachePath: Writable<string> = writable("")
export const scriptureHistory: Writable<any[]> = writable([])
export const actionHistory: Writable<{ action: string; data: any; time: number; count: number }[]> = writable([])
export const audioData: Writable<{ [key: string]: { metadata: ICommonTagsResult } }> = writable({})
export const customScriptureBooks: Writable<{ [key: string]: string[] }> = writable({})
export const scriptureHistoryUsed: Writable<boolean> = writable(false)
export const actionRevealUsed: Writable<boolean> = writable(false)
export const groupsMoreOptionsEnabled: Writable<boolean> = writable(false)

// EDIT
export const editColumns: Writable<number> = writable(1)
export const editHistory: Writable<any[]> = writable([])
export const refreshEditSlide: Writable<boolean> = writable(false)
export const refreshListBoxes: Writable<number> = writable(-1)
export const triggerAutoSplit: Writable<boolean> = writable(false)
export const storedEditMenuState: Writable<any> = writable({})
export const copyPasteEdit: Writable<any> = writable({})
export const textEditActive: Writable<boolean> = writable(false)
export const textEditZoom: Writable<number> = writable(10)
export const spellcheck: Writable<{ misspelled: string; suggestions: string[] } | null> = writable(null)

// OTHER
export const notFound: Writable<{ show: string[]; bible: string[] }> = writable({ show: [], bible: [] })
export const toastMessages: Writable<string[]> = writable([])
export const alertMessage: Writable<string> = writable("")
export const popupData: Writable<any> = writable({})
export const previousShow: Writable<any> = writable(null)
export const projectToolSize: Writable<number> = writable(150)
export const forceClock: Writable<boolean> = writable(false)
export const lastSavedCache: Writable<any> = writable(null)
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
export const errorHasOccurred: Writable<boolean> = writable(false)
export const disableDragging: Writable<boolean> = writable(false)
export const activeDropId: Writable<string> = writable("")
export const randomNumberVariable: Writable<{ [key: string]: boolean }> = writable({})
export const dynamicValueData: Writable<{ [key: string]: any }> = writable({})

// ----- SAVED VARIABLES -----

// HISTORY
export const undoHistory: Writable<(History | HistoryNew)[]> = writable([])
export const redoHistory: Writable<(History | HistoryNew)[]> = writable([])
export const historyCacheCount: Writable<number> = writable(75)
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
export const effects: Writable<Effects> = writable({}) // {default}

// OVERLAYS
export const overlayCategories: Writable<Categories> = writable({}) // {default}
export const overlays: Writable<Overlays> = writable({}) // {default}

// AUDIO
export const audioFolders: Writable<Categories> = writable({}) // {default}
export const audioStreams: Writable<{ [key: string]: AudioStream }> = writable({}) // {}
export const audioPlaylists: Writable<{ [key: string]: Playlist }> = writable({}) // {}
export const volume: Writable<number> = writable(1) // 1
export const gain: Writable<number> = writable(1) // DEPRECATED - only use volume
export const audioChannelsData: Writable<{ [key: string]: AudioChannelData }> = writable({}) // {}
export const metronome: Writable<API_metronome> = writable({}) // {}
export const effectsLibrary: Writable<{ path: string; name: string }[]> = writable([]) // []
export const equalizerConfig = writable<EqualizerConfig>({ enabled: false, bands: [] })
export const eqPresets: Writable<{ [key: string]: { name: string; bands: EQBand[] } }> = writable({}) // {}

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
export const scriptureSettings: Writable<any> = writable({
    template: "scripture",
    versesPerSlide: 3,
    verseNumbers: false,
    showVersion: false,
    showVerse: true,
    referenceDivider: ":",
    splitLongVerses: false,
    longVersesChars: 100,
    splitLongVersesSuffix: false
}) // {default}

// DRAWER
export const drawerTabsData: Writable<DrawerTabs> = writable({}) // {default}
export const mediaOptions: Writable<MediaOptions> = writable({ columns: 5, mode: "grid" }) // {default}
export const drawer: Writable<{ height: number; stored: null | number; autoclosed?: boolean }> = writable({ height: 300, stored: null }) // {default}

// TAGS
export const globalTags: Writable<{ [key: string]: Tag }> = writable({}) // {}
export const mediaTags: Writable<{ [key: string]: Tag }> = writable({}) // {}
export const actionTags: Writable<{ [key: string]: Tag }> = writable({}) // {}
export const variableTags: Writable<{ [key: string]: Tag }> = writable({}) // {}

// OTHER
export const resized: Writable<NumberObject> = writable({ leftPanel: 290, rightPanel: 290, leftPanelDrawer: 290, rightPanelDrawer: 290 }) // {default}
export const sorted: Writable<any> = writable({}) // {}
export const dataPath: Writable<string> = writable("") // "" // DEPRECATED - only for setting
export const lockedOverlays: Writable<string[]> = writable([]) // []
export const special: Writable<any> = writable({}) // {}

// SETTINGS
export const language: Writable<string> = writable("en") // get locale
export const autosave: Writable<string> = writable("15min") // "15min"
export const timeFormat: Writable<string> = writable("24") // "24"
export const alertUpdates: Writable<boolean> = writable(true) // true
export const autoOutput: Writable<boolean> = writable(false) // false
export const labelsDisabled: Writable<boolean> = writable(false) // false
export const groupNumbers: Writable<boolean> = writable(true) // true
export const fullColors: Writable<boolean> = writable(false) // false
export const formatNewShow: Writable<boolean> = writable(false) // false
export const splitLines: Writable<number> = writable(0) // 0
export const showsPath: Writable<null | string> = writable(null) // null // DEPRECATED
export const customizedIcons: Writable<any> = writable({ disabled: [], svg: [] }) // {disabled: [], svg: []}

// THEME
export const theme: Writable<string> = writable("default") // "default"
export const themes: Writable<{ [key: string]: Themes }> = writable({}) // {default}

// STYLES
export const styles: Writable<{ [key: string]: Styles }> = writable({}) // {}

// OUTPUTS
export const outputs: Writable<Outputs> = writable({}) // {default}
export const outLocked: Writable<boolean> = writable(false) // false

// PROFILES
export const profiles: Writable<Profiles> = writable({}) // {}

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
export const contentProviderData: Writable<{ [key in ContentProviderId]?: any }> = writable({}) // {}

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
    effects,
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
    theme,
    themes,
    outputs,
    styles,
    customMetadata,
    customMessageCredits,
    outLocked,
    ports,
    maxConnections,
    remotePassword,
    providerConnections
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
