import { activePopup, alertMessage } from "./../stores"
import { get } from "svelte/store"
import { MAIN, OUTPUT, STORE } from "../../types/Channels"
import { menuClick } from "../components/context/menuClick"
import { loadShows } from "../components/helpers/setShow"
import {
  activeShow,
  activeTimers,
  autoOutput,
  currentWindow,
  draw,
  drawSettings,
  drawTool,
  events,
  exportPath,
  folders,
  mediaFolders,
  os,
  outBackground,
  outOverlays,
  outputDisplay,
  outputScreen,
  outSlide,
  overlays,
  projects,
  shows,
  showsCache,
  showsPath,
  stageShows,
  templates,
  themes,
  transitionData,
  version,
} from "../stores"
import { createData } from "./createData"
import { setLanguage } from "./language"
import { listen } from "./messages"
import { receive, send } from "./request"
import { updateSettings } from "./updateSettings"

export function startup() {
  if (!get(currentWindow)) {
    send(MAIN, ["OUTPUT", "DISPLAY", "VERSION"])
    send(STORE, ["SHOWS", "STAGE_SHOWS", "PROJECTS", "OVERLAYS", "TEMPLATES", "EVENTS", "THEMES", "SETTINGS"])
  }

  receive(MAIN, receiveMAIN)
  receive(STORE, receiveSTORE)
  receive(OUTPUT, receiveOUTPUT)
  // receive(OUTPUT, get(currentWindow) ? receiveOUTPUTasOutput : receiveOUTPUT)
  // window.api.receive(OUTPUT, (msg: any) => {
  //   if (!get(currentWindow) || ["DISPLAY"].includes(msg.channel)) {
  //     if (receiveOUTPUT[msg.channel]) receiveMAIN[msg.channel](msg.data)
  //   }
  // })

  setLanguage()
  loadShows(Object.keys(get(shows)))
  // search (cache search text?...)

  // output
  if (get(autoOutput)) {
    send(OUTPUT, ["DISPLAY"], { enabled: true, screen: get(outputScreen) })
  }

  // load new show on show change
  activeShow.subscribe((a) => {
    if (a && (a.type === undefined || a.type === "show")) loadShows([a.id])
  })
}

// receivers

const receiveMAIN: any = {
  GET_OS: (a: any) => os.set(a),
  VERSION: (a: any) => version.set(a),
  DISPLAY: (a: any) => outputDisplay.set(a),
  GET_PATHS: (a: any) => createData(a),
  MENU: (a: any) => menuClick(a),
  SHOWS_PATH: (a: any) => showsPath.set(a),
  EXPORT_PATH: (a: any) => exportPath.set(a),
  ALERT: (a: any) => {
    alertMessage.set(a)
    activePopup.set("alert")
  },
  OUTPUT: (a: any) => {
    if (a === "true") currentWindow.set("output")
    else if (a === "pdf") currentWindow.set("pdf")
    else listen()
  },
}

const receiveSTORE: any = {
  SETTINGS: (a: any) => updateSettings(a),
  SHOWS: (a: any) => shows.set(a),
  STAGE_SHOWS: (a: any) => stageShows.set(a),
  PROJECTS: (a: any) => {
    projects.set(a.projects)
    folders.set(a.folders)
  },
  OVERLAYS: (a: any) => overlays.set(a),
  TEMPLATES: (a: any) => templates.set(a),
  EVENTS: (a: any) => events.set(a),
  THEMES: (a: any) => themes.set(a),
}

const receiveOUTPUT: any = {
  BACKGROUND: (a: any) => outBackground.set(a),
  TRANSITION: (a: any) => transitionData.set(a),
  SLIDE: (a: any) => outSlide.set(a),
  OVERLAYS: (a: any) => outOverlays.set(a),
  OVERLAY: (a: any) => overlays.set(a),
  SHOWS: (a: any) => showsCache.set(a),
  DRAW: (a: any) => draw.set(a),
  DRAW_TOOL: (a: any) => drawTool.set(a),
  DRAW_SETTINGS: (a: any) => drawSettings.set(a),
  MEDIA: (a: any) => mediaFolders.set(a),
  ACTIVE_TIMERS: (a: any) => activeTimers.set(a),
  DISPLAY: (a: any) => outputDisplay.set(a.enabled),
  SCREEN_ADDED: (a: any) => {
    if (get(autoOutput) && !get(outputDisplay)) {
      send(OUTPUT, ["DISPLAY"], { enabled: true, screen: a })
      outputScreen.set(a)
    }
  },
}

// const receiveOUTPUTasOutput: any = {
//   DISPLAY: receiveOUTPUT.DISPLAY,
// }
