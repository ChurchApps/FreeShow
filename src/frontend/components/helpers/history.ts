import { GetShow } from "./get"
import { shows, redoHistory } from "./../../stores"
import type { ShowRef } from "./../../../types/Projects"
import { undoHistory } from "../../stores"
import { get } from "svelte/store"

export interface History {
  id: string
  oldData: any
  newData: any
  location: {
    page: string
    show?: ShowRef
    layout?: string
    slide?: string
    item?: number
  }
}
export function history(obj: History, undo: boolean = false) {
  if (undo) {
    let tempObj = obj
    obj.newData = tempObj.oldData
    obj.oldData = tempObj.newData
  }

  console.log(obj)

  switch (obj.id) {
    case "textStyle":
      shows.update((s) => {
        GetShow(obj.location.show!).slides[obj.location.slide!].items[obj.location.item!] = obj.newData
        return s
      })
      break

    default:
      break
  }

  if (undo) {
    redoHistory.update((rh: History[]) => {
      rh.push(obj)
      return rh
    })
  } else {
    undoHistory.update((uh: History[]) => {
      uh.push(obj)
      return uh
    })
  }
}

export const undo = () => {
  if (get(undoHistory).length) {
    undoHistory.update((uh: History[]) => {
      uh.slice(uh.length - 2, uh.length - 1)
      return uh
    })
    history(get(undoHistory)[get(undoHistory).length - 1], true)
  }
}

// {
//   action: "moveSlide",
//   fromState: 2,
//   page: "shows",
// },
