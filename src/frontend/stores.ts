import { Writable, writable } from "svelte/store"
import type { Bible } from "../types/Bible"
import type { Event } from "../types/Calendar"
import type { Draw, DrawSettings, DrawTools } from "../types/Draw"
import type { ActiveEdit, DefaultProjectNames, Media, NumberObject, Popups, Selected, SlidesOptions } from "../types/Main"
import type { Folders, Projects, ShowRef } from "../types/Projects"
import type { Dictionary, Themes } from "../types/Settings"
import type { ID, OutAudio, OutBackground, OutSlide, OutTransition, Overlays, Shows, Templates, Transition } from "../types/Show"
import type { ActiveStage, StageShows } from "../types/Stage"
import type { Categories, Category, DrawerTabs, SettingsTabs, TopViews } from "../types/Tabs"
import type { DrawerTabIds } from "./../types/Tabs"
import type { History } from "./components/helpers/history"

export const version: Writable<string> = writable("0.0.0")

// global
// ? export const activeFilePath: Writable<undefined | string> = writable()
export const activePopup: Writable<null | Popups> = writable(null)
export const activePage: Writable<TopViews> = writable("show")
export const activeEdit: Writable<ActiveEdit> = writable({ items: [] })
export const currentWindow: Writable<null | "output" | "pdf"> = writable(null)
export const outputDisplay: Writable<boolean> = writable(false)
export const selected: Writable<Selected> = writable({ id: null, data: [] })
export const dictionary: Writable<Dictionary> = writable({})
export const notFound: Writable<any> = writable({ show: [], bible: [] })
export const saved: Writable<boolean> = writable(true)
export const audioSource: Writable<any> = writable(null)
export const activeTimers: Writable<any[]> = writable([])
export const activeRename: Writable<any> = writable(null)
export const alertMessage: Writable<string> = writable("")
export const clipboard: Writable<{ id: null | string; data: any[] }> = writable({ id: null, data: [] })
export const eventEdit: Writable<null | string> = writable(null)

export const timers: Writable<{ [key: string]: any }> = writable({}) // {}

export const exportOptions: Writable<any> = writable({
  pdf: {
    rows: 5,
    columns: 2,
    slide: true,
    text: true,
  },
})

// output
export const outLocked: Writable<boolean> = writable(false) // false
export const outBackground: Writable<null | OutBackground> = writable(null)
export const outSlide: Writable<null | OutSlide> = writable(null)
export const outOverlays: Writable<string[]> = writable([])
export const outAudio: Writable<OutAudio[]> = writable([])
export const outTransition: Writable<null | OutTransition> = writable(null)
export const transitionData: Writable<{ text: Transition; media: Transition }> = writable({
  text: { type: "fade", duration: 500 },
  media: { type: "fade", duration: 500 },
}) // {default}

// connections
export const connections: Writable<{ [key: string]: any }> = writable({ REMOTE: {}, STAGE: {} })
export const remotePassword: Writable<string> = writable("") // generate 4 numbers
export const ports: Writable<any> = writable({ remote: 5510, stage: 5511 }) // {default}
export const maxConnections: Writable<number> = writable(10) // 10

// project
export const projectView: Writable<boolean> = writable(false)
export const openedFolders: Writable<ID[]> = writable([]) // []
export const activeProject: Writable<null | ID> = writable(null) // null
export const projects: Writable<Projects> = writable({}) // {default}
export const folders: Writable<Folders> = writable({}) // {default}
export const categories: Writable<Categories> = writable({}) // {default}

// SHOW
export const activeShow: Writable<null | ShowRef> = writable(null) // null
export const shows: Writable<any> = writable({}) // {default}
export const showsCache: Writable<Shows> = writable({}) // {default}
export const previousShow: Writable<any> = writable(null)

// DRAW
export const drawTool: Writable<DrawTools> = writable("focus")
export const draw: Writable<null | Draw> = writable(null)
export const drawSettings: Writable<DrawSettings> = writable({}) // {default}
export const paintCache: Writable<any[]> = writable([])

// STAGE
// message...
export const activeStage: Writable<ActiveStage> = writable({ id: null, items: [] })
export const stageShows: Writable<StageShows> = writable({
  // {default}
  eopsjofes: {
    name: "Text",
    disabled: false,
    password: "",
    settings: {
      background: false,
      color: "#000000",
      resolution: false,
      size: { width: 10, height: 20 },
      labels: false,
      showLabelIfEmptySlide: true,
    },
    items: {
      "slide#current_slide_text": {
        enabled: true,
        style: "top:75px;left:140px;color:red;width:1639px;height:929px;",
        align: "",
      },
    },
  },
  eopsjofes3: {
    name: "Next",
    disabled: false,
    password: "",
    settings: {
      background: false,
      color: "#000000",
      resolution: false,
      size: { width: 10, height: 20 },
      labels: false,
      showLabelIfEmptySlide: true,
    },
    items: {
      "slide#current_slide_text": {
        enabled: true,
        style: "top:0.00px;left:38.50px;color:white;width:1842.69px;height:685.21px;",
        align: "",
      },
      "slide#next_slide_text": {
        enabled: true,
        style: "color:grey;left:37.50px;top:685.00px;width:1844.49px;height:371.50px;",
        align: "",
      },
    },
  },
  eopsjofese: {
    name: "Timer",
    disabled: true,
    password: "test",
    settings: {
      background: false,
      color: "#000000",
      resolution: false,
      size: { width: 10, height: 20 },
      labels: true,
      showLabelIfEmptySlide: true,
    },
    items: {
      "timers#system_clock": {
        enabled: true,
        style: "left:307.00px;top:271.50px;width:1307.76px;height:536.59px;",
        align: "",
      },
    },
  },
})

// overlays
export const overlayCategories: Writable<Categories> = writable({}) // {default}
export const overlays: Writable<Overlays> = writable({}) // {default}

// templates
export const templateCategories: Writable<Categories> = writable({}) // {default}
export const templates: Writable<Templates> = writable({}) // {default}

// MEDIA
export const media: Writable<Media> = writable({}) // {}
export const mediaCache: Writable<any> = writable({}) // {}

// backgrounds
export const mediaFolders: Writable<Categories> = writable({}) // {default}

// audio
export const audioFolders: Writable<Categories> = writable({}) // {default}
// export const audio = writable({ // {}
//   terd: { type: "music", name: "Song", location: "song" },
//   fese: { type: "audio", name: "Info", location: "info" },
// })

// web
export const webFavorites: Writable<Categories> = writable({
  // {default}
  youtube: { name: "YouTube", icon: "web", url: "https://youtube.com/" },
  google: { name: "Google", icon: "web", url: "https://google.com/" },
  example: { name: "Example", icon: "web", url: "https://example.com/" },
})

// player
export const playerVideos: Writable<Categories> = writable({
  // {default}
  oceans: { name: "Oceans", type: "youtube", id: "https://www.youtube.com/watch?v=dy9nwe9_xzw" },
  chosen: { name: "The Chosen", type: "youtube", id: "X-AJdKty74M" },
})

// CALENDAR
export const activeDays: Writable<number[]> = writable([])
export const events: Writable<{ [key: string]: Event }> = writable({}) // {}

// SCRIPTURE
interface BibleCategories extends Category {
  api?: boolean
}
export const scriptures: Writable<{ [key: string]: BibleCategories }> = writable({
  kjv: { name: "King James (Authorised) Version", api: true, id: "de4e12af7f28f599-02" },
  asv: { name: "The Holy Bible, American Standard Version", api: true, id: "06125adad2d5898a-01" },
  web: { name: "World English Bible", api: true, id: "9879dbb7cfe39e4d-04" },
  wmb: { name: "World Messianic Bible", api: true, id: "f72b840c855f362c-04" },
  bsb: { name: "Berean Study Bible", api: true, id: "bba9f40183526463-01" },
}) // {default}
export const scripturesCache: Writable<{ [key: string]: Bible }> = writable({})

export const scriptureSettings: Writable<any> = writable({
  template: "scripture",
  versesPerSlide: 3,
  verseNumbers: false,
  showVersion: false,
  showVerse: true,
})

// UI STATE
export const resized: Writable<NumberObject> = writable({
  // {default}
  leftPanel: 300,
  rightPanel: 300,
  leftPanelDrawer: 300,
  rightPanelDrawer: 300,
  drawer: 200,
})
export const slidesOptions: Writable<SlidesOptions> = writable({
  // {default}
  columns: 4,
  mode: "grid",
})
export const mediaOptions: Writable<SlidesOptions> = writable({
  // {default}
  columns: 5,
  mode: "grid",
})

// DRAWER
export const activeDrawerTab: Writable<DrawerTabIds> = writable("shows")
export const drawerTabsData: Writable<DrawerTabs> = writable({
  // {default}
  shows: { enabled: true, activeSubTab: null },
  media: { enabled: true, activeSubTab: null },
  overlays: { enabled: true, activeSubTab: null },
  templates: { enabled: true, activeSubTab: null },
  audio: { enabled: true, activeSubTab: null },
  scripture: { enabled: true, activeSubTab: null },
  timers: { enabled: true, activeSubTab: null },
  player: { enabled: true, activeSubTab: null },
  web: { enabled: true, activeSubTab: null },
  live: { enabled: true, activeSubTab: null },
})
export const drawer: Writable<{ height: number; stored: null | number }> = writable({ height: 300, stored: null }) // {default}

// SETTINGS
export const settingsTab: Writable<SettingsTabs> = writable("general")

// general
export const language: Writable<string> = writable("en") // "get"
export const alertUpdates: Writable<boolean> = writable(true) // true
export const labelsDisabled: Writable<boolean> = writable(false) // false
export const groupNumbers: Writable<boolean> = writable(true) // true
export const fullColors: Writable<boolean> = writable(true) // true
export const splitLines: Writable<number> = writable(2) // 2
export const displayMetadata: Writable<string> = writable("never") // "never"
export const showsPath: Writable<null | string> = writable(null) // null
export const exportPath: Writable<null | string> = writable(null) // null
export const presenterControllerKeys: Writable<boolean> = writable(true) // true

// display
export const autoOutput: Writable<boolean> = writable(false) // false
export const outputPosition: Writable<{ x: number; y: number; width: number; height: number }> = writable({ x: 0, y: 0, width: 0, height: 0 }) // {default}
export const outputScreen: Writable<null | string> = writable(null) // null

// project
export const defaultProjectName: Writable<DefaultProjectNames> = writable("date") // "date"

// media
export const videoExtensions: Writable<string[]> = writable(["mp4", "mov", "wmv", "avi", "avchd", "flv", "mkv", "webm", "mpeg", "m4v"]) // [default]
export const imageExtensions: Writable<string[]> = writable(["tif", "tiff", "bmp", "jpg", "jpeg", "gif", "png", "eps", "jfif"]) // [default]

// theme
/* --primary: #333e58;
--primary: #2d313b;
--primary: #c1c7d8;
--primary-text: #f0f0ff;
--primary-text: #131313;
--secondary: #e6349c;
--secondary: #e64934;
--secondary: #34bfe6;
--secondary: #34e6ae;
--secondary: #dae634;
--secondary: #b434e6;
--secondary: #e63434;
--secondary: #3434e6;
--secondary: #34e64f; */
export const theme: Writable<string> = writable("default") // "default"
export const themes: Writable<{ [key: string]: Themes }> = writable({}) // {default}

// show
export const groups: Writable<any> = writable({
  // {default}
  intro: { name: "intro", default: true, color: "#f5255e" },
  verse: { name: "verse", default: true, color: "#f52598" },
  pre_chorus: { name: "pre_chorus", default: true, color: "#f525d2" },
  chorus: { name: "chorus", default: true, color: "#d525f5" },
  break: { name: "break", default: true, color: "#a525f5" },
  tag: { name: "tag", default: true, color: "#8825f5" },
  bridge: { name: "bridge", default: true, color: "#7525f5" },
  outro: { name: "outro", default: true, color: "#5825f5" },
})

export const backgroundColor: Writable<string> = writable("#000000") // #000000

// display
export const screen = writable({
  // {default}
  resolution: { width: 1920, height: 1080 },
  // format 16:9
})

export const os: Writable<any> = writable({ platform: "", name: "Computer" }) // "get"

// HISTORY
export const undoHistory: Writable<History[]> = writable([]) // [?]
export const redoHistory: Writable<History[]> = writable([]) // [?]
