import { GetLayout } from "./../components/helpers/get"
import type { ClientMessage } from "./../../types/Socket"
import { REMOTE, STAGE } from "./../../types/Channels"
import { get } from "svelte/store"
import { showsCache, outSlide, stageShows, connections, remotePassword, projects, folders, activeProject } from "./../stores"

// REMOTE

function getRemote(msg: ClientMessage) {
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
      msg.data = get(remotePassword).length ? true : false
      if (!msg.data) {
        msg = { id: msg.id, channel: "SHOWS", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }

        sendData(REMOTE, { channel: "PROJECTS" })
        window.api.send(REMOTE, { channel: "FOLDERS", data: get(folders) })
        window.api.send(REMOTE, { channel: "PROJECT", data: get(activeProject) })

        let out: any = { slide: get(outSlide) ? get(outSlide)!.index : null }
        if (out.slide !== null) {
          oldOutSlide = get(outSlide)!.id
          out.show = get(showsCache)[oldOutSlide]
        }
        window.api.send(REMOTE, { channel: "OUT", data: out })
      }
      break
    case "ACCESS":
      if (msg.data === get(remotePassword)) {
        msg = { id: msg.id, channel: "SHOWS", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }

        sendData(REMOTE, { channel: "PROJECTS" })
        window.api.send(REMOTE, { channel: "FOLDERS", data: get(folders) })
        window.api.send(REMOTE, { channel: "PROJECT", data: get(activeProject) })

        let out: any = { slide: get(outSlide) ? get(outSlide)!.index : null }
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
      msg.data = get(showsCache)[showID]
      msg.data.id = showID
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
        msg.data = { slide: out ? out.index : null }
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
      msg.data = filterObjectArray(get(projects), ["name", "parent", "shows"])
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
      if (out) {
        let layout = GetLayout(out.id, out.layout)
        msg.data = [get(showsCache)[out.id].slides[layout[out.index].id]]
        if (out.index + 1 < layout.length) msg.data.push(get(showsCache)[out.id].slides[layout[out.index + 1].id])
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
export function sendData(id: "REMOTE" | "STAGE", msg: ClientMessage, check: boolean = false) {
  if (id === REMOTE) msg = getRemote(msg)
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
