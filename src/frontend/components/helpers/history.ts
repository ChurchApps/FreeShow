import { get } from "svelte/store"
import { uid } from "uid"
import type { Slide } from "../../../types/Show"
import { ShowObj } from "../../classes/Show"
import { activePage, undoHistory } from "../../stores"
import { dateToString } from "../helpers/time"
import type { Folder, Project, ShowRef } from "./../../../types/Projects"
import {
  activeDrawerTab,
  activeEdit,
  activeProject,
  activeShow,
  categories,
  defaultProjectName,
  drawerTabsData,
  events,
  folders,
  groups,
  mediaFolders,
  openedFolders,
  outOverlays,
  overlays,
  projects,
  projectView,
  redoHistory,
  showsCache,
  stageShows,
  templates,
  theme,
  themes,
} from "./../../stores"
import { GetLayout, GetLayoutRef, GetShow } from "./get"
import { getGroup } from "./getGroup"
import { addToPos } from "./mover"
import { setShow } from "./setShow"

export type HistoryPages = "drawer" | "show" | "edit" | "stage" | "settings"
export type HistoryIDs =
  // edit
  | "textStyle"
  | "deleteItem"
  | "itemStyle"
  | "itemAlign"
  | "slideStyle"
  // stage
  | "stageItemAlign"
  | "stageItemStyle"
  // new
  | "newMediaFolder"
  | "newProject"
  | "newFolder"
  | "newShowDrawer"
  | "newShow"
  | "newPrivateShow"
  | "newShowsCategory"
  | "newSlide"
  | "newItem"
  // delete
  | "deleteShowsCategory"
  // add
  | "addShow"
  | "addLayout"
  // show
  | "deleteShow"
  | "updateShow"
  | "slide"
  | "changeSlide"
  | "showMedia"
  | "changeLayout"
  | "changeLayouts"
  // project
  | "project"
  | "projects"
  | "drawer"
  // other
  | "slideToOverlay"
  | "newEvent"
  | "template"
  // settings
  | "theme"
  | "addTheme"
  | "addGlobalGroup"

export interface History {
  id: HistoryIDs
  oldData?: any
  newData?: any
  location?: {
    page: HistoryPages
    project?: null | string
    show?: ShowRef
    shows?: any[]
    layout?: string
    layoutSlide?: number
    slide?: string
    items?: any[]
    theme?: string
  }
}

// override previous history
const override = ["textStyle", "deleteItem", "itemStyle", "itemAlign", "stageItemAlign", "stageItemStyle", "slideStyle", "changeLayout", "theme"]

export function history(obj: History, undo: null | boolean = null) {
  // if (undo) {
  //   let tempObj = obj
  //   obj.newData = tempObj.oldData
  //   obj.oldData = tempObj.newData
  // }

  // let page: HistoryPages = obj.location?.page || "shows"
  if (!obj.location) obj.location = { page: get(activePage) as any }
  if (!obj.oldData) obj.oldData = null
  if (!obj.newData) obj.newData = null

  // console.log(obj)

  switch (obj.id) {
    // EDIT
    // style
    case "textStyle":
    case "deleteItem":
      showsCache.update((s) => {
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
      showsCache.update((s) => {
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
      showsCache.update((s) => {
        let slide: Slide = GetShow(obj.location?.show!).slides[obj.location?.slide!]
        slide.settings = obj.newData
        return s
      })
      break
    // MOVE
    case "project": // projecList
      projects.update((p) => {
        p[get(activeProject)!].shows = obj.newData
        // TODO: p[obj.location!.project].shows = obj.newData
        return p
      })
      break
    case "slide":
      showsCache.update((a) => {
        a[obj.location!.show!.id].slides = obj.newData.slides
        a[obj.location!.show!.id].layouts[obj.location!.layout!].slides = obj.newData.layout
        return a
      })
      break
    // show
    case "changeSlide":
      showsCache.update((a) => {
        if (!obj.oldData) obj.oldData = {}
        let slide: any = a[obj.location!.show!.id].slides[obj.location!.slide!]
        Object.entries(obj.newData).forEach(([key, value]: any) => {
          if (undo) slide[key] = obj.newData[key]
          else {
            obj.oldData[key] = slide[key] || null
            slide[key] = value
          }
        })
        return a
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
          let created: number = new Date().getTime()
          if (get(defaultProjectName) === "date") name = dateToString(created)
          project = { name, notes: "", created, parent: obj.oldData || get(projects)[get(activeProject)!]?.parent || "/", shows: [] }
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
    case "newShow":
      if (undo) {
        let id = obj.oldData.id
        if (get(activeShow)?.id === id) activeShow.set(null)
        if (obj.location!.project) {
          projects.update((a) => {
            a[obj.location!.project!].shows = a[obj.location!.project!].shows.filter((a) => a.id !== id)
            return a
          })
        }
        setShow(id, "delete")
      } else {
        let category: null | string = null
        if (get(drawerTabsData).shows.activeSubTab !== "all") category = get(drawerTabsData).shows.activeSubTab
        if (!obj.newData?.show) obj.newData = { show: new ShowObj(false, category) }

        let id: string = obj.newData.id
        if (!id) {
          id = uid(12)
          obj.newData.id = id
        }
        setShow(id, obj.newData.show)

        let as: any = { id }
        if (obj.location!.project && get(projects)[obj.location!.project!]) {
          projects.update((p) => {
            p[obj.location!.project!].shows.push(as)
            return p
          })
          as.index = get(projects)[obj.location!.project!].shows.length - 1
        }
        activeShow.set(as)
      }
      break
    case "deleteShow":
      if (undo) {
        let id: string = obj.newData.id
        setShow(id, obj.newData.show)

        projects.update((a) => {
          obj.newData.projects.forEach((b: any) => {
            a[b.id].shows = b.data
          })
          return a
        })
      } else {
        let id = obj.oldData.id
        if (get(activeShow)?.id === id) activeShow.set(null)

        // remove from projects
        obj.oldData.projects = []
        projects.update((a) => {
          Object.keys(a).forEach((pID) => {
            let filtered = a[pID].shows.filter((b) => b.id !== id)
            if (filtered.length < a[pID].shows.length) {
              obj.oldData.projects.push({ id: pID, data: a[pID].shows })
              a[pID].shows = filtered
            }
          })
          return a
        })

        setShow(id, "delete")
      }
      break
    case "updateShow":
      // TODO: showsCache
      showsCache.update((a: any) => {
        if (!obj.oldData) obj.oldData = { key: obj.newData.key, values: [] }
        obj.location!.shows!.forEach((b, i) => {
          if (obj.newData.values[i] && !obj.oldData.values[i]) obj.oldData.values[i] = a[b.id][obj.newData.key]
          a[b.id][obj.newData.key] = obj.newData.values[i] || obj.newData.values[0]
        })
        return a
      })
      break
    case "newShowsCategory":
      categories.update((a) => {
        if (undo) delete a[obj.newData.id]
        else {
          if (!obj.newData) {
            let id = uid()
            let icon: null | string = null
            let tab = get(drawerTabsData).shows.activeSubTab
            if (tab !== "all" && tab !== "unlabeled") icon = get(drawerTabsData).shows.activeSubTab
            obj.newData = { id, data: { name: "", icon } }
            obj.oldData = { id }
          }
          a[obj.newData.id] = obj.newData.data
        }
        return a
      })
      break
    case "newSlide":
      // TODO: undo
      showsCache.update((s) => {
        // TODO: add after activeEdit.index (+ children slides...)
        let layout = s[obj.location!.show!.id].layouts[obj.location!.layout!].slides
        let slides = s[obj.location!.show!.id].slides
        if (undo) {
          delete slides[obj.oldData.id]
          layout.splice(layout.length - 1, 1)
        } else {
          if (!obj.newData) obj.newData = {}
          let id: any = obj.newData.id?.[0]
          if (!id) id = uid()
          let index: number = obj.newData.index !== undefined ? obj.newData.index : GetLayout(obj.location!.show!.id, obj.location!.layout).length

          if (!obj.newData.slides && !obj.newData.parent) {
            let group: null | string = ""
            let globalGroup: null | string = null
            // add as child
            // TODO: add by template
            if (layout.length) {
              group = null
              console.log(layout, index)

              let parent = layout[index].id
              if (!slides[parent].children) slides[parent].children = []
              // TODO: don't push, but add to correct index
              slides[parent].children!.push(id)
            } else {
              // auto group
              globalGroup = getGroup(obj.location!.show!.id, obj.location!.layout!)
            }
            slides[id] = { group, color: null, settings: {}, notes: "", items: [] }
            if (globalGroup) slides[id].globalGroup = globalGroup
          } else {
            if (obj.newData.parent) obj.newData.slides = [{ group: "", color: null, settings: {}, notes: "", items: [] }]
            // add custom
            id = []
            let layouts: any[] = []
            let bgs: any[] = []
            obj.newData.slides.forEach((a: any, i: number) => {
              let slideID = obj.newData.id?.[i]
              if (!slideID) {
                slideID = uid()
                id.push(slideID)
              }
              slides[slideID] = a
              let l: any = { id: slideID }
              // add backgrounds
              if (obj.newData.backgrounds?.length) {
                let bgID = uid()
                bgs.push({ id: bgID, bg: obj.newData.backgrounds[i] })
                l.background = bgID
              }
              layouts.push(l)
            })

            // add backgrounds
            if (bgs.length) {
              if (!s[obj.location!.show!.id].backgrounds) s[obj.location!.show!.id].backgrounds = {}
              bgs.forEach((a) => {
                s[obj.location!.show!.id].backgrounds[a.id] = a.bg
              })
            }

            let newIndex: number = index
            layout.forEach((a, i) => {
              if (i < index && a.children) newIndex -= Object.keys(a.children).length
            })
            // TODO:
            console.log(newIndex)

            s[obj.location!.show!.id].layouts[obj.location!.layout!].slides = addToPos(layout, layouts, newIndex)
          }
          // if (get(activeEdit).slide)
          //   activeEdit.update((a) => {
          //     a.slide = index
          //     return a
          //   })
          obj.newData.id = id
        }
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
      showsCache.update((s) => {
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

    // delete
    case "deleteShowsCategory":
      categories.update((a) => {
        if (undo) {
          a[obj.newData.id] = obj.newData.data
          showsCache.update((a) => {
            obj.newData.shows.forEach((id: string) => {
              a[id].category = obj.newData.id
            })
            return a
          })
        } else {
          obj.oldData = { id: obj.newData.id, data: a[obj.newData.id], shows: [] }
          // remove shows
          showsCache.update((b) => {
            Object.entries(b).forEach(([id, c]: any) => {
              if (c.category === obj.newData.id) {
                obj.oldData.shows.push(id)
                b[id].category = null
              }
            })
            return b
          })
          if (get(drawerTabsData)[get(activeDrawerTab)].activeSubTab === obj.newData.id)
            drawerTabsData.update((a) => {
              a[get(activeDrawerTab)].activeSubTab = null
              return a
            })
          delete a[obj.newData.id]
        }
        return a
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
    case "addLayout":
      showsCache.update((a) => {
        if (undo) {
          delete a[obj.location!.show!.id].layouts[obj.oldData.id]
          a[obj.location!.show!.id].settings.activeLayout = obj.newData.id
        } else {
          obj.oldData = { id: a[obj.location!.show!.id].settings.activeLayout }
          a[obj.location!.show!.id].layouts[obj.newData.id] = obj.newData.layout
          a[obj.location!.show!.id].settings.activeLayout = obj.newData.id
        }
        return a
      })
      break

    case "showMedia":
      showsCache.update((a) => {
        let id: null | string = null
        Object.entries(a[obj.location!.show!.id].backgrounds).forEach(([id, a]: any) => {
          if (a.path === obj.newData.path) id = id
        })
        if (undo) {
          delete a[obj.location!.show!.id].backgrounds[id!]
          delete a[obj.location!.show!.id].layouts[obj.location!.layout!].slides[obj.location!.layoutSlide!].background
        } else {
          if (!id) {
            id = uid()
            a[obj.location!.show!.id].backgrounds[id] = { ...obj.newData }
          }

          let ref = GetLayoutRef(obj.location!.show!.id, obj.location!.layout!)[obj.location!.layoutSlide!]
          let layoutSlide = a[obj.location!.show!.id].layouts[obj.location!.layout!].slides[ref.index]
          if (ref.type === "parent") layoutSlide.background = id
          else {
            if (!layoutSlide.children) layoutSlide.children = []
            layoutSlide.children[ref.index].background = id
          }
          // a[obj.location!.show!.id].layouts[obj.location!.layout!].slides[obj.location!.layoutSlide!].background = id
        }
        return a
      })
      break
    case "changeLayout":
      showsCache.update((a) => {
        let ref: any[] = GetLayoutRef(obj.location!.show!.id, obj.location!.layout!)
        let index = obj.location!.layoutSlide!
        let slides = a[obj.location!.show!.id].layouts[obj.location!.layout!].slides
        let slide: any
        if (ref[index].type === "child") slide = slides[ref[index].layoutIndex].children[ref[index].id]
        else slide = slides[ref[index].index]
        if (!obj.oldData) obj.oldData = { key: obj.newData.key, value: slide[obj.newData.key] || null }
        if (obj.newData.value) slide[obj.newData.key] = obj.newData.value
        else delete slide[obj.newData.key]
        return a
      })
      break
    case "changeLayouts":
      const updateValue = (a: any) => {
        if (!obj.newData.value) delete a[obj.newData.key]
        else if (obj.newData.action === "keys") {
          Object.entries(obj.newData.value).forEach(([key, value]: any) => {
            if (!a[obj.newData.key]) a[obj.newData.key] = {}
            a[obj.newData.key][key] = value
          })
        } else a[obj.newData.key] = obj.newData.value
        return a
      }
      // TODO: store previous value....
      if (!obj.oldData) obj.oldData = { key: obj.newData.key }
      showsCache.update((a: any) => {
        let slides = a[obj.location!.show!.id].layouts[obj.location!.layout!].slides
        slides.forEach((a: any) => {
          a = updateValue(a)
          if (a.children) {
            Object.values(a.children).forEach((a: any) => {
              a = updateValue(a)
            })
          }
        })
        return a
      })
      break
    // other
    case "slideToOverlay":
      overlays.update((a: any) => {
        if (undo) {
          let id: string = obj.oldData.id
          if (get(outOverlays).includes(id)) outOverlays.set(get(outOverlays).filter((a: any) => a !== id))
          delete a[id]
        } else a[obj.newData.id] = obj.newData.slide
        return a
      })
      break
    case "newEvent":
      events.update((a) => {
        if (undo) {
          if (!obj.newData) delete a[obj.oldData.id]
          else a[obj.oldData.id] = obj.newData
        } else a[obj.newData.id] = obj.newData.data
        return a
      })
      break
    case "template":
      showsCache.update((a) => {
        if (undo) {
          a[obj.location!.show!.id].slides = obj.newData.slides
          a[obj.location!.show!.id].settings.template = obj.newData.template
        } else {
          let slides = a[obj.location!.show!.id].slides
          if (!obj.oldData) obj.oldData = { template: a[obj.location!.show!.id].settings.template, slides: JSON.parse(JSON.stringify(slides)) }
          a[obj.location!.show!.id].settings.template = obj.newData.template
          let template = get(templates)[obj.newData.template]
          Object.values(slides).forEach((slide: any) => {
            slide.items.forEach((item: any, i: number) => {
              item.style = template.items[i] ? template.items[i].style || "" : template.items[0].style || ""
              item.text?.forEach((text: any, j: number) => {
                text.style = template.items[i].text?.[j] ? template.items[i].text?.[j].style || "" : template.items[i].text?.[0].style || ""
              })
            })
          })
        }
        return a
      })
      break
    // settings
    case "theme":
      themes.update((a: any) => {
        if (!obj.oldData) {
          obj.oldData = { ...obj.newData }
          if (obj.newData.id) obj.oldData.value = a[obj.location!.theme!][obj.newData.key][obj.newData.id]
          else obj.oldData.value = a[obj.location!.theme!][obj.newData.key]
          if (obj.newData.key === "name" && a[obj.location!.theme!].default) obj.oldData.default = true
        }
        if (obj.newData.default) a[obj.location!.theme!].default = true
        else if (a[obj.location!.theme!].default) delete a[obj.location!.theme!].default
        if (obj.newData.id) a[obj.location!.theme!][obj.newData.key][obj.newData.id] = obj.newData.value
        else a[obj.location!.theme!][obj.newData.key] = obj.newData.value
        // TODO: remove default if name change; if (a[obj.location!.theme!].default) groupValue
        let key = obj.newData.id || obj.newData.key
        if (obj.newData.key === "font") key = obj.newData.key + "-" + key
        document.documentElement.style.setProperty("--" + key, obj.newData.value)
        return a
      })
      break
    case "addTheme":
      themes.update((a: any) => {
        if (obj.newData) a[obj.location!.theme!] = obj.newData
        else {
          if (get(theme) === obj.location!.theme!) theme.set(Object.keys(a).find((a) => a !== obj.location!.theme!)!)
          delete a[obj.location!.theme!]
        }
        return a
      })
      break
    case "addGlobalGroup":
      groups.update((a: any) => {
        if (obj.newData) a[obj.newData!.id!] = obj.newData.data
        else delete a[obj.newData!.id!]
        return a
      })
      break

    default:
      console.log(obj)
      break
  }

  // TODO: go to location
  if (obj.location.page === "drawer") {
    // TODO: open drawer
  } else activePage.set(obj.location.page)

  // TODO: remove history obj if oldData is exactly the same as newdata

  if (undo === null) redoHistory.set([])

  if (undo) {
    redoHistory.update((rh: History[]) => {
      rh.push(obj)
      return rh
    })
  } else {
    undoHistory.update((uh: History[]) => {
      // if id and location is equal push new data to previous stored
      // not: project | newProject | newFolder | addShow | slide
      if (
        undo === null &&
        uh[uh.length - 1]?.id === obj.id &&
        JSON.stringify(Object.values(uh[uh.length - 1]?.location!)) === JSON.stringify(Object.values(obj.location!)) &&
        override.includes(obj.id)
      ) {
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

    let oldData: any = { ...lastUndo!.oldData }
    lastUndo!.oldData = { ...lastUndo!.newData }
    lastUndo!.newData = oldData

    history(lastUndo!, true)
  }
}

// TODO: fix undo redo swap
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
