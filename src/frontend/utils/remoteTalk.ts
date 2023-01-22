import { get } from "svelte/store"
import { clone } from "../components/helpers/array"
import { getActiveOutputs, setOutput } from "../components/helpers/output"
import { loadShows } from "../components/helpers/setShow"
import { updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { REMOTE } from "./../../types/Channels"
import { GetLayout } from "./../components/helpers/get"
import { activeProject, connections, dictionary, folders, mediaCache, openedFolders, outputs, projects, remotePassword, shows, showsCache } from "./../stores"
import { sendData } from "./sendData"

// REMOTE

export const receiveREMOTE: any = {
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
        msg.data = { id: showID, ...convertBackgrounds(get(showsCache)[showID]) }
        // send(REMOTE, ["MEDIA"], { media: msg.data.media })

        if (msg.id) {
            connections.update((a) => {
                if (!a.REMOTE) a.REMOTE = {}
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
            setOutput("background", null)
            setOutput("overlays", [])
            // setOutput("audio", [])
            // setOutput("transition", null)
        } else if (msg.data?.id) {
            id = msg.data.id
            await loadShows([id])
            let layout = GetLayout(id)
            if (msg.data.index < layout.length && msg.data.index >= 0) {
                updateOut(msg.data.id, msg.data.index, _show(msg.data.id).layouts([msg.data.layout]).ref()[0])
                setOutput("slide", msg.data)
            }
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
                msg.data.show = convertBackgrounds(get(showsCache)[id])
                msg.data.show.id = id
            }
        }
        if (id.length && msg.id) {
            connections.update((a) => {
                if (!a.REMOTE) a.REMOTE = {}
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

let oldOutSlide = ""
export function initializeRemote(id: string) {
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
//           if (!a.REMOTE) a.REMOTE = {}
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
//           if (!a.REMOTE) a.REMOTE = {}
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

export function convertBackgrounds(show) {
    show = clone(show)
    console.log("SHOW", show)
    // let media = {}
    Object.keys(show.media).map((id) => {
        let cachedImage: any = get(mediaCache)[show.media[id].path]
        console.log(cachedImage)
        if (cachedImage) show.media[id].path = cachedImage.data // "data:image/png;base64," +
        // let path = await toBase64(show.media[id].path)
    })

    console.log("SHOW2", show)
    return show
}

// const toBase64 = file => new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.readAsDataURL(file);
//     reader.onload = () => resolve(reader.result);
//     reader.onerror = error => reject(error);
// });
