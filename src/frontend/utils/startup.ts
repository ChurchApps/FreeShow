import { get } from "svelte/store"
import { MAIN, STORE } from "../../types/Channels"
import type { MainData } from "../../types/Socket"
import { menuClick } from "../components/context/menuClick"
import { loadShows } from "../components/helpers/setShow"
import { activeShow, events, folders, os, outputWindow, overlays, projects, shows, stageShows, templates, themes, version } from "../stores"
import { outputDisplay } from "../stores"
import { createData } from "./createData"
import { listen } from "./messages"
import { updateSettings } from "./updateSettings"

export function startup() {
  // REQUEST DATA FROM ELECTRON
  if (!get(outputWindow)) {
    window.api.send(MAIN, { channel: "OUTPUT" })
    window.api.send(MAIN, { channel: "DISPLAY" })
    window.api.send(MAIN, { channel: "VERSION" })
    window.api.send(STORE, { channel: "SHOWS" })
    window.api.send(STORE, { channel: "STAGE_SHOWS" })
    window.api.send(STORE, { channel: "PROJECTS" })
    window.api.send(STORE, { channel: "OVERLAYS" })
    window.api.send(STORE, { channel: "TEMPLATES" })
    window.api.send(STORE, { channel: "EVENTS" })
    window.api.send(STORE, { channel: "THEMES" })
    window.api.send(STORE, { channel: "SETTINGS" })
  }
  window.api.receive(MAIN, (msg: MainData) => {
    if (msg.channel === "GET_OS") os.set(msg.data!)
    else if (msg.channel === "VERSION") version.set(msg.data)
    else if (msg.channel === "DISPLAY") outputDisplay.set(msg.data)
    else if (msg.channel === "GET_PATHS") createData(msg.data)
    else if (msg.channel === "MENU") menuClick(msg.data)
    else if (msg.channel === "OUTPUT") {
      if (msg.data === "true") outputWindow.set(true)
      // LISTEN TO MESSAGES FROM CLIENT/ELECTRON
      listen()
    }
  })

  // store
  window.api.receive(STORE, (msg: any) => {
    if (msg.channel === "SETTINGS") updateSettings(msg.data)
    else if (msg.channel === "SHOWS") shows.set(msg.data)
    else if (msg.channel === "STAGE_SHOWS") stageShows.set(msg.data)
    else if (msg.channel === "PROJECTS") {
      projects.set(msg.data.projects)
      folders.set(msg.data.folders)
    } else if (msg.channel === "OVERLAYS") overlays.set(msg.data)
    else if (msg.channel === "TEMPLATES") templates.set(msg.data)
    else if (msg.channel === "EVENTS") events.set(msg.data)
    else if (msg.channel === "THEMES") themes.set(msg.data)
  })

  // load
  activeShow.subscribe((a) => {
    if (a) loadShows([a.id])
  })
}
