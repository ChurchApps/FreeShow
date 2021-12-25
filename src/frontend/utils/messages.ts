import { outBackground, outOverlays, outputDisplay, outputWindow, outSlide, mediaFolders } from "./../stores"
import { OUTPUT, REMOTE, STAGE } from "./../../types/Channels"
import { shows } from "../stores"
import { get } from "svelte/store"
import { name, activeShow, language, activeProject, projects, folders } from "../stores"
import { getOutBackground, getOutOverlays, getOutSlide } from "../components/helpers/get"
import type { RemoteData, RemoteInitialize, RemoteShow } from "../../types/Socket"

export function listen() {
  // FROM MAIN TO OUTPUT
  window.api.receive(OUTPUT, (message: any) => {
    // window.api.send(MAIN, {message: message})
    if (message.channel === "BACKGROUND") outBackground.set(message.data)
    else if (message.channel === "SLIDE") outSlide.set(message.data)
    else if (message.channel === "OVERLAYS") outOverlays.set(message.data)
    else if (message.channel === "SHOWS") shows.set(message.data)
    else if (message.channel === "MEDIA") mediaFolders.set(message.data)
    else if (message.channel === "DISPLAY") outputDisplay.set(message.data)
  })
  // window.api.receive(OPEN_FILE, (message: any) => {
  //   console.log(message)
  //   // activeFilePath = message.path;
  //   activeFilePath.set(message)
  // })
  // window.api.send("OPEN_FILE", {path: 'C:/Users/Kristoffer/Coding/FreeShow/sources.txt'});
  // window.api.send("OPEN_FILE", 'C:/Users/Kristoffer/Coding/FreeShow/sources.txt');
  // window.api.send("OPEN_FILE", {});

  // REMOTE
  window.api.receive(REMOTE, (message: RemoteData) => {
    if (message.channel === "REQUEST") {
      let initialize: RemoteInitialize = {
        id: message.id,
        channel: "DATA",
        data: {
          name: get(name) || "Computer",
          lang: get(language),
          activeShow: get(activeShow),
          activeProject: get(activeProject),
          projects: get(projects),
          folders: get(folders),
        },
      }
      window.api.send(REMOTE, initialize)
    } else if (message.channel === "GET_SHOW") {
      console.log(message)
      let remoteShow: RemoteShow = { id: message.id, channel: "GET_SHOW", data: get(shows)[message.data.id] }
      window.api.send(REMOTE, remoteShow)
    } else {
      console.log("Remote: ", message.id ? message.id + ": " + message.data : message)
    }
  })

  // REQUEST FROM STAGE
  window.api.receive(STAGE, (message: any) => {
    if (message.channel === "REQUEST") {
      window.api.send(STAGE, stageData(message.data))
    }
  })

  const stageData = (id: string) => {
    let data: any = null
    switch (id) {
      case "BACKGROUND":
        data = getOutBackground()
        break
      case "SLIDE":
        data = getOutSlide()
        break
      case "OVERLAYS":
        data = getOutOverlays()
        break
    }
    return { channel: id, data }
  }

  // // TO STAGE
  // output.subscribe((message) => {
  //   if (message !== get(output)) {
  //     window.api.send(STAGE, { output: getOutput() })
  //   }
  //   // TODO: send next slide + countdown + others... / messages
  // })

  // TO OUTPUT & STAGE
  outBackground.subscribe((o) => {
    if (!get(outputWindow)) {
      window.api.send(OUTPUT, { channel: "BACKGROUND", data: o })
      window.api.send(STAGE, stageData("BACKGROUND"))
    }
  })
  outSlide.subscribe((o) => {
    if (!get(outputWindow)) {
      // TODO: send only current show!
      // TODO: dont send if it already has data...?
      if (o !== null) window.api.send(OUTPUT, { channel: "SHOWS", data: get(shows) })
      window.api.send(OUTPUT, { channel: "SLIDE", data: o })
      window.api.send(STAGE, stageData("SLIDE"))
    }
  })
  outOverlays.subscribe((o) => {
    if (!get(outputWindow)) {
      window.api.send(OUTPUT, { channel: "OVERLAYS", data: o })
      window.api.send(STAGE, stageData("OVERLAYS"))
    }
  })

  // TO OUTPUT
  mediaFolders.subscribe((mf) => {
    if (!get(outputWindow)) window.api.send(OUTPUT, { channel: "MEDIA", data: mf })
  })
}
