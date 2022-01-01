import { outBackground, outOverlays, outputDisplay, outputWindow, outSlide, mediaFolders, draw, drawTool, drawSettings, stageShows } from "./../stores"
import { OUTPUT, REMOTE, STAGE } from "./../../types/Channels"
import { client, sendData, sendClientAll, timedout, arrayToObject, filterObjectArray } from "./sendData"
import { shows } from "../stores"
import { get } from "svelte/store"
import { activeProject, projects, folders } from "../stores"
import type { ClientMessage } from "../../types/Socket"

export function listen() {
  if (get(outputWindow)) {
    // FROM MAIN TO OUTPUT
    window.api.receive(OUTPUT, (msg: any) => {
      if (msg.channel === "BACKGROUND") outBackground.set(msg.data)
      else if (msg.channel === "SLIDE") outSlide.set(msg.data)
      else if (msg.channel === "OVERLAYS") outOverlays.set(msg.data)
      else if (msg.channel === "SHOWS") shows.set(msg.data)
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
      if (data !== null) window.api.send(OUTPUT, { channel: "SHOWS", data: get(shows) })
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
      window.api.send(REMOTE, { channel: "FOLDERS", data })
    })
    activeProject.subscribe((data) => {
      window.api.send(REMOTE, { channel: "PROJECT", data })
    })
    shows.subscribe((data) => {
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
    shows.subscribe(() => {
      sendData(STAGE, { channel: "SLIDES" })
    })
  }
}

// const send = (id: "OUTPUT" | "REMOTE" | "STAGE", channel: string, data: any) => {window.api.send(id, { channel, data })}
