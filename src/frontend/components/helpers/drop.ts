import { GetLayout, GetLayoutRef, GetSlideLayout, GetSlideLayoutRef } from "./get"
import { projects, activeProject, selected, activeShow, showsCache, videoExtensions, imageExtensions, activePage, activeDrawerTab, drawerTabsData } from "../../stores"
import { getIndexes, mover, addToPos } from "./mover"
import { HistoryIDs, history, historyAwait } from "./history"
import { get } from "svelte/store"
import { uid } from "uid"
import { _show } from "./shows"

// TODO: file...
const areas: any = {
  all_slides: ["template"],
  slides: ["media", "overlay", "sound", "camera", "show"], // group
  // slide: ["overlay", "sound", "camera"], // "media",
  // projects: ["folder"],
  project: ["show_drawer", "media", "player"],
  overlays: ["slide"],
  templates: ["slide"],
  // media_drawer: ["file"],
}
const areaChildren: any = {
  projects: ["folder", "project"],
  project: ["show", "media", "show_drawer", "player"],
  slides: ["slide", "group", "global_group", "camera", "media", "show"],
  all_slides: [],
  navigation: ["show", "show_drawer"],
}
const files: any = {
  project: ["frs", ...get(imageExtensions), ...get(videoExtensions)],
  slides: ["frs", ...get(imageExtensions), ...get(videoExtensions)],
  slide: ["frs", ...get(imageExtensions), ...get(videoExtensions)],
}

export function validateDrop(id: string, selected: any, children: boolean = false): boolean {
  return areas[id]?.includes(selected) || (children && areaChildren[id]?.includes(selected))
}

export function ondrop(e: any, id: string) {
  // let data: string = e.dataTransfer.getData("text")
  let historyID: null | HistoryIDs = null
  let oldData: any
  let newData: any
  let location: any = { page: get(activePage) }

  let sel = get(selected)

  // TODO: get index!
  let elem: any = null
  if (e !== null) {
    // if (id === "project" || sel.id === "slide" || sel.id === "group" || sel.id === "global_group" || sel.id === "media") elem = e.target.closest(".selectElem")
    if (id === "project" || id === "projects" || id === "slides" || id === "all_slides" || id === "navigation") elem = e.target.closest(".selectElem")
    else if (id === "slide") elem = e.target.querySelector(".selectElem")
    console.log(elem)
  }

  let trigger: undefined | string = e?.target.closest(".TriggerBlock")?.id
  let data: any = JSON.parse(elem?.getAttribute("data") || "{}")
  let index: undefined | number = data.index
  let center: boolean = false
  if (trigger?.includes("center")) center = true
  if (index !== undefined && trigger?.includes("end") && areaChildren[id]?.includes(sel.id)) index++

  console.log("DRAG: ", sel.id, sel.data)
  console.log("DROP: ", id, data, trigger)

  switch (id) {
    case "projects":
      if ((sel.id === "folder" || sel.id === "project") && (!data.type || data.type === "folder")) {
        location.page = "show"
        // TODO: move multiple
        let parents = data.path?.split("/") || [""]
        sel.data.forEach((selData) => {
          // check to see that its not itself OR a child of itself
          if ((selData.id !== data.id && (parents[0] === "" || selData.path === data.path || !parents.includes(selData.id))) || selData.type !== data.type) {
            if (selData.type === "folder") {
              historyID = "updateProjectFolder"
              location.folder = selData.id
            } else {
              historyID = "updateProject"
              location.project = selData.id
            }
          }
        })
        newData = { key: "parent", value: data.id || "/" }
      }
      break
    case "project":
      historyID = "addShowToProject"
      location.page = "show"
      location.project = get(activeProject)
      let projectShows = get(projects)[location.project].shows
      if (index === undefined) index = projectShows.length

      let tempData: any[] = sel.data
      if (sel.id === "media" || sel.id === "files") {
        tempData = tempData
          .map((a: any) => {
            // let name: string = a.name.includes(".") ? a.name : a.path.substring(a.path.lastIndexOf("\\") + 1)
            let name: string = a.name.includes(".") ? a.name : a.path.substring((a.path.lastIndexOf("\\") > -1 ? a.path.lastIndexOf("\\") : a.path.lastIndexOf("/")) + 1)
            const [extension] = name.match(/\.[0-9a-z]+$/i) || [""]
            let type = a.type || "image"
            if (get(videoExtensions).includes(extension.substring(1))) type = "video"
            let out: any = { name: null, id: a.path, type }
            if (sel.id === "files" && !files[id].includes(extension.substring(1))) out = null
            // name.slice(0, name.lastIndexOf("."))
            return out
          })
          .filter((a: any) => a)
      } else if (sel.id === "player") {
        // tempData = tempData.map(a => {
        //   let d = get(playerVideos)[a]
        //   return {id: }
        // })
        tempData = tempData.map((a: any) => ({ id: a, type: "player" }))
      }

      oldData = JSON.stringify({ shows: projectShows })
      if (sel.id === "show") newData = { shows: mover(projectShows, getIndexes(tempData), index) }
      else newData = { shows: addToPos(projectShows, tempData, index) }
      break
    case "slide":
    case "slides":
      location = { page: "show", show: get(activeShow), layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout }
      if ((sel.id === "show" && ["media", "image", "video"].includes(sel.data[0].type)) || sel.id === "media" || sel.id === "files" || sel.id === "camera") {
        let data: any[] = sel.data
        // TODO: move multiple add to possible slides

        if (center) {
          historyID = "showMedia"

          if (trigger?.includes("end")) index!--
          location.layoutSlide = index
          // check files
          if (sel.id === "files") {
            data = []
            sel.data.forEach((a: any) => {
              const [extension] = a.name.match(/\.[0-9a-z]+$/i) || [""]
              if (files[id].includes(extension.substring(1)))
                data.push({ path: a.path, name: a.name, type: get(imageExtensions).includes(extension.substring(1)) ? "image" : "video" })
            })
          } else if (sel.id === "camera") data[0].type = "camera"
          else if (!sel.data[0].name) sel.data[0].name = sel.data[0].path
          newData = data[0]
        } else {
          historyID = "newSlide"
          location.layoutSlide = index
          let slides: any[] = sel.data.map((a: any) => ({ group: a.name || "", color: null, settings: {}, notes: "", items: [] }))
          if (sel.id === "files") {
            data = []
            sel.data.forEach((a: any) => {
              const [extension] = a.name.match(/\.[0-9a-z]+$/i) || [""]
              if (files[id].includes(extension.substring(1)))
                data.push({ path: a.path, name: a.name, type: get(imageExtensions).includes(extension.substring(1)) ? "image" : "video" })
            })
          }
          // TODO: add to index (not end)
          newData = { index, slides, backgrounds: data }
        }
        // } else if (sel.id === "camera") {
        //   historyID = "camera"
        //   location.layoutSlide = index
        //   newData = sel.data
      } else if (sel.id === "slide" || sel.id === "group") {
        historyID = "slide"
        let ref: any[] = GetLayoutRef()
        let layout: any[] = GetLayout()

        let slides = get(showsCache)[get(activeShow)!.id].slides
        let oldLayout = get(showsCache)[get(activeShow)!.id].layouts[get(showsCache)[get(activeShow)!.id].settings.activeLayout].slides
        oldData = JSON.parse(JSON.stringify({ layout: oldLayout, slides }))

        if (index === undefined) index = layout.length
        let newIndex: number = index
        let moved: any[] = []

        // create a sorted layout
        let sortedLayout: any[] = []

        if (sel.id === "slide") {
          let selected: number[] = getIndexes(sel.data)

          ref = ref.filter((a: any, i: number) => {
            if (selected.includes(i)) {
              if (i < index!) newIndex--
              moved.push(a)
              return false
            }
            return true
          })

          sortedLayout = mover(layout, selected, index)
        } else if (sel.id === "group") {
          if (center) {
            if (trigger?.includes("end")) {
              index--
              newIndex--
            }
            ref.splice(index, 1)
            layout.splice(index, 1)
          }

          let movedLayout: any[] = []

          sel.data.forEach((a: any) => {
            moved.push(...GetSlideLayoutRef(a.id))
            movedLayout.push(...GetSlideLayout(a.id))
          })

          sortedLayout = addToPos(layout, movedLayout, index)
        }

        // set moved
        // moved.map((a: any) => (a.moved = true))

        // sort layout ref
        let newLayoutRef: any[] = addToPos(ref, moved, newIndex)

        // check if first slide child
        if (newLayoutRef[0].type === "child") newLayoutRef[0].newType = "parent"

        newData = changeLayout(sortedLayout, slides, newLayoutRef, moved, newIndex)
      } else if (sel.id === "global_group") {
        if (center) {
          historyID = "changeSlide"
          if (trigger?.includes("end")) index!--
          let ref: any[] = GetLayoutRef()
          location.slide = ref[index!].id
          delete location.layout
          newData = { key: "globalGroup", value: sel.data[0].globalGroup }
        } else {
          historyID = "newSlide"
          newData = { slides: sel.data, index }
        }
      } else if (sel.id === "overlay") {
        historyID = "changeLayout"
        location.layoutSlide = index
        let ref = _show("active").layouts("active").ref()[0][index!]
        let slide = _show("active")
          .layouts("active")
          .slides([ref.type === "parent" ? ref.index : ref.parent.index])
          .get()[0][0]
        if (ref.type === "child") slide = slide.children[ref.index]
        let value: any[] = [...new Set([...(slide?.overlays || []), ...sel.data])]
        newData = { key: "overlays", value }
      }
      break
    case "all_slides":
      location = { page: "show", show: get(activeShow), layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout }
      if (sel.id === "template") {
        historyID = "template"

        console.log(index)

        // TODO: add slide
        // if (trigger) location.layoutSlide = index
        if (center) location.layoutSlide = index
        newData = { template: sel.data[0] }

        // location.layoutSlide = index
        // let newData = {template: sel.data[0]}
        // // let slide = get(shows)[get(activeShow)!.id].slides
        // newData.slide = slide
        // newData = { key: "templates", newData, oldData }
      }
      break
    case "overlays":
      // TODO: moving multiple
      // let selected: number[] = getIndexes(sel.data)

      let ref: any = GetLayoutRef()[sel.data[0].index]
      let slides: any = get(showsCache)[get(activeShow)!.id].slides
      let slide: any = slides[ref.id]
      let name: string = slide.group || ""
      let color: null | string = slide.color
      if (ref.type === "child") {
        let parent = slides[ref.slidesIndex]
        name = parent.group || ""
        color = parent.color
      }

      // TODO: get active overlay category
      let category = null

      historyID = "slideToOverlay"
      newData = { id: uid(), slide: { name, color, items: slide.items, category } }
      break
    case "navigation":
      if (data !== "all" && get(activeDrawerTab) && (sel.id === "show" || sel.id === "show_drawer")) {
        newData = { key: "category", values: [data === "unlabeled" ? null : data] }
        location = { page: sel.id === "show" ? "show" : "drawer", shows: sel.data }
        historyAwait(
          sel.data.map((a: any) => a.id),
          { id: "updateShow", newData, location }
        )
      }
      break
    case "templates":
      if (sel.id === "slide") {
        sel.data.forEach((selData) => {
          let ref = _show("active").layouts("active").ref()[0][selData.index]
          let slide = _show("active").slides([ref.id]).get()[0]
          let parent = ref.parent ? _show("active").slides([ref.parent.id]).get()[0] : null
          history({
            id: "newTemplate",
            newData: {
              template: {
                name: parent ? parent.group || "" : slide.group || "",
                color: parent ? parent.color || "" : slide.color || "",
                category:
                  get(drawerTabsData).templates.activeSubTab === "all" || get(drawerTabsData).templates.activeSubTab === "unlabeled"
                    ? null
                    : get(drawerTabsData).templates.activeSubTab,
                items: slide.items,
              },
            },
            location: { page: "show" },
          })
        })
      }
      break

    default:
      console.log("NOT ASSIGNED!", sel.id + " => " + id)
      break
  }

  console.log(newData)

  if (historyID) history({ id: historyID, oldData, newData, location })
  selected.set({ id: null, data: [] })
}

function changeParent(slides: any, parent: any, ref: any) {
  // remove old children
  if (ref.type === "child" && ref.parent !== parent) slides[ref.parent].children?.splice(ref.slideIndex, 1)
  if (ref.newType === "child" || (ref.newType === undefined && ref.type === "child")) {
    // remove children
    if (ref.type === "parent") delete slides[ref.id].children
    // add new children
    if (ref.id !== parent && ref.parent !== parent) {
      if (!slides[parent].children) slides[parent].children = []
      slides[parent].children.push(ref.id)
    }
  }
  // remove children array if nothing left
  if (!slides[parent].children?.length) delete slides[parent].children

  // the label defines if a slide is a child or not
  if (ref.type === "child" && ref.newType === "parent") slides[ref.id].label = ""
  else if (ref.newType === "child") slides[ref.id].label = null

  return slides
}

function changeLayout(layout: any, slides: any, layoutRef: any, moved: any, index: number) {
  let newLayout: any[] = []

  // find parent
  // let moveParent: string = moved[0].id
  if (moved[0].type !== "parent") {
    while (layoutRef[index].type !== "parent" && index > 0) index--
    // moveParent = layoutRef[index].id
  }

  console.log([...layout])

  let parent: string = layoutRef[0].id
  layoutRef.forEach((ref: any, i: number) => {
    // set current parent
    if (ref.newType === "parent" || (ref.newType === undefined && ref.type === "parent")) parent = ref.id
    // update slide children
    slides = changeParent(JSON.parse(JSON.stringify(slides)), parent, ref)

    // remove any null value
    Object.keys(layout[i]).forEach((key: string) => {
      if (layout[key] === null) delete layout[key]
    })

    if (ref.newType === "parent" || (ref.newType === undefined && ref.type === "parent")) {
      newLayout.push(layout[i])
    } else {
      if (layout[i].id) delete layout[i].id
      if (layout[i].parent) delete layout[i].parent

      // set new child data
      let index: number = newLayout.length - 1
      // if (parent === moveParent || moved.find((a: any) => a.id === ref.id)) {
      if (!newLayout[index].children) newLayout[index].children = {}
      newLayout[index].children[ref.id] = layout[i]
      // }
    }
  })

  // find and remove children if parent has changed

  // moved.forEach((a: any) => {
  //   if (a.newType === "child" || (a.newType === undefined && a.type === "child")) {
  //     newLayout.forEach((b) => {
  //       if (b.children?.[a.id] && b.id !== moveParent) delete b.children[a.id]
  //     })
  //   }
  // })

  return { layout: newLayout, slides }
}
