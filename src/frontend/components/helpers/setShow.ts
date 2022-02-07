import { get } from "svelte/store"
import { SHOW } from "../../../types/Channels"
import type { Show } from "../../../types/Show"
import { notFound, shows, showsCache, showsPath } from "../../stores"

export function setShow(id: string, value: "delete" | Show): Show {
  let previousValue: Show

  showsCache.update((a) => {
    previousValue = a[id]
    if (value === "delete") delete a[id]
    else a[id] = value
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
    s.forEach((id) => {
      if (!get(shows)[id]) {
        notFound.update((a) => {
          a.show.push(id)
          return a
        })
        resolve("not_found")
      } else if (!get(showsCache)[id]) {
        console.log("LOAD SHOWS:", s)
        window.api.send(SHOW, { path: get(showsPath), name: get(shows)[id].name, id })

        // RECEIVE
        window.api.receive(SHOW, (msg: any) => {
          if (msg.error) {
            notFound.update((a) => {
              a.show.push(msg.id)
              return a
            })
            resolve("not_found")
          } else {
            if (get(notFound).show.includes(msg.id)) {
              notFound.update((a) => {
                a.show.splice(a.show.indexOf(msg.id), 1)
                return a
              })
            }

            setShow(msg.show[0], msg.show[1])
            resolve("loaded")
          }
        })
      } else resolve("already_loaded")
    })
  })
}
