import { ShowObj } from "../../classes/Show"
import { uid } from "uid"
import { GetShow } from "./get"
import { dateToString } from "../helpers/time"
import {
  shows,
  activeProject,
  activeEdit,
  projects,
  redoHistory,
  mediaFolders,
  projectView,
  folders,
  openedFolders,
  defaultName,
  drawerTabsData,
  activeShow,
  categories,
  stageShows,
} from "./../../stores"
import type { ShowRef, Project, Folder } from "./../../../types/Projects"
import { undoHistory } from "../../stores"
import { get } from "svelte/store"
import type { Slide } from "../../../types/Show"
import { GetLayout } from "../helpers/get"

export type HistoryPages = "drawer" | "shows" | "edit" | "stage"
export type HistoryIDs =
  | "textStyle"
  | "deleteItem"
  | "itemStyle"
  | "itemAlign"
  | "stageItemAlign"
  | "stageItemStyle"
  | "slideStyle"
  | "newMediaFolder"
  | "newProject"
  | "newFolder"
  | "newShowDrawer"
  | "newShow"
  | "newPrivateShow"
  | "newShowsCategory"
  | "newSlide"
  | "newItem"
  | "addShow"
  | "slides"
  | "shows"
  | "project"
  | "projects"
  | "drawer"
export interface History {
  id: HistoryIDs
  oldData?: any
  newData?: any
  location?: {
    page: HistoryPages
    show?: ShowRef
    layout?: string
    slide?: string
    items?: any[]
  }
}
export function history(obj: History, undo: null | boolean = null) {
  // if (undo) {
  //   let tempObj = obj
  //   obj.newData = tempObj.oldData
  //   obj.oldData = tempObj.newData
  // }

  // let page: HistoryPages = obj.location?.page || "shows"
  if (!obj.location) obj.location = { page: "shows" }
  if (!obj.oldData) obj.oldData = null
  if (!obj.newData) obj.newData = null

  // console.log(obj)

  switch (obj.id) {
    // EDIT
    // style
    case "textStyle":
    case "deleteItem":
      shows.update((s) => {
        console.log(obj.location!.items)

        obj.location!.items!.forEach((item, index) => {
          s[obj.location!.show!.id!].slides[obj.location!.slide!].items[item] = obj.newData[index]
        })
        // let items: Item[] = GetShow(obj.location?.show!).slides[obj.location?.slide!].items
        // obj.newData.forEach((item: Item, i: number) => {
        //   items[i] = item
        // })
        // items.forEach(item => {
        //   item = obj.newData
        // });
        // GetShow(obj.location.show!).slides[obj.location.slide!].items[obj.location.item!] = obj.newData
        return s
      })
      break
    case "itemStyle":
    case "itemAlign":
      shows.update((s) => {
        obj.location!.items!.forEach((item, index) => {
          s[obj.location!.show!.id!].slides[obj.location!.slide!].items[item][obj.id === "itemStyle" ? "style" : "align"] = obj.newData[index]
        })
        return s
      })
      break
    case "stageItemStyle":
    case "stageItemAlign":
      stageShows.update((s) => {
        obj.location!.items!.forEach((item, index) => {
          s[obj.location!.slide!].items[item][obj.id === "stageItemStyle" ? "style" : "align"] = obj.newData[index]
        })
        return s
      })
      break
    case "slideStyle":
      shows.update((s) => {
        let slide: Slide = GetShow(obj.location?.show!).slides[obj.location?.slide!]
        slide.settings = obj.newData
        return s
      })
      break
    // MOVE
    case "project": // projecList
      projects.update((p) => {
        p[get(activeProject)!].shows = obj.newData
        return p
      })
      break
    // NEW
    case "newMediaFolder":
      mediaFolders.update((mf) => {
        if (obj.newData.data === null) {
          // remove folder
          delete mf[obj.newData.id]
        } else mf[obj.newData.id] = obj.newData.data
        return mf
      })
      break
    case "newProject":
      if (typeof obj.newData === "string") {
        projects.update((p) => {
          delete p[obj.newData]
          return p
        })
        if (get(activeProject) === obj.newData) {
          activeProject.set(null)
          projectView.set(true)
        }
      } else {
        let project: Project = obj.newData
        let id: string = obj.oldData

        if (obj.newData === null) {
          let name: string = ""
          let created: Date = new Date()
          if (get(defaultName) === "date") name = dateToString(created)
          project = { name, created, parent: obj.oldData || get(projects)[get(activeProject)!]?.parent || "/", shows: [] }
          id = uid()
          obj.newData = project
          obj.oldData = id
          // TODO: edit name...
        }
        projects.update((p) => {
          p[id] = project
          return p
        })
        activeProject.set(id)
      }
      // remove active show index
      if (get(activeShow) !== null) {
        activeShow.update((as: any) => {
          as.index = null
          return as
        })
      }
      // open parent folder if closed
      if (!get(openedFolders).includes(obj.newData.parent)) {
        openedFolders.update((f) => {
          f.push(obj.newData.parent)
          return f
        })
      }
      break
    case "newFolder":
      if (typeof obj.newData === "string") {
        folders.update((p) => {
          delete p[obj.newData]
          return p
        })
        if (get(openedFolders).includes(obj.newData)) {
          openedFolders.update((f) => {
            return f.filter((id) => id !== obj.newData)
          })
        }
      } else {
        let folder: Folder = obj.newData
        let id: string = obj.oldData
        if (obj.newData === null) {
          folder = { name: "", parent: id || get(folders)[get(projects)[get(activeProject)!]?.parent]?.parent || "/" }
          id = uid()
          obj.newData = folder
          obj.oldData = id
          // TODO: edit name...
        }
        openedFolders.update((f) => {
          if (!f.includes(folder.parent)) f.push(folder.parent)
          f.push(id)
          console.log(f)
          return f
        })
        folders.update((p) => {
          p[id] = folder
          return p
        })
      }
      break
    case "newShowDrawer":
    case "newShow":
    case "newPrivateShow":
      // TODO: undo
      // show dialog
      // new Show()
      let category: null | string = null
      if (get(drawerTabsData).shows.activeSubTab !== "all") category = get(drawerTabsData).shows.activeSubTab
      obj.newData = new ShowObj(obj.id === "newPrivateShow", category)
      console.log(obj.newData)

      obj.oldData = console.log(obj.newData)
      let id: string = uid(16)
      // obj.id === "newShowDrawer"
      shows.update((s) => {
        s[id] = obj.newData
        return s
      })
      // history addShow...
      if (obj.id !== "newShowDrawer" && activeProject !== null) {
        projects.update((p) => {
          p[get(activeProject)!].shows.push({ id })
          return p
        })
      }
      // TODO: remove search filter
      break
    case "newShowsCategory":
      categories.update((c) => {
        // TODO: undo
        if (undo) c = obj.oldData
        else {
          if (!obj.newData) {
            let id = uid()
            let icon: null | string = null
            let tab = get(drawerTabsData).shows.activeSubTab
            if (tab !== "all" && tab !== "unlabeled") icon = get(drawerTabsData).shows.activeSubTab
            obj.newData = { id, data: { name: "", icon } }
            obj.oldData = { ...c }
          }
          c[obj.newData.id] = obj.newData.data
        }
        return c
      })
      break
    case "newSlide":
      // TODO: undo
      shows.update((s) => {
        // TODO: add after activeEdit.index (+ children slides...)
        let id = uid()
        if (obj.newData) id = obj.newData[0]
        // TODO: add by template
        // TODO: add as child to previous
        s[get(activeShow)!.id].slides[id] = { label: "", color: null, settings: {}, notes: "", items: [] }
        s[get(activeShow)!.id].layouts[s[get(activeShow)!.id].settings.activeLayout].slides.push({ id })
        return s
      })
      if (undo) {
        // TODO: undo
        // decrement active edit slide index if removed slide(s) is active
      } else {
        activeEdit.update((ae) => {
          ae.slide = GetLayout().length - 1
          return ae
        })
      }
      break
    case "newItem":
      // TODO: undo
      shows.update((s) => {
        let slide: Slide = s[obj.location!.show!.id].slides[obj.location!.slide!]
        if (undo) {
          slide.items = slide.items.splice(slide.items.indexOf(obj.oldData, 1))
        } else {
          obj.oldData = slide.items.length
          slide.items.push(obj.newData)
        }
        return s
      })
      break

    // ADD
    case "addShow":
      if (activeProject !== null) {
        console.log(undo)

        if (obj.oldData === null) obj.oldData = [get(activeProject), [...get(projects)[get(activeProject)!].shows]]
        console.log(obj.oldData)
        projects.update((p) => {
          if (typeof obj.newData === "string") p[obj.oldData[0]].shows = [...p[obj.oldData[0]].shows, { id: obj.newData }]
          else p[obj.newData[0]].shows = obj.newData[1]
          console.log(p)
          return p
        })
        console.log([...obj.newData], [...obj.oldData])
      }
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
      // not: project | newProject | newFolder | addShow
      if (
        undo === null &&
        uh[uh.length - 1]?.id === obj.id &&
        JSON.stringify(Object.values(uh[uh.length - 1]?.location!)) === JSON.stringify(Object.values(obj.location!)) &&
        obj.id !== "project" &&
        obj.id !== "newProject" &&
        obj.id !== "newFolder" &&
        obj.id !== "addShow"
      ) {
        uh[uh.length - 1].newData = obj.newData
      } else uh.push(obj)
      return uh
    })
  }
  console.log("UNDO: ", [...get(undoHistory)])
  console.log("REDO: ", [...get(redoHistory)])

  // TODO: go to location
}

export const undo = () => {
  if (get(undoHistory).length) {
    let lastUndo: History
    undoHistory.update((uh: History[]) => {
      lastUndo = uh.pop()!
      return uh
    })

    let oldData: any = { ...lastUndo!.oldData }
    lastUndo!.oldData = { ...lastUndo!.newData }
    lastUndo!.newData = oldData

    history(lastUndo!, true)
  }
}

// TODO: redo not working in same order as undo...
export const redo = () => {
  if (get(redoHistory).length) {
    let lastRedo: History
    redoHistory.update((rh: History[]) => {
      lastRedo = rh.pop()!
      return rh
    })

    let oldData: any = { ...lastRedo!.oldData }
    lastRedo!.oldData = { ...lastRedo!.newData }
    lastRedo!.newData = oldData

    history(lastRedo!, false)
  }
}

// {
//   action: "moveSlide",
//   fromState: 2,
//   page: "shows",
// },
