import { get } from "svelte/store"
import { MAIN } from "../../types/Channels"
import { convertObject } from "../components/helpers/array"
import {
  activePopup,
  activeProject,
  alertUpdates,
  audioFolders,
  autoOutput,
  backgroundColor,
  categories,
  defaultProjectName,
  displayMetadata,
  drawer,
  drawerTabsData,
  drawSettings,
  exportPath,
  formatNewShow,
  fullColors,
  groupNumbers,
  groups,
  imageExtensions,
  labelsDisabled,
  language,
  mediaFolders,
  mediaOptions,
  openedFolders,
  os,
  outLocked,
  outputPosition,
  outputScreen,
  overlayCategories,
  playerVideos,
  ports,
  presenterControllerKeys,
  projectView,
  remotePassword,
  resized,
  screen,
  showsPath,
  slidesOptions,
  templateCategories,
  theme,
  videoExtensions,
  webFavorites,
} from "../stores"
import { OUTPUT } from "./../../types/Channels"
import type { SaveListSettings } from "./../../types/Save"
import { currentWindow, maxConnections, outputs, scriptures, scriptureSettings, splitLines, themes, transitionData, volume } from "./../stores"
import { setLanguage } from "./language"
import { send } from "./request"

export function updateSettings(data: any) {
  Object.entries(data).forEach(([key, value]: any) => {
    if (updateList[key as SaveListSettings]) updateList[key as SaveListSettings](value)
    else console.log("MISSING: ", key)
  })

  if (get(currentWindow)) return

  // output
  if (data.outputs) {
    convertObject(data.outputs).forEach((output: any) => {
      if (output.enabled) send(OUTPUT, ["CREATE"], output)
    })
  }
  // if (data.outputPosition) send(OUTPUT, ["POSITION"], data.outputPosition)
  // if (data.autoOutput) send(OUTPUT, ["DISPLAY"], { enabled: true, screen: data.outputScreen })

  // remote
  send(MAIN, ["START"], { ports: data.ports || { remote: 5510, stage: 5511 }, max: data.maxConnections === undefined ? 10 : data.maxConnections })

  // theme
  if (get(themes)[data.theme]) {
    Object.entries(get(themes)[data.theme].colors).forEach(([key, value]: any) => document.documentElement.style.setProperty("--" + key, value))
    Object.entries(get(themes)[data.theme].font).forEach(([key, value]: any) => document.documentElement.style.setProperty("--font-" + key, value))
  }

  setTimeout(() => {
    window.api.send("LOADED")
  }, 100)
}

const updateList: { [key in SaveListSettings]: any } = {
  initialized: (v: any) => {
    if (!v) {
      // FIRST TIME USER
      activePopup.set("initialize")
    }
  },
  activeProject: (v: any) => {
    activeProject.set(v)
    if (v) projectView.set(false)
  },
  showsPath: (v: any) => {
    if (!v) send(MAIN, ["SHOWS_PATH"])
    else showsPath.set(v)
  },
  exportPath: (v: any) => {
    if (!v) send(MAIN, ["EXPORT_PATH"])
    else exportPath.set(v)
  },
  os: (v: any) => {
    if (!v.platform) send(MAIN, ["GET_OS"])
    os.set(v)
  },
  // TODO: get device lang
  language: (v: any) => {
    language.set(v)
    setLanguage(v)
  },
  // events: (v: any) => events.set(v),
  alertUpdates: (v: any) => alertUpdates.set(v === false ? false : true),
  autoOutput: (v: any) => autoOutput.set(v),
  maxConnections: (v: any) => maxConnections.set(v),
  ports: (v: any) => ports.set(v),
  outputs: (v: any) => {
    Object.keys(v).forEach((id: string) => {
      delete v[id].out
    })
    outputs.set(v)
  },
  outputScreen: (v: any) => outputScreen.set(v),
  outputPosition: (v: any) => outputPosition.set(v),
  backgroundColor: (v: any) => backgroundColor.set(v),
  remotePassword: (v: any) => remotePassword.set(v),
  audioFolders: (v: any) => audioFolders.set(v),
  defaultProjectName: (v: any) => defaultProjectName.set(v),
  displayMetadata: (v: any) => displayMetadata.set(v),
  categories: (v: any) => categories.set(v),
  drawer: (v: any) => drawer.set(v),
  drawerTabsData: (v: any) => drawerTabsData.set(v),
  drawSettings: (v: any) => drawSettings.set(v),
  groupNumbers: (v: any) => groupNumbers.set(v),
  fullColors: (v: any) => fullColors.set(v),
  formatNewShow: (v: any) => formatNewShow.set(v),
  groups: (v: any) => groups.set(v),
  imageExtensions: (v: any) => imageExtensions.set(v),
  labelsDisabled: (v: any) => labelsDisabled.set(v),
  mediaFolders: (v: any) => mediaFolders.set(v),
  mediaOptions: (v: any) => mediaOptions.set(v),
  openedFolders: (v: any) => openedFolders.set(v),
  outLocked: (v: any) => outLocked.set(v),
  overlayCategories: (v: any) => overlayCategories.set(v),
  presenterControllerKeys: (v: any) => presenterControllerKeys.set(v),
  playerVideos: (v: any) => playerVideos.set(v),
  resized: (v: any) => resized.set(v),
  screen: (v: any) => screen.set(v),
  scriptures: (v: any) => scriptures.set(v),
  scriptureSettings: (v: any) => scriptureSettings.set(v),
  slidesOptions: (v: any) => slidesOptions.set(v),
  splitLines: (v: any) => splitLines.set(v),
  templateCategories: (v: any) => templateCategories.set(v),
  // templates: (v: any) => templates.set(v),
  theme: (v: any) => theme.set(v),
  transitionData: (v: any) => transitionData.set(v),
  // themes: (v: any) => themes.set(v),
  videoExtensions: (v: any) => videoExtensions.set(v),
  webFavorites: (v: any) => webFavorites.set(v),
  volume: (v: any) => volume.set(v),
}
