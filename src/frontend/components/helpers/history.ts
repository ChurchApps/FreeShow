import { GetShow } from "./get"
import { shows, redoHistory, mediaFolders } from "./../../stores"
import type { ShowRef } from "./../../../types/Projects"
import { undoHistory } from "../../stores"
import { get } from "svelte/store"
import type { Item } from "../../../types/Show"

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
export function history(obj: History, undo: null | boolean = null) {
  // if (undo) {
  //   let tempObj = obj
  //   obj.newData = tempObj.oldData
  //   obj.oldData = tempObj.newData
  // }

  // console.log(obj)

  switch (obj.id) {
    case "textStyle":
    case "deleteItem":
    case "itemStyle":
      shows.update((s) => {
        let items = GetShow(obj.location.show!).slides[obj.location.slide!].items
        obj.newData.forEach((item: Item, i: number) => {
          items[i] = item
        })
        // items.forEach(item => {
        //   item = obj.newData
        // });
        // GetShow(obj.location.show!).slides[obj.location.slide!].items[obj.location.item!] = obj.newData
        return s
      })
      break
    case "slideStyle":
      shows.update((s) => {
        let slide = GetShow(obj.location.show!).slides[obj.location.slide!]
        slide.style = obj.newData
        return s
      })
      break
    case "newMediaFolder":
      mediaFolders.update((mf) => {
        if (obj.newData.data === null) {
          // remove folder
          delete mf[obj.newData.id]
        } else mf[obj.newData.id] = obj.newData.data
        return mf
      })
      break

    default:
      console.log(obj)
      break
  }

  if (undo === null) redoHistory.set([])

  if (undo) {
    redoHistory.update((rh: History[]) => {
      rh.push(obj)
      return rh
    })
  } else {
    undoHistory.update((uh: History[]) => {
      // if id and location is equal push new data to previous stored
      if (undo === null && uh[uh.length - 1]?.id === obj.id && JSON.stringify(Object.values(uh[uh.length - 1]?.location)) === JSON.stringify(Object.values(obj.location))) {
        uh[uh.length - 1].newData = obj.newData
      } else uh.push(obj)
      return uh
    })
  }
  console.log("UNDO: ", [...get(undoHistory)])
  console.log("REDO: ", [...get(redoHistory)])
}

export const undo = () => {
  if (get(undoHistory).length) {
    let lastUndo: History
    undoHistory.update((uh: History[]) => {
      lastUndo = uh.pop()!
      return uh
    })

    let oldData: any = lastUndo!.oldData
    lastUndo!.oldData = lastUndo!.newData
    lastUndo!.newData = oldData

    history(lastUndo!, true)
  }
}

export const redo = () => {
  if (get(redoHistory).length) {
    let lastRedo: History
    redoHistory.update((rh: History[]) => {
      lastRedo = rh.pop()!
      return rh
    })

    let oldData: any = lastRedo!.oldData
    lastRedo!.oldData = lastRedo!.newData
    lastRedo!.newData = oldData

    history(lastRedo!, false)
  }
}

// {
//   action: "moveSlide",
//   fromState: 2,
//   page: "shows",
// },
