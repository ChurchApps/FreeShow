import { get } from "svelte/store"
import { uid } from "uid"
import type { Slide } from "../../../types/Show"
import { ShowObj } from "../../classes/Show"
import { activeEdit, activePage, overlayCategories, shows, undoHistory } from "../../stores"
import { dateToString } from "../helpers/time"
import type { Folder, Project, ShowRef } from "./../../../types/Projects"
import {
  activeDrawerTab,
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
import { addToPos } from "./mover"
import { loadShows, setShow } from "./setShow"
import { _show } from "./shows"

export type HistoryPages = "drawer" | "show" | "edit" | "stage" | "settings"
export type HistoryIDs =
  // edit
  | "textStyle"
  | "textAlign"
  | "deleteItem"
  | "setItems"
  | "setStyle"
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
  | "newOverlay"
  | "newOverlaysCategory"
  | "newSlide"
  | "newItem"
  | "newStageShow"
  // delete
  | "deleteShowsCategory"
  | "removeSlides"
  | "deleteSlides"
  | "deleteGroups"
  // add
  | "addShow"
  | "addLayout"
  // show
  | "deleteShow"
  | "updateShow"
  | "slide"
  | "changeSlide"
  | "showMedia"
  | "changeLayoutKey"
  | "changeLayout"
  | "changeLayouts"
  // project
  | "updateProject"
  | "updateProjectFolder"
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
    folder?: string
    show?: ShowRef
    shows?: any[]
    layout?: string
    layoutSlide?: number
    slide?: string
    items?: any[]
    theme?: string
    lines?: number[]
  }
}

// override previous history
const override = ["textAlign", "textStyle", "deleteItem", "setItems", "setStyle", "stageItemAlign", "stageItemStyle", "slideStyle", "changeLayout", "theme"]

export async function historyAwait(s: string[], obj: History) {
  loadShows(s)
    .then(() => {
      history(obj)
    })
    .catch((e) => {
      console.error(e)
    })
}

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

  let showIDs: any[] = []
  if (obj.location?.show?.id) showIDs = [obj.location.show.id]
  let old: any = null

  switch (obj.id) {
    // EDIT
    // style
    case "deleteItem":
      if (undo) {
        _show(showIDs).slides([obj.location!.slide!]).items(obj.location!.items!).add(obj.newData)
      } else {
        obj.oldData = _show(showIDs).slides([obj.location!.slide!]).items(obj.location!.items!).remove()
      }
      break
    // case "textStyle":
    // TODO: wip
    // showsCache.update((s) => {
    //   console.log(obj.location!.items)

    //   obj.location!.items!.forEach((item, index) => {
    //     s[obj.location!.slide!].slides[obj.location!.slide!].items[item] = obj.newData[index]
    //   })
    //   // let items: Item[] = GetShow(obj.location?.show!).slides[obj.location?.slide!].items
    //   // obj.newData.forEach((item: Item, i: number) => {
    //   //   items[i] = item
    //   // })
    //   // items.forEach(item => {
    //   //   item = obj.newData
    //   // });
    //   // GetShow(obj.location.show!).slides[obj.location.slide!].items[obj.location.item!] = obj.newData
    //   return s
    // })
    // break
    // set items
    case "textStyle":
    case "textAlign":
      console.log("TEXT STYLE", obj.newData)
      // TODO: get old data (not getting first value....)
      old = _show(showIDs)
        .slides([obj.location!.slide!])
        .items(obj.location!.items!)
        .lines(obj.location!.lines! || [])
        .set(obj.newData)
      console.log(old)
      break
    case "setItems":
    case "setStyle":
      old = _show(showIDs).slides([obj.location!.slide!]).items(obj.location!.items!).set(obj.newData)
      console.log(old)
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
      old = _show(showIDs).slides([obj.location?.slide!]).set({ key: "settings", value: obj.newData })
      // showsCache.update((s) => {
      //   let slide: Slide = GetShow(obj.location?.show!).slides[obj.location?.slide!]
      //   slide.settings = obj.newData
      //   return s
      // })
      break
    //
    case "updateProject":
      console.log(obj.newData.key, obj.newData.value)

      projects.update((a: any) => {
        if (!obj.oldData) obj.oldData = { key: obj.newData.key, value: a[obj.location?.project!][obj.newData.key] }
        a[obj.location?.project!][obj.newData.key] = obj.newData.value
        return a
      })
      break
    case "updateProjectFolder":
      folders.update((a: any) => {
        if (!obj.oldData) obj.oldData = { key: obj.newData.key, value: a[obj.location?.folder!][obj.newData.key] }
        a[obj.location?.folder!][obj.newData.key] = obj.newData.value
        return a
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
      if (undo) {
      } else {
        old = {
          slides: _show(showIDs).set({ key: "slides", value: obj.newData.slides }),
          layout: _show(showIDs).layouts([obj.location!.layout!]).set({ key: "slides", value: obj.newData.layout }),
        }
      }
      // if (undo) old = null
      // showsCache.update((a) => {
      //   a[obj.location!.show!.id].slides = obj.newData.slides
      //   a[obj.location!.show!.id].layouts[obj.location!.layout!].slides = obj.newData.layout
      //   return a
      // })
      break
    // show
    case "changeSlide":
      old = { key: obj.newData.key, value: _show(showIDs).slides([obj.location!.slide!]).set(obj.newData) }

      // showsCache.update((a) => {
      //   if (!obj.oldData) obj.oldData = {}
      //   let slide: any = a[obj.location!.show!.id].slides[obj.location!.slide!]
      //   Object.entries(obj.newData).forEach(([key, value]: any) => {
      //     if (undo) slide[key] = obj.newData[key]
      //     else {
      //       obj.oldData[key] = slide[key] || null
      //       slide[key] = value
      //     }
      //   })
      //   return a
      // })
      break
    // NEW
    case "newMediaFolder":
      mediaFolders.update((a) => {
        if (obj.newData.data === null) {
          // remove folder
          delete a[obj.newData.id]
        } else a[obj.newData.id] = obj.newData.data
        return a
      })
      drawerTabsData.update((a) => {
        a.media.activeSubTab = obj.newData.id
        return a
      })
      break
    case "newProject":
      if (undo) {
        projects.update((p) => {
          delete p[obj.newData.id]
          return p
        })
        if (get(activeProject) === obj.newData.id) {
          activeProject.set(null)
          projectView.set(true)
        }
        console.log(obj.newData.id, get(projects))
      } else {
        let project: Project = obj.newData
        let id: string = obj.oldData?.id

        if (obj.newData === null) {
          let name: string = ""
          let created: number = new Date().getTime()
          if (get(defaultProjectName) === "date") name = dateToString(created)
          project = { name, notes: "", created, parent: id || get(projects)[get(activeProject)!]?.parent || "/", shows: [] }
          id = id || uid()
          obj.newData = project
          obj.oldData = { id }
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

        let as: any = { id, type: "show" }
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
          if (obj.newData.values[i] !== undefined && obj.oldData.values[i] === undefined) obj.oldData.values[i] = a[b.id][obj.newData.key]
          a[b.id][obj.newData.key] = obj.newData.values[i] === undefined ? obj.newData.values[0] : obj.newData.values[i]
        })
        return a
      })
      if (["name", "category", "timestamps", "private"].includes(obj.newData.key)) {
        shows.update((a: any) => {
          obj.location!.shows!.forEach((b, i) => {
            a[b.id][obj.newData.key] = obj.newData.values[i] === undefined ? obj.newData.values[0] : obj.newData.values[i]
          })
          return a
        })
      }
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
    case "newOverlay":
      if (undo) {
        let id: string = obj.oldData.id
        if (get(outOverlays).includes(id)) outOverlays.set(get(outOverlays).filter((a) => a !== id))
        overlays.update((a) => {
          delete a[id]
          return a
        })
      } else {
        let category: null | string = null
        if (get(drawerTabsData).overlays.activeSubTab !== "all") category = get(drawerTabsData).overlays.activeSubTab
        let overlay = {
          name: "",
          color: null,
          category,
          items: [],
        }
        if (!obj.newData?.overlay) obj.newData = { overlay }

        let id: string = obj.newData.id
        if (!id) {
          id = uid(12)
          obj.newData.id = id
        }

        overlays.update((a) => {
          a[id] = overlay
          return a
        })
      }
      break
    case "newOverlaysCategory":
      overlayCategories.update((a) => {
        if (undo) delete a[obj.newData.id]
        else {
          if (!obj.newData) {
            let id = uid()
            let icon: null | string = null
            let tab = get(drawerTabsData).overlays.activeSubTab
            if (tab !== "all" && tab !== "unlabeled") icon = get(drawerTabsData).overlays.activeSubTab
            obj.newData = { id, data: { name: "", icon } }
            obj.oldData = { id }
          }
          a[obj.newData.id] = obj.newData.data
        }
        return a
      })
      break
    case "newSlide":
      if (undo) {
        // TODO: undo new slide
        // decrement active edit slide index if removed slide(s) is active
      } else {
        let id: any = obj.newData.id?.[0]
        if (!id) id = uid()
        if (!obj.newData) obj.newData = {}
        let layouts = _show(showIDs).layouts([obj.location!.layout])
        let index: number = obj.newData.index !== undefined ? obj.newData.index : layouts.get()[0].slides.length
        let ref = layouts.ref()[0]
        // let color: null | string = null

        if (!obj.newData.slide && !obj.newData.slides && !obj.newData.parent) {
          let isParent: boolean = true
          // add as child
          // TODO: add by template
          if (layouts.get()[0].slides.length) {
            isParent = false

            let parent = ref[index - 1].parent || ref[index - 1]
            let slides = _show(showIDs).slides([parent.id]).get()[0]
            let value: string[] = [id]
            // let parentSlide: any = _show(showIDs).slides([parent.id]).get()[0]
            // if (parentSlide.globalGroup) color = get(groups)[parentSlide.globalGroup].color
            // else color = parentSlide.color

            if (slides.children) value = addToPos(slides.children, [value], index)

            _show(showIDs).slides([parent.id]).set({ key: "children", value })
          }
          let slide: any = { group: isParent ? "" : null, color: null, settings: {}, notes: "", items: [] }
          if (isParent) slide.globalGroup = "verse"
          // globalGroup = getGroup(obj.location!.show!.id, obj.location!.layout!)
          _show(showIDs).slides([id]).add(slide, isParent)

          // layout
          let value: any = { id }
          if (isParent) {
            _show(showIDs).layouts("active").slides([index]).add([value])
          }
        } else {
          let slides = obj.newData.slides || [obj.newData.slide]
          slides.forEach((slide: any, i: number) => {
            // add custom
            let id: string = _show(showIDs).slides().add(slide, true)
            let l: any = { id }

            // bgs
            if (obj.newData.backgrounds?.length) {
              let bgid = _show(showIDs)
                .media()
                .add(obj.newData.backgrounds[i] || obj.newData.backgrounds[0])
              l.background = bgid
            }

            // layouts
            // let newIndex: number = index
            // layouts.get()[0].forEach((a: any, i: number) => {
            //   if (i < index && a.children) newIndex -= Object.keys(a.children).length
            // })
            // [newIndex]

            _show(showIDs).layouts("active").slides().add([l])
          })
        }

        activeEdit.update((a) => {
          a.slide = index
          return a
        })

        obj.newData.id = id
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
    case "newStageShow":
      stageShows.update((a) => {
        if (undo) delete a[obj.newData.id]
        else {
          let id = obj.oldData?.id
          if (!id) id = uid()
          a[id] = {
            name: "",
            enabled: true,
            password: "",
            settings: {
              background: false,
              color: "#000000",
              resolution: false,
              size: { width: 10, height: 20 },
              labels: false,
              showLabelIfEmptySlide: true,
            },
            items: {},
          }
        }
        return a
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
    case "removeSlides":
      if (undo) {
        _show([obj.location!.show!.id]).layouts([obj.location!.layout]).slides(obj.newData[obj.location!.layout!].indexes).add(obj.newData[obj.location!.layout!].layouts)
      } else {
        old = _show([obj.location!.show!.id]).layouts([obj.location!.layout]).slides([obj.newData.indexes]).remove()
      }
      break
    case "deleteSlides":
      if (undo) {
        // add slide
        _show([obj.location!.show!.id]).slides(obj.newData.slides.ids).add(obj.newData.slides.slides)

        // add layout slide
        obj.newData.children.forEach((child: any) => {
          showsCache.update((a: any) => {
            a[obj.location!.show!.id].slides[child.parent.id].children = addToPos(a[obj.location!.show!.id].slides[child.parent.id].children, [child.id], child.index)
            return a
          })
        })
      } else {
        // remove children from slide
        let refs = _show([obj.location!.show!.id]).layouts().ref()
        let children: any[] = []
        showsCache.update((a: any) => {
          refs.forEach((ref) => {
            // let id = layoutIDs[ref]
            obj.newData.ids.forEach((slideId: any) => {
              let parent = ref.filter((a: any) => a.children?.includes(slideId))[0]
              if (parent) {
                let index = a[obj.location!.show!.id].slides[parent.id].children.findIndex((a: any) => a === slideId)
                children.push({ id: slideId, parent: { id: parent.id }, index })
                a[obj.location!.show!.id].slides[parent.id].children.splice(index, 1)
              }
            })
          })
          return a
        })
        old = { children }

        // delete child
        old.slides = _show([obj.location!.show!.id]).slides(obj.newData.ids).remove()
        // _show([obj.location!.show!.id]).layouts().slides().remove()
      }
      break
    case "deleteGroups":
      if (undo) {
        _show([obj.location!.show!.id]).slides(obj.newData.slides.ids).add(obj.newData.slides.slides)
        if (obj.newData.layouts) {
          Object.entries(obj.newData.layouts).forEach(([layoutID, data]: any) => {
            _show([obj.location!.show!.id]).layouts([layoutID]).slides(data.indexes).add(data.layouts)
          })
        }
      } else {
        let refs: any[] = _show([obj.location!.show!.id]).layouts().ref()
        let slides: any[][] = refs.map((a) => a.filter((a: any) => obj.newData.ids.includes(a.id)).map((a: any) => a.index))
        old = {
          layouts: _show([obj.location!.show!.id]).layouts().slides(slides).remove(),
          slides: _show([obj.location!.show!.id]).slides(obj.newData.ids).remove(),
        }
      }
      break

    // ADD
    case "addShow":
      if (activeProject !== null) {
        console.log(undo)
        // TODO: clear slide if active!

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
      if (undo) {
        _show(showIDs).set({ key: "settings.activeLayout", value: obj.newData.id })
        _show(showIDs).layouts().remove(obj.oldData.id)
      } else {
        old = { id: _show(showIDs).get("settings.activeLayout") }
        // _show(showIDs).layouts().set({ key: obj.oldData.id, value: obj.newData.layout })
        _show(showIDs).layouts().add(obj.newData.id, obj.newData.layout)
        _show(showIDs).set({ key: "settings.activeLayout", value: obj.newData.id })
      }
      // showsCache.update((a) => {
      //   if (undo) {
      //     delete a[obj.location!.show!.id].layouts[obj.oldData.id]
      //     a[obj.location!.show!.id].settings.activeLayout = obj.newData.id
      //   } else {
      //     obj.oldData = { id: a[obj.location!.show!.id].settings.activeLayout }
      //     a[obj.location!.show!.id].layouts[obj.newData.id] = obj.newData.layout
      //     a[obj.location!.show!.id].settings.activeLayout = obj.newData.id
      //   }
      //   return a
      // })
      break

    case "showMedia":
      let bgid: null | string = null
      _show(showIDs)
        .media()
        .get()
        .forEach((media: any) => {
          if (media.path === obj.newData.path) bgid = media.id
        })

      if (undo) {
        if (bgid) _show(showIDs).media([bgid]).remove()
        _show(showIDs)
          .layouts([obj.location!.layout!])
          .slides([[obj.location!.layoutSlide!]])
          .remove("background")
      } else {
        if (!bgid) bgid = _show(showIDs).media().add(obj.newData)
        let ref = _show(showIDs).layouts([obj.location!.layout!]).ref()[0][obj.location!.layoutSlide!]
        // let layoutSlide = _show(showIDs).layouts([obj.location!.layout!]).slides([ref.index]).get()[0]
        if (ref.type === "parent") _show(showIDs).layouts([obj.location!.layout!]).slides([ref.index]).set({ key: "background", value: bgid })
        else _show(showIDs).layouts([obj.location!.layout!]).slides([ref.parent.index]).children([ref.index]).set({ key: "background", value: bgid })
      }

      // showsCache.update((a) => {
      //   let id: null | string = null
      //   Object.entries(a[obj.location!.show!.id].backgrounds).forEach(([id, a]: any) => {
      //     if (a.path === obj.newData.path) id = id
      //   })
      //   if (undo) {
      //     delete a[obj.location!.show!.id].backgrounds[id!]
      //     delete a[obj.location!.show!.id].layouts[obj.location!.layout!].slides[obj.location!.layoutSlide!].background
      //   } else {
      //     if (!id) {
      //       id = uid()
      //       a[obj.location!.show!.id].backgrounds[id] = { ...obj.newData }
      //     }

      //     let ref = GetLayoutRef(obj.location!.show!.id, obj.location!.layout!)[obj.location!.layoutSlide!]
      //     let layoutSlide = a[obj.location!.show!.id].layouts[obj.location!.layout!].slides[ref.index]
      //     if (ref.type === "parent") layoutSlide.background = id
      //     else {
      //       if (!layoutSlide.children) layoutSlide.children = []
      //       layoutSlide.children[ref.index].background = id
      //     }
      //     // a[obj.location!.show!.id].layouts[obj.location!.layout!].slides[obj.location!.layoutSlide!].background = id
      //   }
      //   return a
      // })
      break
    case "changeLayoutKey":
      old = _show(showIDs).layouts([obj.location!.layout!]).set(obj.newData)[0]
      break
    case "changeLayout":
      let ref = _show(showIDs).layouts([obj.location!.layout!]).ref()[0][obj.location!.layoutSlide!]
      if (ref.type === "parent") old = _show(showIDs).layouts([obj.location!.layout!]).slides([ref.index]).set(obj.newData)
      else old = _show(showIDs).layouts([obj.location!.layout!]).slides([ref.parent.index]).children([ref.index]).set(obj.newData)
      // showsCache.update((a) => {
      //   let ref: any[] = GetLayoutRef(obj.location!.show!.id, obj.location!.layout!)
      //   let index = obj.location!.layoutSlide!
      //   let slides = a[obj.location!.show!.id].layouts[obj.location!.layout!].slides
      //   let slide: any
      //   if (ref[index].type === "child") slide = slides[ref[index].layoutIndex].children[ref[index].id]
      //   else slide = slides[ref[index].index]
      //   if (!obj.oldData) obj.oldData = { key: obj.newData.key, value: slide[obj.newData.key] || null }
      //   if (obj.newData.value) slide[obj.newData.key] = obj.newData.value
      //   else delete slide[obj.newData.key]
      //   return a
      // })
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
        slides.forEach((l: any) => {
          l = updateValue(l)
          let children: string[] = a[obj.location!.show!.id].slides[l.id]?.children
          if (children?.length) {
            if (!l.children) l.children = {}
            children.forEach((child) => {
              l.children[child] = updateValue(l.children[child] || {})
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
              item.lines?.forEach((line: any, j: number) => {
                line.text.forEach((text: any, k: number) => {
                  text.style = template.items[i].lines?.[j].text[k] ? template.items[i].lines?.[j].text[k].style || "" : template.items[i].lines?.[0].text[0].style || ""
                })
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

  // set old
  if (old && !undo && !obj.oldData) obj.oldData = old

  // TODO: go to location
  if (obj.location.page === "drawer") {
    // TODO: open drawer
  } else activePage.set(obj.location.page)

  // TODO: remove history obj if oldData is exactly the same as newdata

  // TODO: slide text edit, dont override different style keys!

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
