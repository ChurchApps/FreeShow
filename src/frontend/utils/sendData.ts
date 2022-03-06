import { activeShow } from "./../stores"
import { GetLayout } from "../components/helpers/get"
import type { ClientMessage } from "../../types/Socket"
import { REMOTE, STAGE } from "../../types/Channels"
import { get } from "svelte/store"
import { showsCache, outSlide, stageShows, connections, remotePassword, projects, folders, activeProject, dictionary, openedFolders, shows } from "../stores"
import { loadShows } from "../components/helpers/setShow"

// REMOTE

async function getRemote(msg: ClientMessage) {
  // let initialize: ClientMessage = {
  //   id: msg.id,
  //   channel: "DATA",
  //   data: {
  //     name: get(name) || "Computer",
  //     lang: get(language),
  //     // activeShow: get(activeShow),
  //     // activeProject: get(activeProject),
  //     // projects: get(projects),
  //     // folders: get(folders),
  //   },
  // }
  // window.api.send(REMOTE, initialize)
  // window.api.send(REMOTE, { id: msg.id, channel: "ACTIVE_SHOW", data: "" })
  // window.api.send(REMOTE, { id: msg.id, channel: "PROJECT", data: "" })
  // window.api.send(REMOTE, { id: msg.id, channel: "PROJECTS", data: "" })
  // window.api.send(REMOTE, { id: msg.id, channel: "FOLDERS", data: "" })
  switch (msg.channel) {
    case "PASSWORD":
      msg.data = { dictionary: get(dictionary) }
      msg.data.password = get(remotePassword).length ? true : false
      if (!msg.data.password) {
        // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
        msg = { id: msg.id, channel: "SHOWS", data: get(shows) }

        sendData(REMOTE, { channel: "PROJECTS", data: get(projects) })
        window.api.send(REMOTE, { channel: "SHOWS", data: get(shows) })
        window.api.send(REMOTE, { channel: "FOLDERS", data: get(folders) })
        window.api.send(REMOTE, { channel: "PROJECT", data: get(activeProject) })

        let out: any = { slide: get(outSlide) ? get(outSlide)!.index : null, layout: get(outSlide)?.layout || null }
        if (out.slide !== null) {
          oldOutSlide = get(outSlide)!.id
          out.show = get(showsCache)[oldOutSlide]
        }
        window.api.send(REMOTE, { channel: "OUT", data: out })
      }
      break
    case "ACCESS":
      if (!get(remotePassword).length || msg.data === get(remotePassword)) {
        // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
        msg = { id: msg.id, channel: "SHOWS", data: get(shows) }

        sendData(REMOTE, { channel: "PROJECTS", data: get(projects) })
        window.api.send(REMOTE, { channel: "FOLDERS", data: { folders: get(folders), opened: get(openedFolders) } })
        window.api.send(REMOTE, { channel: "PROJECT", data: get(activeProject) })

        let out: any = { slide: get(outSlide) ? get(outSlide)!.index : null, layout: get(outSlide)?.layout || null }
        if (out.slide !== null) {
          oldOutSlide = get(outSlide)!.id
          out.show = get(showsCache)[oldOutSlide]
        }
        window.api.send(REMOTE, { channel: "OUT", data: out })
      } else msg = { id: msg.id, channel: "ERROR", data: "wrongPass" }
      break
    // case "SHOWS":
    //   msg.data: filterObjectArray(get(shows), ["name"])
    //   break
    case "SHOW":
      // msg.data = filterObjectArray(get(shows)[msg.data], [""])
      let showID: string = msg.data
      console.log(msg)

      await loadShows([showID])
      msg.data = { id: showID, ...get(showsCache)[showID] }

      if (msg.id) {
        if (!get(connections).REMOTE[msg.id]) get(connections).REMOTE[msg.id] = {}
        connections.update((sc) => {
          sc.REMOTE[msg.id!].active = showID
          return sc
        })
      }
      break
    case "OUT":
      let out = get(outSlide)
      let id: string = ""
      if (msg.data === "clear") {
        outSlide.set(null)
      } else if (msg.data?.id) {
        id = msg.data.id
        await loadShows([id])
        let layout = GetLayout(id)
        if (msg.data.index < layout.length && msg.data.index >= 0) outSlide.update(() => msg.data)
        msg.data = null
      } else if (msg.data !== null && msg.data !== undefined && out) {
        id = out.id
        let layout = GetLayout(id)
        if (msg.data < layout.length && msg.data >= 0) {
          outSlide.update((o) => {
            o!.index = msg.data
            return o
          })
        }
        msg.data = null
      } else {
        msg.data = { slide: out ? out.index : null, layout: out?.layout || null }
        if (out && out.id !== oldOutSlide) {
          id = out.id
          oldOutSlide = id
          msg.data.show = get(showsCache)[id]
          msg.data.show.id = id
        }
      }
      if (id.length && msg.id) {
        if (!get(connections).REMOTE[msg.id]) get(connections).REMOTE[msg.id] = {}
        connections.update((sc) => {
          sc.REMOTE[msg.id!].active = id
          return sc
        })
      }
      break
    case "PROJECTS":
      // msg.data = filterObjectArray(get(projects), ["name", "parent", "shows"])
      msg.data = get(projects)
      break
    // case "PROJECT":
    //   msg.data = filterObjectArray(get(projects), ["name", "parent"])
    //   break
  }
  return msg
}
let oldOutSlide = ""

// STAGE

function getStage(msg: ClientMessage) {
  switch (msg.channel) {
    case "SHOWS":
      msg.data = turnIntoBoolean(filterObjectArray(get(stageShows), ["enabled", "name", "password"], "enabled"), "password")
      break
    case "SHOW":
      if (msg.id) {
        let show = get(stageShows)[msg.data.id]
        if (!show.password.length || show.password === msg.data.password) {
          // connection successfull
          connections.update((sc) => {
            sc.STAGE[msg.id!].active = msg.data.id
            return sc
          })
          show = arrayToObject(filterObjectArray(get(stageShows), ["enabled", "name", "settings", "items"]))[msg.data.id]
          if (show.enabled) {
            msg.data = show
            sendData(STAGE, { channel: "SLIDES", data: [] })
          } else msg = { id: msg.id, channel: "ERROR", data: "noShow" }
        } else msg = { id: msg.id, channel: "ERROR", data: "wrongPass" }
      } else msg = { id: msg.id, channel: "ERROR", data: "missingID" }
      break
    case "SLIDES":
      let out = get(outSlide)
      msg.data = []
      if (out && get(activeShow)) {
        let layout = GetLayout(out.id, out.layout)
        let slides = get(showsCache)[out.id].slides
        msg.data = [slides[layout[out.index].id]]
        let index = out.index + 1
        while (index < layout.length && layout[index].disabled === true) index++
        if (index < layout.length && !layout[index].disabled) msg.data.push(slides[layout[index].id])
        else msg.data.push(null)
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
  return msg
}

export function filterObjectArray(object: any, keys: string[], filter: null | string = null) {
  return Object.entries(object)
    .map(([id, a]: any) => ({ id, ...keys.reduce((o, key) => ({ ...o, [key]: a[key] }), {}) }))
    .filter((a: any) => (filter ? a[filter] : true))
}
export function arrayToObject(array: any[], key: string = "id") {
  return array.reduce((o, a) => ({ ...o, [a[key]]: a }), {})
}
function turnIntoBoolean(array: any[], key: string) {
  return array.map((a) => {
    a[key] = a[key].length ? true : false
    return a
  })
}

// function getStageShows() {
//   return Object.entries(get(stageShows))
//     .map(([id, a]: any) => ({ id, enabled: a.enabled, name: a.name, password: a.password.length ? true : false }))
//     .filter((a) => a.enabled)
// }
// export function getStageShow() {
//   let obj = {}
//   Object.entries(get(stageShows))
//     .map(([id, a]: any) => ({ id, enabled: a.enabled, name: a.name, settings: a.settings, items: a.items }))
//     .filter((a) => a.enabled)
//   return obj
// }

// FUNCTIONS

// get data from client
export function client(id: "REMOTE" | "STAGE", msg: ClientMessage) {
  if (msg.channel === "CONNECTION") {
    connections.update((c: any) => {
      c[id][msg.id!] = msg.data
      return c
    })
    console.log(msg.id + " connected")
  } else if (msg.channel === "DISCONNECT") {
    connections.update((c: any) => {
      delete c[id][msg.id!]
      return c
    })
    console.log(msg.id + " disconnected")
  } else sendData(id, msg)
}

// send data to client
export async function sendData(id: "REMOTE" | "STAGE", msg: ClientMessage, check: boolean = false) {
  if (id === REMOTE) msg = await getRemote(msg)
  else if (id === STAGE) msg = getStage(msg)
  if (msg.data !== null && (!check || !checkSent(id, msg))) window.api.send(id, msg)
}

// limit data sent per second
let timeouts: any = {}
let time: number = 1000
export function timedout(id: "REMOTE" | "STAGE", msg: ClientMessage, run: Function) {
  let timeID = id + msg.id || "" + msg.channel
  if (!timeouts[timeID]) {
    timeouts[timeID] = true
    let first: string = JSON.stringify(msg.data)
    run()
    // TODO: msg does not change!!!
    setTimeout(() => {
      if (JSON.stringify(msg.data) !== first) run()
      delete timeouts[timeID]
    }, time)
  }
}

// check previous
var sent: any = { REMOTE: {}, STAGE: {} }
function checkSent(id: "REMOTE" | "STAGE", msg: any): boolean {
  let match: boolean = true
  if (sent[id][msg.channel] !== JSON.stringify(msg.data)) {
    sent[id][msg.channel] = JSON.stringify(msg.data)
    match = false
  }
  return match
}

// send data per connection to all
export function sendClientAll(id: "REMOTE" | "STAGE", channel: any, data: any, dataPerConnection: null | string = null) {
  Object.entries(get(connections)[id]).forEach(([clientID, value]: any) => {
    if (!dataPerConnection || data[value[dataPerConnection]]) window.api.send(id, { id: clientID, channel, data: dataPerConnection ? data[value[dataPerConnection]] : data })
  })
}
