import { Writable, writable } from "svelte/store"
import type { StageShows } from "./../types/Stage"
import type { DrawTools, Draw, DrawSettings } from "./../types/Draw"
import type { History } from "./components/helpers/history"
import type { NumberObject, Selected } from "../types/Main"
import type { TopViews } from "./../types/Views"
import type { Categories } from "./../types/Tabs"
import type { ShowRef, Folders, Projects } from "../types/Projects"
import type { Dictionary, LanguageKey } from "../types/Settings"
import type { ID, Shows, Overlays, OutBackground, OutSlide, OutAudio } from "../types/Show"

// global events
// export const click = writable(null);

// ? Uninque ID
// https://stackoverflow.com/a/14869745
// var id = crypto.randomBytes(10).toString('hex'); (check for existing...)
// start on 0 and count upwards?
// https://dev.to/rahmanfadhil/how-to-generate-unique-id-in-javascript-1b13

// global
export const projectView: Writable<boolean> = writable(false) // WIP
export const activeFilePath: Writable<undefined | string> = writable() // WIP
interface ActiveEdit {
  slide: null | number
  items: number[]
}
export const activeEdit: Writable<ActiveEdit> = writable({ slide: null, items: [] })
export const activePage: Writable<TopViews> = writable("show")
export const outputWindow: Writable<boolean> = writable(false)
export const outputDisplay: Writable<boolean> = writable(false)
export const selected: Writable<Selected> = writable({ id: null, elems: [] })

// project
export const openedFolders: Writable<ID[]> = writable(["feriwp", "ffskof"])
export const activeProject: Writable<null | ID> = writable("feskof")
export const activeShow: Writable<null | ShowRef> = writable(null)
// Layers: background, text, overlay, audio
export const outLocked: Writable<boolean> = writable(false)
export const outBackground: Writable<null | OutBackground> = writable(null)
export const outSlide: Writable<null | OutSlide> = writable(null)
export const outOverlays: Writable<string[]> = writable([])
export const outAudio: Writable<OutAudio[]> = writable([])
// export const output: Writable<Output> = writable({
//   // activeSlides
//   background: null, // video/image
//   slide: null, // text
//   overlay: [],
//   audio: [],
// })
// draw
export const drawTool: Writable<DrawTools> = writable("focus")
export const draw: Writable<null | Draw> = writable(null)
export const drawSettings: Writable<DrawSettings> = writable({
  focus: {
    color: "#000000",
    opacity: 0.8,
    size: 300,
    glow: true,
    hold: false,
  },
  pointer: {
    color: "#FF0000",
    opacity: 0.8,
    size: 50,
    // type: "circle",
    glow: true,
    hold: false,
  },
  fill: {
    color: "#000000",
    opacity: 0.8,
    rainbow: false,
  },
  paint: {},
})
// stage
interface ActiveStage {
  id: null | string
  items: string[]
}
export const activeStage: Writable<ActiveStage> = writable({ id: "eopsjofes", items: [] })
export const stageShows: Writable<StageShows> = writable({
  eopsjofes: {
    name: "Text",
    enabled: true,
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
    enabled: true,
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
    enabled: false,
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

// connections
export const connections: Writable<{ [key: string]: any }> = writable({ REMOTE: {}, STAGE: {} })
export const remotePassword: Writable<string> = writable("test")

export const shows: Writable<Shows> = writable({
  nåde: {
    name: "Nådepuls",
    category: "song", // song/private/notes/presentation
    settings: {
      activeLayout: "sooffes",
      template: null,
    },
    timestamps: { created: new Date("2021-07-25"), modified: null, used: null },
    meta: { title: "Nådepuls", artist: "test", license: "CC" },
    slides: {
      fjeiosjfiose: {
        group: "Verse 1",
        color: "green",
        settings: {
          background: false,
          color: "#000000",
          // resolution: []
          // transition: {},
        },
        notes: "",
        items: [
          {
            style: "top: 50px; left: 100px; height: 100px; width: 40px;",
          },
          {
            style: "top: 50px; left: 500px; height: 100px; width: 40px;",
            text: [{ value: "", style: "color: blue;" }],
          },
          {
            style: "",
            text: [{ value: "Her er jeg Gud,\nmed mine byrder", style: "color: red; text-align: center;" }],
          },
        ],
        stageItems: [{ style: "", text: [{ value: "  #E     C       D   Cm", style: "" }] }], // chords...
      },
    },
    layouts: {
      sooffes: {
        name: "Standard",
        notes: "",
        slides: [{ id: "fjeiosjfiose", transition: { type: "none", duration: 200 }, background: "randomID", overlays: [], actions: [] }],
      },
    },
    backgrounds: {
      randomID: { path: "path", filters: "hue(100deg)" },
    },
  },
  ertfgggf: {
    name: "Syng det ut",
    category: null,
    settings: {
      activeLayout: "fesfsef",
      template: null,
    },
    timestamps: { created: new Date("2021-07-25"), modified: null, used: null },
    // stats: {timesUsed: 100}
    meta: { title: "Syng det ut", artist: "test", license: "CC" },
    slides: {
      feowo: {
        group: "Verse 1",
        color: "orange",
        settings: {},
        notes: "",
        items: [
          {
            style: "top: 0px; left: 200px; height: 220px; width: 900px;",
            align: "",
            text: [
              { value: "Jesus det evige navn\nSom ingen utslette ", style: "font-family: Tahoma;" },
              { value: "kan", style: "color: red;" },
            ],
          },
          {
            style: "top: 0px; left: 10px; height: 80px; width: 300px;",
            text: [{ value: "Impuls", style: "" }],
          },
        ],
      },
      fesfo: {
        group: "Chorus",
        color: "red",
        globalGroup: "chorus",
        settings: {},
        children: ["fesfofes"],
        notes: "",
        items: [
          {
            style: "",
            text: [{ value: "Andre linje", tag: "p", style: "color: red; text-align: center;" }],
          },
        ],
      },
      fesfofes: {
        group: null,
        color: null,
        settings: {},
        notes: "",
        items: [
          {
            style: "",
            text: [{ value: "Andre linje", tag: "p", style: "color: orange; text-align: center;" }],
          },
        ],
      },
      blank: {
        group: "Blank",
        color: null,
        settings: {},
        notes: "",
        items: [],
      },
    },
    layouts: {
      fesfsef: {
        name: "",
        notes: "test",
        slides: [
          { id: "feowo" },
          { id: "fesfo", children: { fesfofes: { disabled: true } } },
          { id: "feowo" },
          { id: "blank" },
          { id: "blank", disabled: true },
          { id: "blank" },
          { id: "blank" },
          { id: "blank" },
          { id: "blank" },
          { id: "fesfo", children: { fesfofes: {} } },
          { id: "blank" },
        ],
      },
    },
    backgrounds: {},
  },
  Info: {
    // TODO: how to tdo info/kunngjeringer... in a better way
    name: "Info",
    category: "info",
    settings: {
      activeLayout: "fesfsef",
      template: null,
    },
    timestamps: { created: new Date("2021-08-09"), modified: null, used: null },
    meta: {},
    slides: {
      fsioøføjesi: {
        group: "",
        color: null,
        settings: {},
        notes: "",
        items: [
          {
            style: "top: 400px; left: 180px; height: 220px; width: 1500px; justify-content: center;",
            text: [{ value: "Velkommen!", style: "font-size: 180px; font-weight: bold; font-family: Tahoma;" }],
          },
          {
            style: "top: 0px; left: 10px; height: 80px; width: 300px;",
            text: [{ value: "Impuls", style: "" }],
          },
        ],
      },
      fesfo: {
        group: "Chorus",
        color: null,
        settings: {},
        notes: "",
        items: [
          {
            style: "",
            text: [{ value: "Andre linje", tag: "p", style: "color: blue; text-align: center;" }],
          },
        ],
      },
    },
    layouts: {
      fesfsef: {
        name: "",
        notes: "",
        slides: [{ id: "fsioøføjesi" }, { id: "fesfo" }],
      },
    },
    backgrounds: {},
  },

  gere: {
    name: "Test",
    private: true,
    category: null,
    settings: {
      activeLayout: "fesfsef",
      template: null,
    },
    timestamps: { created: new Date("2021-07-25"), modified: null, used: null },
    // stats: {timesUsed: 100}
    meta: { title: "Syng det ut", artist: "test", license: "CC" },
    slides: {
      feowo: {
        group: "Verse 1",
        color: "orange",
        settings: {},
        notes: "",
        items: [
          {
            style: "top: 0px; left: 200px; height: 220px; width: 900px; text-align: center;",
            text: [
              { value: "Privat! ", style: "font-family: Tahoma;" },
              { value: "kan", style: "color: red;" },
            ],
          },
          {
            style: "top: 0px; left: 10px; height: 80px; width: 300px;",
            text: [{ value: "Impuls", style: "" }],
          },
        ],
      },
      fesfo: {
        group: "Chorus",
        color: "red",
        settings: {},
        children: ["fesfofes"],
        notes: "",
        items: [
          {
            style: "",
            text: [{ value: "Andre linje", tag: "p", style: "color: red; text-align: center;" }],
          },
        ],
      },
      fesfofes: {
        group: null,
        color: null,
        settings: {},
        notes: "",
        items: [
          {
            style: "",
            text: [{ value: "Andre linje", tag: "p", style: "color: orange; text-align: center;" }],
          },
        ],
      },
      blank: {
        group: "Blank",
        color: null,
        settings: {},
        notes: "",
        items: [],
      },
    },
    layouts: {
      fesfsef: {
        name: "",
        notes: "test",
        slides: [
          { id: "feowo" },
          { id: "fesfo" },
          { id: "feowo" },
          { id: "blank" },
          { id: "blank" },
          { id: "blank" },
          { id: "blank" },
          { id: "blank" },
          { id: "blank" },
          { id: "fesfo" },
          { id: "blank" },
        ],
      },
    },
    backgrounds: {},
  },
})

export const projects: Writable<Projects> = writable({
  fhsjoe: {
    name: "First",
    created: new Date("2021-07-25"),
    parent: "/",
    shows: [{ id: "nåde" }, { id: "ertfgggf" }, { id: "Info" }, { id: "nåde" }, { type: "video", name: "Truth", id: "C:/movies/" }],
  },
  feskof: {
    name: "Meeting",
    created: new Date("2021-08-06"),
    parent: "feriwp",
    shows: [{ id: "ertfgggf" }, { id: "nåde" }, { id: "gere" }], // , access: "Private"
  },
})
// export const projects = writable([
//   {name: 'First', created: '25.07.2021', shows: [{id: 'nåde'}, {id: 'ertfgggf'}, {id: 'Info', location: '/'}, {type: 'video', id: 'Truth', location: 'C:/movies/'}]},
//   {name: 'test', folder: [
//     {name: 'Meeting', created: '06.08.2021', shows: [{id: 'ertfgggf'}, {id: 'nåde'}, {type: 'private', access: 'Private', id: 'Info'}]}
//   ]},
//   {name: 'Nest', folder: [
//     {name: 'Ayy', folder: []}
//   ]}
// ]);
export const folders: Writable<Folders> = writable({
  esf1: { name: "Ayy1", parent: "fese" },
  ffskof: { name: "Name", parent: "/" },
  // fes: {name: 'Non existant', parent: 'es3333f'},
  feriwp: { name: "Second", parent: "ffskof" },
  esf: { name: "Ayy", parent: "fese" },
  esf3: { name: "Ayy3", parent: "fese" },
  fes3: { name: "Test3", parent: "fes2" },
  fese: { name: "Nest", parent: "/" },
  fes2: { name: "Test2", parent: "fes" },
  fes: { name: "Test", parent: "esf" },
  esf2: { name: "Ayy2", parent: "fese" },
})
export const categories: Writable<Categories> = writable({
  song: { name: "category.song", icon: "song", default: true },
  info: { name: "category.info", icon: "info", default: true },
  presentation: { name: "category.presentation", icon: "presentation", default: true },
})
export const overlayCategories: Writable<Categories> = writable({})
export const overlays: Writable<Overlays> = writable({
  tiesl: {
    label: "Verse 1",
    color: "green",
    style: "",
    items: [
      {
        style: "",
        text: [{ value: "Her er jeg Gud,\nmed mine byrder", style: "color: red; text-align: center;" }],
      },
      {
        style: "color: blue; top: 50px; left: 100px; height: 100px; width: 40px;",
      },
    ],
  },
  fsioøføjesi: {
    label: "",
    color: null,
    style: "",
    items: [
      {
        style: "top: 400px; left: 180px; height: 220px; width: 1500px; text-align: center;",
        text: [{ value: "Velkommen!", style: "font-size: 180px; font-weight: bold; font-family: Tahoma;" }],
      },
      {
        style: "top: 0px; left: 10px; height: 80px; width: 300px;",
        text: [{ value: "Impuls", style: "" }],
      },
    ],
  },
})
export const mediaFolders: Writable<Categories> = writable({
  pictures: { name: "category.pictures", icon: "folder", path: "C:\\Users\\Kristoffer\\Pictures", default: true },
  videos: { name: "category.videos", icon: "folder", path: "C:\\Users\\Kristoffer\\Videos", default: true },
  1234: { name: "Varden", icon: "folder", path: "C:\\Users\\Kristoffer\\Varden" },
})
// export const media = writable({
//   pictures: [

//   ]
// })
export const audio = writable({
  terd: { type: "music", name: "Song", location: "song" },
  fese: { type: "audio", name: "Info", location: "info" },
})

// STAGE
// export const stage = writable([type: "text", pos: ])
// message...
// layout

// SLIDE VIEW
interface SlidesOptions {
  columns: number
  grid: boolean
}
export const slidesOptions: Writable<SlidesOptions> = writable({
  columns: 4,
  grid: true,
})
export const mediaOptions: Writable<SlidesOptions> = writable({
  columns: 4,
  grid: true,
})

// IU STATE
export const resized: Writable<NumberObject> = writable({
  leftPanel: 300,
  rightPanel: 300,
  leftPanelDrawer: 300,
  rightPanelDrawer: 300,
  drawer: 200,
})
// export const tabs: Writable<StringObject> = writable({
//   shows:
// })
// TABS
// Drawer
interface DrawerTabs {
  [key: string]: {
    enabled: boolean
    activeSubTab: null | string
  }
}
export const drawerTabsData: Writable<DrawerTabs> = writable({
  shows: { enabled: true, activeSubTab: null },
  backgrounds: { enabled: true, activeSubTab: null },
  overlays: { enabled: true, activeSubTab: null },
  audio: { enabled: true, activeSubTab: null },
  scripture: { enabled: true, activeSubTab: "de4e12af7f28f599-02" },
  timers: { enabled: true, activeSubTab: null },
  web: { enabled: false, activeSubTab: null },
  live: { enabled: false, activeSubTab: null },
})
export const drawer: Writable<{ height: number; stored: null | number }> = writable({ height: 300, stored: null })

// SETTINGS
// lan
export const name: Writable<null | string> = writable(null)
export const password: Writable<string> = writable("show")

// general
export const language: Writable<LanguageKey> = writable("en")
export const labelsDisabled: Writable<boolean> = writable(false)

// text
export const theme = writable(0)
export const font = writable({
  family: "Tahoma",
  size: 12,
  color: "white",
  outline: { width: 2, color: "black" },
  shadow: { x: 2, y: 2, blur: 4, spread: 0, color: "black" },
})
export const screen = writable({
  resolution: { width: 1920, height: 1080 },
  // format 16:9
})

// show
export const groupCount: Writable<boolean> = writable(true)
// export const selectedPattern = writable("default")
// export const patterns = writable({
//   default: [

//   ]
// })
export const groups: Writable<any> = writable({
  intro: { name: "intro", default: true, color: "#f5255e" },
  verse: { name: "verse", default: true, color: "#f525a2" },
  pre_chorus: { name: "pre_chorus", default: true, color: "#df25f5" },
  chorus: { name: "chorus", default: true, color: "#af25f5" },
  break: { name: "break", default: true, color: "#8825f5" },
  bridge: { name: "bridge", default: true, color: "#6225f5" },
  outro: { name: "outro", default: true, color: "#3225f5" },
})

// project
// TODO: today / closest sunday / week number / custom string / nothing....
export const defaultName: Writable<null | "date" | string> = writable("date")

// extensions
export const videoExtensions: Writable<string[]> = writable(["mp4", "mov"])
export const imageExtensions: Writable<string[]> = writable(["png", "jpg", "jpeg"])

// empty
export const dictionary: Writable<Dictionary> = writable({})
export const theme_css = writable({})

// export const theme = writable({
//   primary: '#2d313b',
//   secondary: '#e6349c',
//   textPrimary: '#f0f0ff',
//   textInvert: '#131313',
// });

// HISTORY
export const undoHistory: Writable<History[]> = writable([])
export const redoHistory: Writable<History[]> = writable([])
