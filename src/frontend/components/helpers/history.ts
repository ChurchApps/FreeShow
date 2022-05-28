import { get } from "svelte/store"
import { uid } from "uid"
import type { Slide } from "../../../types/Show"
import { ShowObj } from "../../classes/Show"
import { activeEdit, activePage, activeStage, notFound, playerVideos, shows, undoHistory } from "../../stores"
import { dateToString } from "../helpers/time"
import type { Folder, Project, ShowRef } from "./../../../types/Projects"
import {
  activeProject,
  activeShow,
  defaultProjectName,
  drawerTabsData,
  events,
  folders,
  groups,
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
import { redoAddCategory, redoAddOverlayOrTemplate, undoAddCategory, undoAddOverlayOrTemplate } from "./historyHelpers"
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
  // template
  | "updateTemplate"
  | "updateOverlay"
  // new
  | "newMediaFolder"
  | "newProject"
  | "newFolder"
  | "newShowDrawer"
  | "newShow"
  | "newShowsCategory"
  | "newOverlaysCategory"
  | "newTemplatesCategory"
  | "newOverlay"
  | "newTemplate"
  | "newSlide"
  | "newItem"
  | "newStageShow"
  // delete
  | "deleteFolder"
  | "deleteProject"
  | "deleteStage"
  | "deleteOverlay"
  | "deleteTemplate"
  | "deleteShowsCategory"
  | "deleteMediaFolder"
  | "deleteOverlaysCategory"
  | "deleteTemplatesCategory"
  | "removeSlides"
  | "deleteSlides"
  | "deleteGroups"
  | "deletePlayerVideo"
  | "deleteLayout"
  // add
  | "addShowToProject"
  | "addLayout"
  // show
  | "deleteShow"
  | "updateShow"
  | "slide"
  | "changeSlide"
  | "showMedia"
  | "changeLayoutsSlides"
  | "changeLayoutKey"
  | "changeLayout"
  | "changeLayouts"
  // project
  | "updateProject"
  | "updateProjectFolder"
  // | "project"
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
  save?: boolean
  location?: {
    page: HistoryPages
    id?: string
    project?: null | string
    folder?: string
    show?: ShowRef
    shows?: any[]
    layout?: string
    layouts?: string[]
    layoutSlide?: number
    slide?: string
    items?: any[]
    theme?: string
    lines?: number[]
  }
}

// override previous history
const override = [
  "textAlign",
  "textStyle",
  "deleteItem",
  "setItems",
  "setStyle",
  "stageItemAlign",
  "stageItemStyle",
  "slideStyle",
  "changeLayout",
  "theme",
  "changeLayouts",
  "template",
  "updateTemplate",
  "updateOverlay",
]

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

  let showID: any
  if (obj.location?.show?.id) showID = obj.location.show.id
  let old: any = null
  let temp: any = {}

  switch (obj.id) {
    // EDIT
    // style
    case "deleteItem":
      if (undo) _show(showID).slides([obj.location!.slide!]).items(obj.location!.items!).add(obj.newData.items)
      else old = { items: _show(showID).slides([obj.location!.slide!]).items(obj.location!.items!).remove() }
      _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
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
      console.log("TEXT STYLE", obj.newData.style)
      // TODO: get old data (not getting first value....)
      old = {
        style: _show(showID)
          .slides([obj.location!.slide!])
          .items(obj.location!.items!)
          .lines(obj.location!.lines! || [])
          .set(obj.newData.style),
      }
      if (!undo && _show(showID).get("settings.template")) old.template = { key: "settings.template", value: null }
      if (old.template) _show(showID).set(old.template)
      console.log(old)
      // _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
      break
    case "setItems":
    case "setStyle":
      old = { style: _show(showID).slides([obj.location!.slide!]).items(obj.location!.items!).set(obj.newData.style) }
      if (!undo && _show(showID).get("settings.template")) old.template = { key: "settings.template", value: null }
      if (old.template) _show(showID).set(old.template)
      console.log(old)
      // _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
      break
    case "stageItemStyle":
    case "stageItemAlign":
      stageShows.update((s) => {
        obj.location!.items!.forEach((item, index) => {
          s[obj.location!.slide!].items[item][obj.id === "stageItemStyle" ? "style" : "align"] = obj.newData[index]
        })
        return s
      })
      // _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
      break
    case "slideStyle":
      old = { style: _show(showID).slides([obj.location?.slide!]).set({ key: "settings", value: obj.newData.style }) }
      if (!undo && _show(showID).get("settings.template")) old.template = { key: "settings.template", value: null }
      if (old.template) _show(showID).set(old.template)
      // showsCache.update((s) => {
      //   let slide: Slide = GetShow(obj.location?.show!).slides[obj.location?.slide!]
      //   slide.settings = obj.newData
      //   return s
      // })
      // _show(showID).set({ key: "timestamps.modified", value: new Date().getTime() })
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
    // TEMPLATE
    case "updateTemplate":
      templates.update((a: any) => {
        if (obj.newData.key === "items") {
          let items = a[obj.location!.id!][obj.newData.key]
          obj.location!.items!.forEach((index, i) => {
            items[index].style = obj.newData.data[i]
          })
        } else {
          a[obj.location!.id!][obj.newData.key] = obj.newData.data
        }
        return a
      })
      break
    // OVERLAY
    case "updateOverlay":
      overlays.update((a: any) => {
        if (obj.newData.key === "items" && obj.location!.items) {
          let items = a[obj.location!.id!][obj.newData.key]
          obj.location!.items!.forEach((index, i) => {
            items[index].style = obj.newData.data[i]
          })
        } else {
          a[obj.location!.id!][obj.newData.key] = obj.newData.data
        }
        return a
      })
      break
    // MOVE
    // case "project": // projecList
    //   projects.update((p) => {
    //     p[get(activeProject)!].shows = obj.newData
    //     // TODO: p[obj.location!.project].shows = obj.newData
    //     return p
    //   })
    //   break
    case "slide":
      if (undo) {
      } else {
        old = {
          slides: _show(showID).set({ key: "slides", value: obj.newData.slides }),
          layout: _show(showID).layouts([obj.location!.layout!]).set({ key: "slides", value: obj.newData.layout }),
        }
      }
      // if (undo) old = null
      // showsCache.update((a) => {
      //   a[showID].slides = obj.newData.slides
      //   a[showID].layouts[obj.location!.layout!].slides = obj.newData.layout
      //   return a
      // })
      break
    // show
    case "changeSlide":
      old = { key: obj.newData.key, value: _show(showID).slides([obj.location!.slide!]).set(obj.newData)[0] }

      // showsCache.update((a) => {
      //   if (!obj.oldData) obj.oldData = {}
      //   let slide: any = a[showID].slides[obj.location!.slide!]
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
        if (!obj.newData.show.name.length) obj.newData.show.name = id
        setShow(id, obj.newData.show)

        let as: any = { id, type: "show" }
        if (obj.location!.project && get(projects)[obj.location!.project!]) {
          projects.update((p) => {
            p[obj.location!.project!].shows.push({ id })
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
        shows.update((a) => {
          a[id] = obj.newData.show
          return a
        })
        // setShow(id, obj.newData.show)

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
    case "newMediaFolder":
    case "newOverlaysCategory":
    case "newTemplatesCategory":
      if (undo) obj = undoAddCategory(obj)
      else obj = redoAddCategory(obj)
      break
    case "newOverlay":
    case "newTemplate":
      if (undo) obj = undoAddOverlayOrTemplate(obj)
      else obj = redoAddOverlayOrTemplate(obj)
      break
    case "newSlide":
      if (undo) {
        // TODO: undo new slide
        // decrement active edit slide index if removed slide(s) is active
      } else {
        let id: any = obj.newData?.id?.[0]
        if (!id) id = uid()
        if (!obj.newData) obj.newData = {}
        let ref = _show(showID).layouts([obj.location!.layout]).ref()[0]
        let index: number = obj.newData.index !== undefined ? obj.newData.index : ref.length
        // let color: null | string = null

        if (!obj.newData.slide && !obj.newData.slides) {
          let isParent: boolean = true
          let items = []
          // add as child
          // TODO: add by template
          if (ref.length && !obj.newData.parent) {
            isParent = false

            let parent = ref[index - 1].parent || ref[index - 1]
            let slides = _show(showID).slides([parent.id]).get()[0]
            let value: string[] = [id]
            // let parentSlide: any = _show(showIDs).slides([parent.id]).get()[0]
            // if (parentSlide.globalGroup) color = get(groups)[parentSlide.globalGroup].color
            // else color = parentSlide.color

            if (slides.children) value = addToPos(slides.children, [value], index)

            _show(showID).slides([parent.id]).set({ key: "children", value })
          }
          // get previous slide layout
          if (ref.length && index - 1 >= 0) {
            items = JSON.parse(
              JSON.stringify(
                _show(showID)
                  .slides([ref[index - 1].id])
                  .items()
                  .get()[0]
              )
            )
            // remove values
            items = items.map((item: any) => {
              if (item.lines) {
                item.lines = [item.lines[0]]
                item.lines[0].text = [{ style: item.lines[0].text[0]?.style || "", value: "" }]
              }
              // {
              //   item.lines.forEach((line: any, i: number) => {
              //     line.text?.forEach((_text: any, j: number) => {
              //       item.lines[i].text[j].value = ""
              //     })
              //   })
              // }
              return item
            })
          }
          console.log(items)
          let slide: any = { group: isParent ? "" : null, color: null, settings: {}, notes: "", items }
          if (isParent) slide.globalGroup = "verse"
          // globalGroup = getGroup(obj.location!.show!.id, obj.location!.layout!)
          _show(showID).slides([id]).add([slide], isParent)

          // layout
          let value: any = { id }
          if (isParent) {
            _show(showID).layouts("active").slides([index]).add([value])
          }
        } else {
          let slides = obj.newData.slides || [obj.newData.slide]
          slides.forEach((slide: any, i: number) => {
            let id: string = ""
            // check if already exists!!
            if (!obj.newData.unique)
              _show(showID)
                .slides()
                .get()
                .forEach((a) => {
                  if (JSON.stringify(a) === JSON.stringify(slide)) id = slide.id
                })
            // add custom
            if (!id.length) id = _show(showID).slides().add([slide], true)

            let l: any = { id }

            // bgs
            if (obj.newData.backgrounds?.length) {
              let bgid = _show(showID)
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

            _show(showID).layouts("active").slides().add([l])
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
      showsCache.update((a) => {
        let slide: Slide = a[showID].slides[obj.location!.slide!]
        if (undo) {
          slide.items.splice(obj.newData.index, 1)
        } else {
          old = { index: slide.items.length }
          slide.items.push(obj.newData)
        }
        return a
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
            disabled: false,
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
    case "deleteFolder":
      folders.update((a) => {
        let id = obj.newData.id
        if (undo) {
          a[id] = obj.newData.data

          projects.update((p) => {
            obj.newData.projectParents.forEach((a: any) => {
              p[a.id].parent = a.parent
            })
            return p
          })

          obj.newData.folderParents.forEach((f: any) => {
            a[f.id].parent = f.parent
          })
        } else {
          obj.oldData = { id, data: a[id], folderParents: [], projectParents: [] }

          // projects
          let found: number = -1
          let allProjects: any = get(projects)
          do {
            if (found > -1) {
              let key = Object.keys(allProjects)[found]
              obj.oldData.projectParents.push({ id: key, parent: allProjects[key].parent })
              allProjects[key].parent = a[id].parent
            }
            found = Object.values(allProjects).findIndex((a: any) => a.parent === id)
          } while (found > -1)
          projects.set(allProjects)

          // folders
          found = -1
          do {
            if (found > -1) {
              let key = Object.keys(a)[found]
              obj.oldData.folderParents.push({ id: key, parent: a[key].parent })
              a[key].parent = a[id].parent
            }
            found = Object.values(a).findIndex((a: any) => a.parent === id)
          } while (found > -1)

          delete a[obj.newData.id]
        }
        return a
      })
      // TODO: update children
      break
    case "deleteProject":
      if (get(activeProject) === obj.newData.id) activeProject.set(null)
      projects.update((a) => {
        if (undo) {
          a[obj.newData.id] = obj.newData.data
        } else {
          obj.oldData = { id: obj.newData.id, data: a[obj.newData.id] }
          delete a[obj.newData.id]
        }
        return a
      })
      break
    case "deleteStage":
      if (get(activeStage) === obj.newData.id) activeStage.set({ id: null, items: [] })
      stageShows.update((a) => {
        if (undo) {
          a[obj.newData.id] = obj.newData.data
        } else {
          obj.oldData = { id: obj.newData.id, data: a[obj.newData.id] }
          if (get(activeStage).id === obj.newData.id) activeStage.set({ id: null, items: [] })
          delete a[obj.newData.id]
        }
        return a
      })
      break
    case "deleteOverlay":
    case "deleteTemplate":
      if (undo) obj = redoAddOverlayOrTemplate(obj)
      else obj = undoAddOverlayOrTemplate(obj)
      break
    case "deleteShowsCategory":
    case "deleteMediaFolder":
    case "deleteOverlaysCategory":
    case "deleteTemplatesCategory":
      if (undo) obj = redoAddCategory(obj)
      else obj = undoAddCategory(obj)
      break
    case "removeSlides":
      if (undo) {
        _show(showID).layouts([obj.location!.layout]).slides(obj.newData[obj.location!.layout!].indexes).add(obj.newData[obj.location!.layout!].layouts)
      } else {
        old = _show(showID).layouts([obj.location!.layout]).slides([obj.newData.indexes]).remove()
      }
      // if (get(outSlide)?.id === obj.location!.show!.id && obj.newData.indexes.includes(get(outSlide)?.index) && get(outSlide)?.layout === obj.location!.layout!) outSlide.set(null)
      break
    case "deleteSlides":
      if (undo) {
        // add slide
        _show(showID).slides(obj.newData.slides.ids).add(obj.newData.slides.slides)

        // add layout slide
        obj.newData.children.forEach((child: any) => {
          showsCache.update((a: any) => {
            a[showID].slides[child.parent.id].children = addToPos(a[showID].slides[child.parent.id].children, [child.id], child.index)
            return a
          })
        })
      } else {
        // remove children from slide
        let refs = _show(showID).layouts().ref()
        let children: any[] = []
        showsCache.update((a: any) => {
          refs.forEach((ref) => {
            // let id = layoutIDs[ref]
            obj.newData.ids.forEach((slideId: any) => {
              let parent = ref.filter((a: any) => a.children?.includes(slideId))[0]
              if (parent) {
                let index = a[showID].slides[parent.id].children.findIndex((a: any) => a === slideId)
                children.push({ id: slideId, parent: { id: parent.id }, index })
                a[showID].slides[parent.id].children.splice(index, 1)
              }
            })
          })
          return a
        })
        old = { children }

        // delete child
        old.slides = _show(showID).slides(obj.newData.ids).remove()
        // _show(showID).layouts().slides().remove()
      }
      break
    case "deleteGroups":
      if (undo) {
        _show(showID).slides(obj.newData.slides.ids).add(obj.newData.slides.slides)
        if (obj.newData.layouts) {
          Object.entries(obj.newData.layouts).forEach(([layoutID, data]: any) => {
            _show(showID).layouts([layoutID]).slides(data.indexes).add(data.layouts)
          })
        }
      } else {
        let refs: any[] = _show(showID).layouts().ref()
        let slides: any[][] = refs.map((a) => a.filter((a: any) => obj.newData.ids.includes(a.id)).map((a: any) => a.index))
        old = {
          layouts: _show(showID).layouts().slides(slides).remove(),
          slides: _show(showID).slides(obj.newData.ids).remove(),
        }
      }
      break
    case "deletePlayerVideo":
      playerVideos.update((a) => {
        if (undo) {
          a[obj.newData.id] = obj.newData.data
          if (get(notFound).show.includes(obj.newData.id)) {
            notFound.update((a) => {
              // TODO: not working if multiple undos?
              a.show.splice(a.show.indexOf(obj.newData.id), 1)
              return a
            })
          }
        } else {
          old = { id: obj.newData.id, data: a[obj.newData.id] }
          delete a[obj.newData.id]
        }
        return a
      })
      break

    case "deleteLayout":
      if (undo) {
        old = { id: _show(showID).get("settings.activeLayout") }
        // _show(showIDs).layouts().set({ key: obj.oldData.id, value: obj.newData.layout })
        _show(showID).layouts().add(obj.newData.id, obj.newData.layout)
        _show(showID).set({ key: "settings.activeLayout", value: obj.newData.id })

        // set active layout in project
        if (get(activeShow)?.index !== undefined && get(activeProject) && get(projects)[get(activeProject)!].shows[get(activeShow)!.index!]) {
          projects.update((a) => {
            a[get(activeProject)!].shows[get(activeShow)!.index!].layout = obj.newData.id
            return a
          })
        }
      } else {
        obj.newData.active = _show(showID).get("settings.activeLayout")
        if (obj.newData.active === obj.newData.id) {
          obj.newData.active = Object.keys(get(showsCache)[showID].layouts)[0]
          _show(showID).set({ key: "settings.activeLayout", value: obj.newData.active })
        }
        obj.oldData = { id: obj.newData.id, layout: _show(showID).layouts([obj.newData.id]).get()[0] }
        _show(showID).layouts().remove(obj.newData.id)
      }
      break

    // ADD
    case "addShowToProject":
      projects.update((p) => {
        if (undo) {
          p[obj.location!.project!].shows = JSON.parse(obj.newData.shows)
        } else {
          if (!obj.oldData?.shows) obj.oldData = { shows: JSON.stringify(p[obj.location!.project!].shows) }
          if (obj.newData.id) p[obj.location!.project!].shows.push(obj.newData)
          else p[obj.location!.project!].shows = obj.newData.shows
        }
        return p
      })
      break
    case "addLayout":
      if (undo) {
        _show(showID).set({ key: "settings.activeLayout", value: obj.newData.id })
        _show(showID).layouts().remove(obj.oldData.id)
      } else {
        old = { id: _show(showID).get("settings.activeLayout") }
        // _show(showIDs).layouts().set({ key: obj.oldData.id, value: obj.newData.layout })
        _show(showID).layouts().add(obj.newData.id, obj.newData.layout)
        _show(showID).set({ key: "settings.activeLayout", value: obj.newData.id })

        // set active layout in project
        if (get(activeShow)?.index !== undefined && get(activeProject) && get(projects)[get(activeProject)!].shows[get(activeShow)!.index!]) {
          projects.update((a) => {
            a[get(activeProject)!].shows[get(activeShow)!.index!].layout = obj.newData.id
            return a
          })
        }
      }
      // showsCache.update((a) => {
      //   if (undo) {
      //     delete a[showID].layouts[obj.oldData.id]
      //     a[showID].settings.activeLayout = obj.newData.id
      //   } else {
      //     obj.oldData = { id: a[showID].settings.activeLayout }
      //     a[showID].layouts[obj.newData.id] = obj.newData.layout
      //     a[showID].settings.activeLayout = obj.newData.id
      //   }
      //   return a
      // })
      break

    case "showMedia":
      let bgid: null | string = null
      if (obj.newData.id)
        _show(showID)
          .media()
          .get()
          .forEach((media: any) => {
            if (media.id === obj.newData.id) bgid = media.key
          })

      if (undo) {
        if (bgid) _show(showID).media([bgid]).remove()
        _show(showID)
          .layouts([obj.location!.layout!])
          .slides([[obj.location!.layoutSlide!]])
          .remove("background")
      } else {
        if (!bgid) bgid = _show(showID).media().add(obj.newData)

        let ref = _show(showID).layouts([obj.location!.layout!]).ref()[0][obj.location!.layoutSlide!]
        // let layoutSlide = _show(showIDs).layouts([obj.location!.layout!]).slides([ref.index]).get()[0]
        if (ref.type === "parent") _show(showID).layouts([obj.location!.layout!]).slides([ref.index]).set({ key: "background", value: bgid })
        else _show(showID).layouts([obj.location!.layout!]).slides([ref.parent.index]).children([ref.id]).set({ key: "background", value: bgid })
      }

      // showsCache.update((a) => {
      //   let id: null | string = null
      //   Object.entries(a[showID].backgrounds).forEach(([id, a]: any) => {
      //     if (a.path === obj.newData.path) id = id
      //   })
      //   if (undo) {
      //     delete a[showID].backgrounds[id!]
      //     delete a[showID].layouts[obj.location!.layout!].slides[obj.location!.layoutSlide!].background
      //   } else {
      //     if (!id) {
      //       id = uid()
      //       a[showID].backgrounds[id] = { ...obj.newData }
      //     }

      //     let ref = GetLayoutRef(obj.location!.show!.id, obj.location!.layout!)[obj.location!.layoutSlide!]
      //     let layoutSlide = a[showID].layouts[obj.location!.layout!].slides[ref.index]
      //     if (ref.type === "parent") layoutSlide.background = id
      //     else {
      //       if (!layoutSlide.children) layoutSlide.children = []
      //       layoutSlide.children[ref.index].background = id
      //     }
      //     // a[showID].layouts[obj.location!.layout!].slides[obj.location!.layoutSlide!].background = id
      //   }
      //   return a
      // })
      break
    case "changeLayoutsSlides":
      old = []
      obj.location!.layouts!.forEach((layout: string, i: number) => {
        old.push(_show(showID).layouts([layout]).set({ key: "slides", value: obj.newData[i] })[0].value)
      })
      break
    case "changeLayoutKey":
      old = _show(showID).layouts([obj.location!.layout!]).set(obj.newData)[0]
      break
    case "changeLayout":
      let ref = _show(showID).layouts([obj.location!.layout!]).ref()[0][obj.location!.layoutSlide!]
      if (ref.type === "parent") old = _show(showID).layouts([obj.location!.layout!]).slides([ref.index]).set(obj.newData)
      else old = _show(showID).layouts([obj.location!.layout!]).slides([ref.parent.index]).children([ref.id]).set(obj.newData)
      // showsCache.update((a) => {
      //   let ref: any[] = GetLayoutRef(obj.location!.show!.id, obj.location!.layout!)
      //   let index = obj.location!.layoutSlide!
      //   let slides = a[showID].layouts[obj.location!.layout!].slides
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
        let slides = a[showID].layouts[obj.location!.layout!].slides
        slides.forEach((l: any) => {
          l = updateValue(l)
          let children: string[] = a[showID].slides[l.id]?.children
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
          a[showID].slides = obj.newData.slides
          a[showID].settings.template = obj.newData.template
        } else {
          console.log(a[showID]?.slides)

          let slides: any = a[showID].slides
          if (!obj.oldData) obj.oldData = { template: a[showID].settings.template, slides: JSON.parse(JSON.stringify(slides)) }
          if (obj.location!.layoutSlide === undefined) a[showID].settings.template = obj.newData.template
          else a[showID].settings.template = null
          let template = get(templates)[obj.newData.template]
          if (template?.items.length) {
            let slideId = obj.location!.layoutSlide === undefined ? null : _show(obj.location!.show!.id).layouts([obj.location!.layout]).ref()[0][obj.location!.layoutSlide!].id
            Object.entries(slides).forEach(([id, slide]: any) => {
              if (!slideId || id === slideId) {
                template.items.forEach((item: any, i: number) => {
                  if (slide.items[i]) {
                    slide.items[i].style = item.style || ""
                    slide.items[i].align = item.align || ""
                    slide.items[i].lines?.forEach((line: any, j: number) => {
                      let templateLine = item.lines?.[j] || item.lines?.[0]
                      line.align = templateLine?.align || ""
                      line.text.forEach((text: any, k: number) => {
                        text.style = templateLine?.text[k] ? templateLine.text[k].style || "" : templateLine?.text[0]?.style || ""
                      })
                    })
                  } else if (obj.newData.createItems) {
                    // TODO: remove text?
                    slide.items.push(item)
                  }
                })
                // slide.items.forEach((item: any, i: number) => {
                //   item.style = template.items[i] ? template.items[i].style || "" : template.items[0].style || ""
                //   item.lines?.forEach((line: any, j: number) => {
                //     line.text.forEach((text: any, k: number) => {
                //       text.style = template.items[i].lines?.[j]?.text[k] ? template.items[i].lines?.[j].text[k].style || "" : template.items[i].lines?.[0].text[0].style || ""
                //     })
                //   })
                // })
              }
            })
            // } else {
            //   alertMessage.set("Empty template")
            //   activePopup.set("alert")
          }
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
        // if (obj.newData.default) a[obj.location!.theme!].default = true
        // else if (a[obj.location!.theme!].default) delete a[obj.location!.theme!].default
        if (obj.newData.id) a[obj.location!.theme!][obj.newData.key][obj.newData.id] = obj.newData.value
        else a[obj.location!.theme!][obj.newData.key] = obj.newData.value
        if (obj.newData.key === "name" && a[obj.location!.theme!].default) delete a[obj.location!.theme!].default
        // TODO: remove default if name change; if (a[obj.location!.theme!].default) groupValue
        let key = obj.newData.id || obj.newData.key
        if (obj.newData.key === "font") key = obj.newData.key + "-" + key
        document.documentElement.style.setProperty("--" + key, obj.newData.value)
        return a
      })
      break
    case "addTheme":
      themes.update((a: any) => {
        if (obj.newData) {
          // name exists
          // let index = 0
          // while (Object.values(a).find((a: any) => a.name === obj.newData.name + (index > 0 ? " " + index : ""))) index++
          // obj.newData.name = obj.newData.name + (index > 0 ? " " + index : "")
          a[obj.location!.theme!] = obj.newData
          theme.set(obj.location!.theme!)
        } else {
          if (get(theme) === obj.location!.theme!) theme.set("default")
          delete a[obj.location!.theme!]
        }
        return a
      })
      break
    case "addGlobalGroup":
      groups.update((a: any) => {
        if (obj.newData?.data) a[obj.newData!.id!] = obj.newData.data
        else {
          // obj.newData.data = a[obj.oldData!.id!]
          delete a[obj.oldData!.id!]
        }
        return a
      })
      break

    default:
      console.log(obj)
      break
  }

  if (temp.obj) obj = temp.obj

  // set old
  if (old && !undo && !obj.oldData) obj.oldData = old

  // TODO: go to location
  if (obj.location!.page === "drawer") {
    // TODO: open drawer
  } else activePage.set(obj.location!.page)

  // TODO: remove history obj if oldData is exactly the same as newdata

  // TODO: slide text edit, dont override different style keys!

  if (undo === null) redoHistory.set([])
  if (obj.save === false) return

  if (undo) {
    redoHistory.update((rh: History[]) => {
      rh.push(obj)
      return rh
    })
  } else {
    undoHistory.update((uh: History[]) => {
      // if id and location is equal push new data to previous stored
      // not: project | newProject | newFolder | addShowToProject | slide
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
