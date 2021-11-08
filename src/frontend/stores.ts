import type { NumberObject } from "../types/Main"
import type { TopViews } from "./../types/Views"
import type { Category } from "./../types/Tabs"
import { Writable, writable } from "svelte/store"
import type { ShowRef, Folders, Projects } from "../types/Projects"
import type { Dictionary, LanguageKey } from "../types/Settings"
import type { Output, ID, Shows } from "../types/Show"

// global events
// export const click = writable(null);

// ? Uninque ID
// https://stackoverflow.com/a/14869745
// var id = crypto.randomBytes(10).toString('hex'); (check for existing...)
// start on 0 and count upwards?
// https://dev.to/rahmanfadhil/how-to-generate-unique-id-in-javascript-1b13

// global
export const projectView: Writable<boolean> = writable(false) // WIP
export const activeFilePath: Writable<null | string> = writable(null) // WIP
export const editIndex: Writable<number> = writable(0)
export const activePage: Writable<TopViews> = writable("show")
export const outputWindow: Writable<boolean> = writable(false)
export const outputDisplay: Writable<boolean> = writable(false)

// project
export const openedFolders: Writable<ID[]> = writable(["feriwp", "ffskof"])
export const activeProject: Writable<null | ID> = writable("feskof")
export const activeShow: Writable<null | ShowRef> = writable(null)
// Layers: background, text, overlay, audio
export const output: Writable<Output> = writable({
  // activeSlides
  background: null, // video/image
  slide: null, // text
  overlay: null,
  audio: null,
})

export const shows: Writable<Shows> = writable({
  nåde: {
    name: "Nådepuls",
    category: "terd", // song/private/notes/presentation
    settings: {
      activeLayout: "sooffes",
      template: null,
    },
    timestamps: { created: new Date("2021-07-25"), modified: null, used: null },
    meta: { title: "Nådepuls", artist: "test", license: "CC" },
    slides: {
      fjeiosjfiose: {
        label: "Verse 1",
        color: "green",
        notes: "",
        items: [
          {
            style: "",
            text: [{ value: "Her er jeg Gud,\nmed mine byrder", style: "color: red; text-align: center;" }],
          },
          {
            style: "color: blue; top: 50px; left: 100px; height: 100px; width: 40px;",
          },
        ],
        stageItems: [{ style: "", text: [{ value: "  #E     C       D   Cm", style: "" }] }], // chords...
      },
    },
    layouts: {
      sooffes: {
        name: "Standard",
        notes: "",
        slides: [{ id: "fjeiosjfiose", transition: { type: "none", duration: 200 }, background: {}, overlay: {}, actions: [] }],
      },
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
        label: "Verse 1",
        color: "orange",
        notes: "",
        items: [
          {
            style: "top: 0px; left: 200px; height: 220px; width: 900px; text-align: center;",
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
        label: "Chorus",
        color: "red",
        children: [{ id: "fesfofes" }],
        notes: "",
        items: [
          {
            style: "",
            text: [{ value: "Andre linje", tag: "p", style: "color: red; text-align: center;" }],
          },
        ],
      },
      fesfofes: {
        label: null,
        color: null,
        notes: "",
        items: [
          {
            style: "",
            text: [{ value: "Andre linje", tag: "p", style: "color: orange; text-align: center;" }],
          },
        ],
      },
      blank: {
        label: "Blank",
        color: null,
        notes: "",
        items: [],
      },
    },
    layouts: {
      fesfsef: {
        name: "",
        notes: "",
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
  },
  Info: {
    // TODO: how to tdo info/kunngjeringer... in a better way
    name: "Info",
    category: "fese",
    settings: {
      activeLayout: "fesfsef",
      template: null,
    },
    timestamps: { created: new Date("2021-08-09"), modified: null, used: null },
    meta: {},
    slides: {
      fsioøføjesi: {
        label: null,
        color: null,
        notes: "",
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
      fesfo: {
        label: "Chorus",
        color: null,
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
  },
})

export const projects: Writable<Projects> = writable({
  fhsjoe: {
    name: "First",
    created: new Date("2021-07-25"),
    parent: "/",
    shows: [{ id: "nåde" }, { id: "ertfgggf" }, { id: "Info", location: "/" }, { id: "nåde" }, { type: "video", id: "Truth", location: "C:/movies/" }],
  },
  feskof: {
    name: "Meeting",
    created: new Date("2021-08-06"),
    parent: "feriwp",
    shows: [{ id: "ertfgggf" }, { id: "nåde" }, { type: "private", access: "Private", id: "gere" }],
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
export const categories: Writable<Category> = writable({
  terd: { name: "category.song", default: true, icon: "song" },
  fese: { name: "category.info", default: true, icon: "info" },
  teerd: { name: "category.presentation", default: true, icon: "presentation" },
})
export const media = writable({
  terd: { type: "video", name: "Song", location: "song" },
  fese: { type: "image", name: "Info", location: "info" },
  teerd: { type: "...", name: "Presentation", location: "presentation" },
})
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
  scripture: { enabled: true, activeSubTab: null },
  timers: { enabled: true, activeSubTab: null },
  web: { enabled: false, activeSubTab: null },
  live: { enabled: false, activeSubTab: null },
})

// SETTINGS
// lan
export const name: Writable<null | string> = writable(null)
export const password: Writable<string> = writable("show")

// general
export const language: Writable<LanguageKey> = writable("en")
export const lablesDisabled: Writable<boolean> = writable(false)

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
export const undoHistory = writable([
  {
    action: "moveSlide",
    fromState: 2,
    page: "shows",
  },
])
export const redoHistory = writable([])
