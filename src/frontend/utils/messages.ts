import { alertUpdates, autoOutput, backgroundColor, maxConnections, outputPosition, ports, scriptures, scriptureSettings, splitLines, transitionData } from "./../stores"
import { get } from "svelte/store"
import { OUTPUT, REMOTE, STAGE } from "../../types/Channels"
import type { SaveList } from "../../types/Save"
import type { ClientMessage } from "../../types/Socket"
import {
  activeProject,
  audioFolders,
  categories,
  defaultProjectName,
  displayMetadata,
  draw,
  drawer,
  drawerTabsData,
  drawSettings,
  drawTool,
  events,
  folders,
  fullColors,
  formatNewShow,
  groupNumbers,
  groups,
  imageExtensions,
  labelsDisabled,
  language,
  mediaFolders,
  mediaOptions,
  openedFolders,
  os,
  outBackground,
  outLocked,
  outOverlays,
  outputScreen,
  outSlide,
  overlayCategories,
  overlays,
  playerVideos,
  presenterControllerKeys,
  projects,
  remotePassword,
  resized,
  saved,
  screen,
  shows,
  showsCache,
  showsPath,
  exportPath,
  slidesOptions,
  stageShows,
  templateCategories,
  templates,
  theme,
  themes,
  videoExtensions,
  webFavorites,
} from "../stores"
import { arrayToObject, client, filterObjectArray, sendClientAll, sendData, timedout } from "./sendData"

export function listen() {
  // TO OUTPUT
  outBackground.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "BACKGROUND", data })
  })
  transitionData.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "TRANSITION", data })
  })
  outSlide.subscribe((data) => {
    // TODO: send only current show!
    // TODO: dont send if it already has data...?
    if (data !== null) window.api.send(OUTPUT, { channel: "SHOWS", data: get(showsCache) })
    window.api.send(OUTPUT, { channel: "SLIDE", data })
  })
  outOverlays.subscribe((data) => {
    if (data !== null) window.api.send(OUTPUT, { channel: "OVERLAY", data: get(overlays) })
    window.api.send(OUTPUT, { channel: "OVERLAYS", data })
  })
  mediaFolders.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "MEDIA", data })
  })
  displayMetadata.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "META", data })
  })
  backgroundColor.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "COLOR", data })
  })
  screen.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "SCREEN", data })
  })
  draw.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "DRAW", data })
  })
  drawTool.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "DRAW_TOOL", data })
  })
  drawSettings.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "DRAW_SETTINGS", data })
  })
  playerVideos.subscribe((data) => {
    window.api.send(OUTPUT, { channel: "PLAYER_VIDEOS", data })
  })

  // FROM CLIENT
  window.api.receive(REMOTE, (msg: ClientMessage) => client(REMOTE, msg))
  window.api.receive(STAGE, (msg: ClientMessage) => client(STAGE, msg))

  // TO REMOTE
  outSlide.subscribe(() => {
    // window.api.send(REMOTE, { channel: "OUT_SLIDE", data })
    sendData(REMOTE, { channel: "OUT" })
  })
  projects.subscribe(() => {
    // window.api.send(REMOTE, { channel: "PROJECTS", data })
    sendData(REMOTE, { channel: "PROJECTS" }, true)
  })
  folders.subscribe((data) => {
    window.api.send(REMOTE, { channel: "FOLDERS", data: { folders: data, opened: get(openedFolders) } })
  })
  activeProject.subscribe((data) => {
    window.api.send(REMOTE, { channel: "PROJECT", data })
  })
  shows.subscribe((data) => {
    sendData(REMOTE, { channel: "SHOWS", data })
  })
  showsCache.subscribe((data) => {
    sendData(REMOTE, { channel: "SHOWS", data: get(shows) })

    // TODO: ?
    // window.api.send(REMOTE, { channel: "SHOW", data })
    timedout(REMOTE, { channel: "SHOW", data }, () => sendClientAll(REMOTE, "SHOW", data, "active"))
    // TODO: this, timedout +++
    sendData(REMOTE, { channel: "OUT" }, true)
  })

  // TO STAGE
  stageShows.subscribe((data: any) => {
    data = arrayToObject(filterObjectArray(get(stageShows), ["enabled", "name", "settings", "items"], "enabled"))
    timedout(STAGE, { channel: "SHOW", data }, () => sendClientAll(STAGE, "SHOW", data, "active"))
  })
  outSlide.subscribe(() => {
    sendData(STAGE, { channel: "SLIDES" }, true)
  })
  showsCache.subscribe(() => {
    sendData(STAGE, { channel: "SLIDES" })
  })

  // SAVE
  // TODO: better saving!
  let s = { ...saveList, folders: folders, overlays: overlays, projects: projects, showsCache: showsCache, stageShows: stageShows }
  Object.values(s).forEach((a) => {
    if (a) a.subscribe(() => saved.set(false))
  })
}

const saveList: { [key in SaveList]: any } = {
  initialized: null,
  activeProject: activeProject,
  alertUpdates: alertUpdates,
  audioFolders: audioFolders,
  autoOutput: autoOutput,
  backgroundColor: backgroundColor,
  categories: categories,
  maxConnections: maxConnections,
  ports: ports,
  defaultProjectName: defaultProjectName,
  displayMetadata: displayMetadata,
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
  outputScreen: outputScreen,
  outputPosition: outputPosition,
  overlayCategories: overlayCategories,
  presenterControllerKeys: presenterControllerKeys,
  playerVideos: playerVideos,
  remotePassword: remotePassword,
  resized: resized,
  screen: screen,
  scriptures: scriptures,
  scriptureSettings: scriptureSettings,
  slidesOptions: slidesOptions,
  splitLines: splitLines,
  templateCategories: templateCategories,
  templates: templates,
  theme: theme,
  themes: themes,
  transitionData: transitionData,
  videoExtensions: videoExtensions,
  webFavorites: webFavorites,
}
