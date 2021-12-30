import { GetLayout } from "./../components/helpers/get"
import { outBackground, outOverlays, outputDisplay, outputWindow, outSlide, mediaFolders, draw, drawTool, drawSettings, stageShows, stageConnections } from "./../stores"
import { OUTPUT, REMOTE, STAGE } from "./../../types/Channels"
import { shows } from "../stores"
import { get } from "svelte/store"
import { name, activeShow, language, activeProject, projects, folders } from "../stores"
import { getStageShows } from "../components/helpers/get"
import type { RemoteData, RemoteInitialize, RemoteShow } from "../../types/Socket"

export function listen() {
  // FROM MAIN TO OUTPUT
  window.api.receive(OUTPUT, (message: any) => {
    // window.api.send(MAIN, {message: message})
    if (message.channel === "BACKGROUND") outBackground.set(message.data)
    else if (message.channel === "SLIDE") outSlide.set(message.data)
    else if (message.channel === "OVERLAYS") outOverlays.set(message.data)
    else if (message.channel === "SHOWS") shows.set(message.data)
    else if (message.channel === "DRAW") draw.set(message.data)
    else if (message.channel === "DRAW_TOOL") drawTool.set(message.data)
    else if (message.channel === "DRAW_SETTINGS") drawSettings.set(message.data)
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
    if (message.channel === "CONNECTION") {
      stageConnections.update((c: any[]) => (c = [...c, { id: message.id, name: "", stage: null }]))
      console.log(get(stageConnections))

      console.log(message.id + " connected")
    } else if (message.channel === "DISCONNECT") {
      stageConnections.update((c: any[]) => c.filter((a: any) => a.id !== message.id))
      console.log(get(stageConnections))

      console.log(message.id + " disconnected")
    } else window.api.send(STAGE, stageData(message))
  })

  const stageData = (message: any) => {
    let data: any = null
    switch (message.channel) {
      case "SHOWS":
        data = getStageShows()
        break
      case "SHOW":
        let show = get(stageShows)[message.data.id]
        if (!show.password.length || show.password === message.data.password) {
          // connection successfull
          stageConnections.update((sc) => {
            sc.forEach((c) => {
              if (c.id === message.id) c.stage = message.data.id
              return c
            })
            return sc
          })
          data = show
          sendSlide()
        } else {
          message = { id: message.id, channel: "ERROR" }
          data = "Wrong password"
        }
        break
      // case "SHOW":
      //   data = getStageShow(message.data)
      //   break
      // case "BACKGROUND":
      //   data = getOutBackground()
      //   break
      // case "SLIDE":
      //   data = getOutSlide()
      //   break
      // case "OVERLAYS":
      //   data = getOutOverlays()
      //   break
    }
    return { id: message.id || null, channel: message.channel, data }
  }

  // // TO STAGE
  // output.subscribe((message) => {
  //   if (message !== get(output)) {
  //     window.api.send(STAGE, { output: getOutput() })
  //   }
  //   // TODO: send next slide + countdown + others... / messages
  // })

  // TO OUTPUT & STAGE
  outBackground.subscribe((data) => {
    if (!get(outputWindow)) {
      window.api.send(OUTPUT, { channel: "BACKGROUND", data })
      // window.api.send(STAGE, stageData("BACKGROUND"))
    }
  })
  outSlide.subscribe((data) => {
    if (!get(outputWindow)) {
      // TODO: send only current show!
      // TODO: dont send if it already has data...?
      if (data !== null) window.api.send(OUTPUT, { channel: "SHOWS", data: get(shows) })
      window.api.send(OUTPUT, { channel: "SLIDE", data })
      // window.api.send(STAGE, stageData("SLIDE"))
    }
  })
  outOverlays.subscribe((data) => {
    if (!get(outputWindow)) {
      window.api.send(OUTPUT, { channel: "OVERLAYS", data })
      // window.api.send(STAGE, stageData("OVERLAYS"))
    }
  })

  // TO STAGE
  let timeout = false
  stageShows.subscribe((s: any) => {
    if (!get(outputWindow) && !timeout) {
      timeout = true
      let first = JSON.stringify(s)
      sendStageId(s)
      setTimeout(() => {
        if (JSON.stringify(s) !== first) sendStageId(s)
        timeout = false
      }, 1000)
    }
  })
  function sendStageId(s: any) {
    get(stageConnections).forEach((conn) => {
      if (conn.stage) {
        // TODO: check if stage still exists and is enabled
        if (s[conn.stage].enabled) {
          window.api.send(STAGE, { channel: "SHOW", id: conn.id, data: s[conn.stage] })
        }
        // if (!s[conn.stage].enabled) // disable...
      }
    })
  }

  outSlide.subscribe(() => {
    if (!get(outputWindow)) sendSlide(true)
  })
  shows.subscribe(() => {
    if (!get(outputWindow)) sendSlide()
  })

  // TO OUTPUT
  mediaFolders.subscribe((data) => {
    if (!get(outputWindow)) window.api.send(OUTPUT, { channel: "MEDIA", data })
  })
  draw.subscribe((data) => {
    if (!get(outputWindow)) window.api.send(OUTPUT, { channel: "DRAW", data })
  })
  drawTool.subscribe((data) => {
    if (!get(outputWindow)) window.api.send(OUTPUT, { channel: "DRAW_TOOL", data })
  })
  drawSettings.subscribe((data) => {
    if (!get(outputWindow)) window.api.send(OUTPUT, { channel: "DRAW_SETTINGS", data })
  })
}

export function sendStage(channel: string, data: any) {
  get(stageConnections).forEach((conn) => {
    window.api.send(STAGE, { channel, id: conn.id, data })
    // if (get(stageShows)[conn.stage].enabled)
    // else update stageconnections...
  })
}

let oldOut: string = ""
function sendSlide(check: boolean = false) {
  let out = get(outSlide)
  if (out && (!check || oldOut !== JSON.stringify(out))) {
    let slides: any[] = []
    if (out) {
      let layout = GetLayout(out.id)
      slides = [get(shows)[out.id].slides[layout[out.index].id]]
      if (out.index + 1 < layout.length) slides.push(get(shows)[out.id].slides[layout[out.index + 1].id])
      else slides.push(null)
    }
    console.log(slides)
    window.api.send(STAGE, { channel: "SLIDES", data: slides })
    if (check) oldOut = JSON.stringify(out)
  }
}
