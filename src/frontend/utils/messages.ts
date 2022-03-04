import { shows } from "../stores"
import { get } from "svelte/store"
import type { ClientMessage } from "../../types/Socket"
import {
  activeProject,
  audioFolders,
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
  groupCount,
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
  outputDisplay,
  outputWindow,
  outSlide,
  overlayCategories,
  overlays,
  playerVideos,
  projects,
  resized,
  saved,
  screen,
  showsCache,
  showsPath,
  slidesOptions,
  stageShows,
  templateCategories,
  templates,
  theme,
  themes,
  videoExtensions,
  webFavorites,
} from "../stores"
import { OUTPUT, REMOTE, STAGE } from "../../types/Channels"
import { arrayToObject, client, filterObjectArray, sendClientAll, sendData, timedout } from "./sendData"

export function listen() {
  if (get(outputWindow)) {
    // outBackground.set(null)
    // outSlide.set(null)
    // outOverlays.set([])
    // FROM MAIN TO OUTPUT
    window.api.receive(OUTPUT, (msg: any) => {
      if (msg.channel === "BACKGROUND") outBackground.set(msg.data)
      else if (msg.channel === "SLIDE") outSlide.set(msg.data)
      else if (msg.channel === "OVERLAYS") outOverlays.set(msg.data)
      else if (msg.channel === "SHOWS") showsCache.set(msg.data)
      else if (msg.channel === "DRAW") draw.set(msg.data)
      else if (msg.channel === "DRAW_TOOL") drawTool.set(msg.data)
      else if (msg.channel === "DRAW_SETTINGS") drawSettings.set(msg.data)
      else if (msg.channel === "MEDIA") mediaFolders.set(msg.data)
      else if (msg.channel === "DISPLAY") outputDisplay.set(msg.data)
    })
  } else {
    window.api.receive(OUTPUT, (msg: any) => {
      if (msg.channel === "DISPLAY") outputDisplay.set(msg.data)
    })
    // FILE
    // window.api.receive(OPEN_FILE, (message: any) => {
    //   console.log(message)
    //   // activeFilePath = message.path;
    //   activeFilePath.set(message)
    // })
    // window.api.send("OPEN_FILE", {path: 'C:/Users/Kristoffer/Coding/FreeShow/sources.txt'});
    // window.api.send("OPEN_FILE", 'C:/Users/Kristoffer/Coding/FreeShow/sources.txt');
    // window.api.send("OPEN_FILE", {});

    // TO OUTPUT
    outBackground.subscribe((data) => {
      window.api.send(OUTPUT, { channel: "BACKGROUND", data })
    })
    outSlide.subscribe((data) => {
      // TODO: send only current show!
      // TODO: dont send if it already has data...?
      if (data !== null) window.api.send(OUTPUT, { channel: "SHOWS", data: get(showsCache) })
      window.api.send(OUTPUT, { channel: "SLIDE", data })
    })
    outOverlays.subscribe((data) => {
      window.api.send(OUTPUT, { channel: "OVERLAYS", data })
    })
    mediaFolders.subscribe((data) => {
      window.api.send(OUTPUT, { channel: "MEDIA", data })
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
  }

  // SAVE
  // TODO: better saving!
  activeProject.subscribe(() => saved.set(false))
  audioFolders.subscribe(() => saved.set(false))
  defaultProjectName.subscribe(() => saved.set(false))
  displayMetadata.subscribe(() => saved.set(false))
  showsPath.subscribe(() => saved.set(false))
  drawer.subscribe(() => saved.set(false))
  drawerTabsData.subscribe(() => saved.set(false))
  drawSettings.subscribe(() => saved.set(false))
  events.subscribe(() => saved.set(false))
  folders.subscribe(() => saved.set(false))
  fullColors.subscribe(() => saved.set(false))
  groupCount.subscribe(() => saved.set(false))
  groups.subscribe(() => saved.set(false))
  imageExtensions.subscribe(() => saved.set(false))
  labelsDisabled.subscribe(() => saved.set(false))
  language.subscribe(() => saved.set(false))
  mediaFolders.subscribe(() => saved.set(false))
  mediaOptions.subscribe(() => saved.set(false))
  openedFolders.subscribe(() => saved.set(false))
  os.subscribe(() => saved.set(false))
  outLocked.subscribe(() => saved.set(false))
  overlayCategories.subscribe(() => saved.set(false))
  overlays.subscribe(() => saved.set(false))
  playerVideos.subscribe(() => saved.set(false))
  projects.subscribe(() => saved.set(false))
  resized.subscribe(() => saved.set(false))
  screen.subscribe(() => saved.set(false))
  showsCache.subscribe(() => saved.set(false))
  showsPath.subscribe(() => saved.set(false))
  slidesOptions.subscribe(() => saved.set(false))
  stageShows.subscribe(() => saved.set(false))
  templateCategories.subscribe(() => saved.set(false))
  templates.subscribe(() => saved.set(false))
  theme.subscribe(() => saved.set(false))
  themes.subscribe(() => saved.set(false))
  videoExtensions.subscribe(() => saved.set(false))
  webFavorites.subscribe(() => saved.set(false))
}

// const send = (id: "OUTPUT" | "REMOTE" | "STAGE", channel: string, data: any) => {window.api.send(id, { channel, data })}
