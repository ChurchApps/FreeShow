import { get } from "svelte/store"
import { REMOTE, STAGE } from "../../types/Channels"
import type { ClientMessage } from "../../types/Socket"
import { GetLayout } from "../components/helpers/get"
import { getActiveOutputs, setOutput } from "../components/helpers/output"
import { loadShows } from "../components/helpers/setShow"
import { activeProject, connections, dictionary, folders, openedFolders, outputs, projects, remotePassword, shows, showsCache } from "../stores"
import { receiveSTAGE } from "./stageTalk"

// REMOTE

const receiveREMOTE: any = {
  PASSWORD: (msg: any) => {
    msg.data = {
      dictionary: get(dictionary),
      password: !!get(remotePassword).length,
    }
    if (msg.data.password) return msg

    connections.update((a: any) => {
      a.REMOTE[msg.id].entered = true
      return a
    })

    // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
    msg = { id: msg.id, channel: "SHOWS", data: get(shows) }
    initializeRemote(msg.id)

    return msg
  },
  ACCESS: (msg: any) => {
    if (get(remotePassword).length && msg.data !== get(remotePassword)) return { id: msg.id, channel: "ERROR", data: "wrongPass" }

    connections.update((a: any) => {
      console.log(a, msg.id)
      a.REMOTE[msg.id].entered = true
      return a
    })

    // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
    msg = { id: msg.id, channel: "SHOWS", data: get(shows) }
    initializeRemote(msg.id)

    return msg
  },
  // SHOWS: (msg: any) => {
  //   msg.data = filterObjectArray(get(shows), ["name"])
  //   return msg
  // },
  SHOW: async (msg: any) => {
    // msg.data = filterObjectArray(get(shows)[msg.data], [""])
    let showID: string = msg.data
    console.log(msg)

    await loadShows([showID])
    msg.data = { id: showID, ...get(showsCache)[showID] }

    if (msg.id) {
      connections.update((a) => {
        if (!a.REMOTE[msg.id!]) a.REMOTE[msg.id!] = {}
        a.REMOTE[msg.id!].active = showID
        return a
      })
    }

    return msg
  },
  OUT: async (msg: any) => {
    let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
    let out: any = currentOutput?.out?.slide || null
    let id: string = ""
    if (msg.data === "clear") {
      setOutput("slide", null)
    } else if (msg.data?.id) {
      id = msg.data.id
      await loadShows([id])
      let layout = GetLayout(id)
      if (msg.data.index < layout.length && msg.data.index >= 0) setOutput("slide", msg.data)
      msg.data = null
    } else if (msg.data !== null && msg.data !== undefined && out) {
      id = out.id
      let layout = GetLayout(id)
      if (msg.data < layout.length && msg.data >= 0) {
        let newOutSlide: any = { ...out, index: msg.data }
        setOutput("slide", newOutSlide)
      }
      msg.data = null
    } else {
      msg.data = { slide: out ? out.index : null, layout: out?.layout || null }
      if (out && out.id !== "temp" && out.id !== oldOutSlide) {
        id = out.id
        oldOutSlide = id
        msg.data.show = get(showsCache)[id]
        msg.data.show.id = id
      }
    }
    if (id.length && msg.id) {
      connections.update((a) => {
        if (!a.REMOTE[msg.id!]) a.REMOTE[msg.id!] = {}
        a.REMOTE[msg.id!].active = id
        return a
      })
    }

    return msg
  },
  PROJECTS: (msg: any) => {
    msg.data = get(projects)
    return msg
  },
}

function initializeRemote(id: string) {
  console.log(id)
  window.api.send(REMOTE, { channel: "ACCESS" })

  sendData(REMOTE, { channel: "PROJECTS", data: get(projects) })
  window.api.send(REMOTE, { channel: "FOLDERS", data: { folders: get(folders), opened: get(openedFolders) } })
  window.api.send(REMOTE, { channel: "PROJECT", data: get(activeProject) })

  let currentOutput: any = get(outputs)[getActiveOutputs()[0]]
  let out: any = { slide: currentOutput?.out?.slide ? currentOutput.out.slide.index : null, layout: currentOutput.out?.slide?.layout || null }
  if (out.slide !== null) {
    oldOutSlide = out.slide.id
    out.show = get(showsCache)[oldOutSlide]
  }
  window.api.send(REMOTE, { channel: "OUT", data: out })
}

// async function getRemote(msg: ClientMessage) {
//   // let initialize: ClientMessage = {
//   //   id: msg.id,
//   //   channel: "DATA",
//   //   data: {
//   //     name: get(name) || "Computer",
//   //     lang: get(language),
//   //     // activeShow: get(activeShow),
//   //     // activeProject: get(activeProject),
//   //     // projects: get(projects),
//   //     // folders: get(folders),
//   //   },
//   // }
//   // window.api.send(REMOTE, initialize)
//   // window.api.send(REMOTE, { id: msg.id, channel: "ACTIVE_SHOW", data: "" })
//   // window.api.send(REMOTE, { id: msg.id, channel: "PROJECT", data: "" })
//   // window.api.send(REMOTE, { id: msg.id, channel: "PROJECTS", data: "" })
//   // window.api.send(REMOTE, { id: msg.id, channel: "FOLDERS", data: "" })
//   switch (msg.channel) {
//     case "PASSWORD":
//       msg.data = { dictionary: get(dictionary) }
//       msg.data.password = get(remotePassword).length ? true : false
//       if (!msg.data.password) {
//         // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
//         msg = { id: msg.id, channel: "SHOWS", data: get(shows) }

//         sendData(REMOTE, { id: msg.id, channel: "PROJECTS", data: get(projects) })
//         // window.api.send(REMOTE, { id: msg.id, channel: "SHOWS", data: get(shows) })
//         window.api.send(REMOTE, { id: msg.id, channel: "FOLDERS", data: get(folders) })
//         window.api.send(REMOTE, { id: msg.id, channel: "PROJECT", data: get(activeProject) })

//         let out: any = { slide: get(outSlide) ? get(outSlide)!.index : null, layout: get(outSlide)?.layout || null }
//         if (out.slide !== null) {
//           oldOutSlide = get(outSlide)!.id
//           out.show = get(showsCache)[oldOutSlide]
//         }
//         window.api.send(REMOTE, { id: msg.id, channel: "OUT", data: out })
//       }
//       break
//     case "ACCESS":
//       if (!get(remotePassword).length || msg.data === get(remotePassword)) {
//         // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
//         msg = { id: msg.id, channel: "SHOWS", data: get(shows) }

//         sendData(REMOTE, { id: msg.id, channel: "PROJECTS", data: get(projects) })
//         window.api.send(REMOTE, { id: msg.id, channel: "FOLDERS", data: { folders: get(folders), opened: get(openedFolders) } })
//         window.api.send(REMOTE, { id: msg.id, channel: "PROJECT", data: get(activeProject) })

//         let out: any = { slide: get(outSlide) ? get(outSlide)!.index : null, layout: get(outSlide)?.layout || null }
//         if (out.slide !== null) {
//           oldOutSlide = get(outSlide)!.id
//           out.show = get(showsCache)[oldOutSlide]
//         }
//         window.api.send(REMOTE, { id: msg.id, channel: "OUT", data: out })
//       } else msg = { id: msg.id, channel: "ERROR", data: "wrongPass" }
//       break
//     // case "SHOWS":
//     //   msg.data: filterObjectArray(get(shows), ["name"])
//     //   break
//     case "SHOW":
//       // msg.data = filterObjectArray(get(shows)[msg.data], [""])
//       let showID: string = msg.data
//       console.log(msg)

//       await loadShows([showID])
//       msg.data = { id: showID, ...get(showsCache)[showID] }

//       if (msg.id) {
//         connections.update((a) => {
//           if (!a.REMOTE[msg.id!]) a.REMOTE[msg.id!] = {}
//           a.REMOTE[msg.id!].active = showID
//           return a
//         })
//       }
//       break
//     case "OUT":
//       let out = get(outSlide)
//       let id: string = ""
//       if (msg.data === "clear") {
//         outSlide.set(null)
//       } else if (msg.data?.id) {
//         id = msg.data.id
//         await loadShows([id])
//         let layout = GetLayout(id)
//         if (msg.data.index < layout.length && msg.data.index >= 0) outSlide.update(() => msg.data)
//         msg.data = null
//       } else if (msg.data !== null && msg.data !== undefined && out) {
//         id = out.id
//         let layout = GetLayout(id)
//         if (msg.data < layout.length && msg.data >= 0) {
//           outSlide.update((o) => {
//             o!.index = msg.data
//             return o
//           })
//         }
//         msg.data = null
//       } else {
//         msg.data = { slide: out ? out.index : null, layout: out?.layout || null }
//         if (out && out.id !== "temp" && out.id !== oldOutSlide) {
//           id = out.id
//           oldOutSlide = id
//           msg.data.show = get(showsCache)[id]
//           msg.data.show.id = id
//         }
//       }
//       if (id.length && msg.id) {
//         connections.update((a) => {
//           if (!a.REMOTE[msg.id!]) a.REMOTE[msg.id!] = {}
//           a.REMOTE[msg.id!].active = id
//           return a
//         })
//       }
//       break
//     case "PROJECTS":
//       // msg.data = filterObjectArray(get(projects), ["name", "parent", "shows"])
//       msg.data = get(projects)
//       break
//     // case "PROJECT":
//     //   msg.data = filterObjectArray(get(projects), ["name", "parent"])
//     //   break
//   }
//   return msg
// }
let oldOutSlide = ""

export function filterObjectArray(object: any, keys: string[], filter: null | string = null) {
  return Object.entries(object)
    .map(([id, a]: any) => ({ id, ...keys.reduce((o, key) => ({ ...o, [key]: a[key] }), {}) }))
    .filter((a: any) => (filter ? a[filter] : true))
}
export function arrayToObject(array: any[], key: string = "id") {
  return array.reduce((o, a) => ({ ...o, [a[key]]: a }), {})
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
      c[id][msg.id!] = { entered: false, ...msg.data }
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
  if (id === REMOTE) {
    if (!receiveREMOTE[msg.channel]) return console.log("UNKNOWN CHANNEL:", msg.channel)
    msg = await receiveREMOTE[msg.channel](msg)
  } else if (id === STAGE) {
    if (!receiveSTAGE[msg.channel]) return console.log("UNKNOWN CHANNEL:", msg.channel)
    msg = receiveSTAGE[msg.channel](msg)
  }

  // let ids: string[] = []
  // if (msg.id) ids = [msg.id]
  // else ids = Object.keys(get(connections).REMOTE)
  if (msg && msg.data !== null && (!check || !checkSent(id, msg))) {
    window.api.send(id, msg)
    // ids.forEach((id) => {
    // window.api.send(id, { id, ...msg })
    // })
  }
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
