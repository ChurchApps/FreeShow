import { get } from "svelte/store"
import { OUTPUT, REMOTE, STAGE } from "../../types/Channels"
import type { SaveList } from "../../types/Save"
import type { ClientMessage } from "../../types/Socket"
import {
  activeProject,
  audioFolders,
  categories,
  defaultProjectName,
  draw,
  drawer,
  drawerTabsData,
  drawSettings,
  drawTool,
  events,
  exportPath,
  folders,
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
  overlayCategories,
  overlays,
  playerVideos,
  presenterControllerKeys,
  projects,
  remotePassword,
  resized,
  saved,
  shows,
  showsCache,
  showsPath,
  slidesOptions,
  stageShows,
  templateCategories,
  templates,
  theme,
  themes,
  timeFormat,
  timers,
  videoExtensions,
  webFavorites,
} from "../stores"
import { alertUpdates, autoOutput, maxConnections, outputs, ports, scriptures, scriptureSettings, splitLines, transitionData, volume } from "./../stores"
import { send } from "./request"
import { client, sendClientAll, sendData, timedout } from "./sendData"
import { stageListen } from "./stageTalk"

export function listen() {
  // TO OUTPUT
  outputs.subscribe((data) => {
    send(OUTPUT, ["OUTPUTS"], data)
  })
  // outBackground.subscribe((data) => {
  //   send(OUTPUT, ["BACKGROUND"], data )
  // })
  transitionData.subscribe((data) => {
    send(OUTPUT, ["TRANSITION"], data)
  })
  showsCache.subscribe((data) => {
    send(OUTPUT, ["SHOWS"], data)
  })
  // outSlide.subscribe((data) => {
  //   // TODO: send only current show!
  //   // TODO: dont send if it already has data...?
  //   if (data !== null) send(OUTPUT, ["SHOWS"], data: get(showsCache) )
  //   send(OUTPUT, ["SLIDE"], data )
  // })
  // outOverlays.subscribe((data) => {
  //   if (data !== null) send(OUTPUT, ["OVERLAY"], data: get(overlays) )
  //   send(OUTPUT, ["OVERLAYS"], data )
  // })
  mediaFolders.subscribe((data) => {
    send(OUTPUT, ["MEDIA"], data)
  })
  // displayMetadata.subscribe((data) => {
  //   send(OUTPUT, ["META"], data )
  // })
  // backgroundColor.subscribe((data) => {
  //   send(OUTPUT, ["COLOR"], data )
  // })
  // screen.subscribe((data) => {
  //   send(OUTPUT, ["SCREEN"], data )
  // })
  draw.subscribe((data) => {
    send(OUTPUT, ["DRAW"], data)
  })
  drawTool.subscribe((data) => {
    send(OUTPUT, ["DRAW_TOOL"], data)
  })
  drawSettings.subscribe((data) => {
    send(OUTPUT, ["DRAW_SETTINGS"], data)
  })
  playerVideos.subscribe((data) => {
    send(OUTPUT, ["PLAYER_VIDEOS"], data)
  })
  volume.subscribe((data) => {
    send(OUTPUT, ["VOLUME"], data)
  })
  //
  templates.subscribe((data) => {
    send(OUTPUT, ["TEMPLATES"], data)
  })
  overlays.subscribe((data) => {
    send(OUTPUT, ["OVERLAYS"], data)
  })
  events.subscribe((data) => {
    send(OUTPUT, ["EVENTS"], data)
  })
  // media.subscribe((data) => {
  //   send(OUTPUT, ["MEDIA"], data )
  // })

  // FROM CLIENT
  window.api.receive(REMOTE, (msg: ClientMessage) => client(REMOTE, msg))
  window.api.receive(STAGE, (msg: ClientMessage) => client(STAGE, msg))

  // TO REMOTE
  // TODO: remote (out)
  // outSlide.subscribe(() => {
  //   // send(REMOTE, ["OUT_SLIDE"], data )
  //   sendData(REMOTE, { channel: "OUT" })
  // })
  outputs.subscribe(() => {
    // send(REMOTE, ["OUTPUTS"], data)
    sendData(REMOTE, { channel: "OUT" })
  })
  projects.subscribe(() => {
    // send(REMOTE, ["PROJECTS"], data )
    sendData(REMOTE, { channel: "PROJECTS" }, true)
  })
  folders.subscribe((data) => {
    send(REMOTE, ["FOLDERS"], { folders: data, opened: get(openedFolders) })
  })
  activeProject.subscribe((data) => {
    send(REMOTE, ["PROJECT"], data)
  })
  shows.subscribe((data) => {
    sendData(REMOTE, { channel: "SHOWS", data })
  })
  showsCache.subscribe((data) => {
    sendData(REMOTE, { channel: "SHOWS", data: get(shows) })

    // TODO: ?
    // send(REMOTE, ["SHOW"], data )
    timedout(REMOTE, { channel: "SHOW", data }, () => sendClientAll(REMOTE, "SHOW", data, "active"))
    // TODO: this, timedout +++
    sendData(REMOTE, { channel: "OUT" }, true)
  })

  // TO STAGE
  stageListen()

  // SAVE
  // TODO: better saving!
  let s = { ...saveList, folders: folders, overlays: overlays, projects: projects, showsCache: showsCache, stageShows: stageShows }
  setTimeout(() => {
    Object.values(s).forEach((a) => {
      if (a) a.subscribe(() => saved.set(false))
    })
    saved.set(true)
  }, 5000)
}

export function sendInitialOutputData() {
  send(OUTPUT, ["SHOWS"], get(showsCache))
  send(OUTPUT, ["TRANSITION"], get(transitionData))
  send(OUTPUT, ["MEDIA"], get(mediaFolders))
  send(OUTPUT, ["PLAYER_VIDEOS"], get(playerVideos))
  send(OUTPUT, ["VOLUME"], get(volume))
  send(OUTPUT, ["TEMPLATES"], get(templates))
  send(OUTPUT, ["OVERLAYS"], get(overlays))
}

const saveList: { [key in SaveList]: any } = {
  initialized: null,
  activeProject: activeProject,
  alertUpdates: alertUpdates,
  audioFolders: audioFolders,
  autoOutput: autoOutput,
  categories: categories,
  timeFormat: timeFormat,
  maxConnections: maxConnections,
  ports: ports,
  defaultProjectName: defaultProjectName,
  events: events,
  showsPath: showsPath,
  exportPath: exportPath,
  drawer: drawer,
  drawerTabsData: drawerTabsData,
  drawSettings: drawSettings,
  groupNumbers: groupNumbers,
  fullColors: fullColors,
  formatNewShow: formatNewShow,
  groups: groups,
  imageExtensions: imageExtensions,
  labelsDisabled: labelsDisabled,
  language: language,
  mediaFolders: mediaFolders,
  mediaOptions: mediaOptions,
  openedFolders: openedFolders,
  os: os,
  outLocked: outLocked,
  outputs: outputs,
  overlayCategories: overlayCategories,
  presenterControllerKeys: presenterControllerKeys,
  playerVideos: playerVideos,
  remotePassword: remotePassword,
  resized: resized,
  scriptures: scriptures,
  scriptureSettings: scriptureSettings,
  slidesOptions: slidesOptions,
  splitLines: splitLines,
  templateCategories: templateCategories,
  templates: templates,
  timers: timers,
  theme: theme,
  themes: themes,
  transitionData: transitionData,
  videoExtensions: videoExtensions,
  webFavorites: webFavorites,
  volume: volume,
}
