import { get } from "svelte/store"
import { SHOW } from "../../../types/Channels"
import type { Show } from "../../../types/Show"
import { notFound, shows, showsCache, showsPath, textCache } from "../../stores"

export function setShow(id: string, value: "delete" | Show): Show {
  let previousValue: Show

  showsCache.update((a) => {
    previousValue = a[id]
    if (value === "delete") delete a[id]
    else {
      saveTextCache(id, value)
      a[id] = value
    }
    // send(OUTPUT, ["SHOWS"], a)
    return a
  })

  shows.update((a) => {
    if (value === "delete") delete a[id]
    else {
      a[id] = {
        name: value.name,
        category: value.category,
        timestamps: value.timestamps,
      }
      if (a[id].private) a[id].private = true
    }
    return a
  })

  console.log("SHOW UPDATED: ", id, value)

  // add to shows index
  // if (update) {
  //   console.log("UPDATE SHOW")
  //   window.api.send(STORE, { channel: "SHOW", data: { id, value: get(shows)[id] } })
  // }

  return previousValue!
}

export async function loadShows(s: string[]) {
  return new Promise((resolve) => {
    let count = 0

    s.forEach((id) => {
      if (!get(shows)[id]) {
        count++
        notFound.update((a) => {
          a.show.push(id)
          return a
        })
        // resolve("not_found")
      } else if (!get(showsCache)[id]) {
        console.log("LOAD SHOWS:", s)
        window.api.send(SHOW, { path: get(showsPath), name: get(shows)[id].name, id })
      } else count++
      // } else resolve("already_loaded")
    })

    // RECEIVE
    window.api.receive(SHOW, (msg: any) => {
      count++
      if (msg.error) {
        notFound.update((a) => {
          a.show.push(msg.id)
          return a
        })
        // resolve("not_found")
      } else if (!get(showsCache)[msg.id]) {
        if (get(notFound).show.includes(msg.id)) {
          notFound.update((a) => {
            a.show.splice(a.show.indexOf(msg.id), 1)
            return a
          })
        }

        setShow(msg.content[0], msg.content[1])
      }
      // console.log(count, s, msg, "LOAD")

      if (count >= s.length) {
        setTimeout(() => {
          resolve("loaded")
        }, 50)
      }
    })
    if (count >= s.length) resolve("loaded")
  })
}

export function saveTextCache(id: string, show: Show) {
  if (!show) return

  // get text
  let txt = ""
  Object.values(show.slides).forEach((slide) => {
    slide.items.forEach((item) => {
      item.lines?.forEach((line) => {
        line.text?.forEach((text) => {
          txt += text.value
        })
        txt += " "
      })
      // txt += " - LINE - "
    })
  })

  // trim
  txt = txt.toLowerCase()
  // txt = txt.toLowerCase().replace(/[^a-z0-9 ]+/g, "")

  // encode
  // txt = window.btoa(txt)
  // txt = Buffer.from(txt).toString("base64")
  // Buffer.from(encode, 'base64').toString('utf-8')
  // window.atob(encode)

  textCache.update((a) => {
    a[id] = txt
    return a
  })
}
