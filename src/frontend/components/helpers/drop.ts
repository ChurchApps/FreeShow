import { GetLayout, GetLayoutRef, GetSlideLayout, GetSlideLayoutRef } from "./get"
import { projects, activeProject, selected, activeShow, shows } from "./../../stores"
import { getIndexes, mover, addToPos } from "./mover"
import { HistoryIDs, history } from "./history"
import { get } from "svelte/store"

// TODO: file...
const areas: any = {
  slides: ["slide_group"], // , "media"
  slide: ["media", "overlay", "sound"],
  projects: [],
  project: ["show_drawer", "media"],
  drawer: ["file"],
}
const areaChildren: any = {
  project: ["show", "media", "show_drawer"],
  slide: ["slide_group", "slide"],
}

export function validateDrop(id: string, selected: any, children: boolean = false): boolean {
  return areas[id]?.includes(selected) || (children && areaChildren[id]?.includes(selected))
}

export function ondrop(e: any, id: string) {
  // let data: string = e.dataTransfer.getData("text")
  let historyID: null | HistoryIDs = null
  let oldData: any
  let newData: any
  let location: any = {}

  let sel = get(selected)

  // TODO: get index!
  let elem = null
  if (e !== null) {
    if (id === "project" || sel.id === "slide" || sel.id === "slide_group") elem = e.target.closest(".selectElem")
    else if (id === "slide") elem = e.target.querySelector(".selectElem")
    console.log(elem)
  }

  let trigger = e?.target.closest(".TriggerBlock")?.id
  let index = JSON.parse(elem?.getAttribute("data") || "{}").index
  if (index !== undefined && trigger === "end") index++

  console.log("DRAG: ", sel.id, sel.elems)
  console.log("DROP: ", id, index, trigger)

  switch (id) {
    case "project":
      historyID = "project"
      location.page = "show"
      let projectShows = get(projects)[get(activeProject)!].shows
      if (index === undefined) index = projectShows.length

      oldData = [...projectShows]
      if (sel.id === "show") newData = mover(projectShows, getIndexes(sel.elems), index)
      else newData = addToPos(projectShows, sel.elems, index)
      break
    case "slide":
    case "slides":
      if (sel.id === "media") {
        // TODO: move multiple add to possible slides
        historyID = "showMedia"
        location = { page: "show", show: get(activeShow), layout: get(shows)[get(activeShow)!.id].settings.activeLayout, layoutSlide: index }
        newData = sel.elems[0]
      } else if (sel.id === "slide" || sel.id === "slide_group") {
        historyID = "slide"
        location = { page: "show", show: get(activeShow), layout: get(shows)[get(activeShow)!.id].settings.activeLayout }
        let ref: any[] = GetLayoutRef()
        let layout: any[] = GetLayout()

        let slides = get(shows)[get(activeShow)!.id].slides
        let oldLayout = get(shows)[get(activeShow)!.id].layouts[get(shows)[get(activeShow)!.id].settings.activeLayout].slides
        oldData = JSON.parse(JSON.stringify({ layout: oldLayout, slides }))

        if (index === undefined) index = layout.length
        let newIndex: number = index
        let moved: any[] = []

        // create a sorted layout
        let sortedLayout: any[]

        if (sel.id === "slide") {
          let selected: number[] = getIndexes(sel.elems)

          ref = ref.filter((a: any, i: number) => {
            if (selected.includes(i)) {
              if (i < index) newIndex--
              moved.push(a)
              return false
            }
            return true
          })

          sortedLayout = mover(layout, selected, index)
        } else {
          let movedLayout: any[] = []

          sel.elems.forEach((a) => {
            moved.push(...GetSlideLayoutRef(a.id))
            movedLayout.push(...GetSlideLayout(a.id))
          })

          sortedLayout = addToPos(layout, movedLayout, index)
        }

        // set moved
        // moved.map((a) => (a.moved = true))

        // sort layout ref
        let newLayoutRef: any[] = addToPos(ref, moved, newIndex)

        // check if first slide child
        if (newLayoutRef[0].type === "child") newLayoutRef[0].newType = "parent"

        newData = changeLayout(sortedLayout, slides, newLayoutRef, moved, newIndex)
      }
      break

    default:
      console.log("NOT ASSIGNED!", sel.id + " => " + id)
      break
  }

  console.log(newData)

  if (historyID) history({ id: historyID, oldData, newData, location })
  selected.set({ id: null, elems: [] })
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
  let moveParent: string = moved[0].id
  if (moved[0].type !== "parent") {
    while (layoutRef[index].type !== "parent" && index > 0) index--
    moveParent = layoutRef[index].id
  }

  let parent: string = layoutRef[0].id
  layoutRef.forEach((ref: any, i: number) => {
    // set current parent
    if (ref.newType === "parent" || (ref.newType === undefined && ref.type === "parent")) parent = ref.id
    // update slide children
    slides = changeParent(slides, parent, ref)

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
      if (parent === moveParent || moved.find((a: any) => a.id === ref.id)) {
        if (!newLayout[index].children) newLayout[index].children = {}
        newLayout[index].children[ref.id] = layout[i]
      }
    }
  })

  // find and remove children if parent has changed
  moved.forEach((a: any) => {
    if (a.newType === "child" || (a.newType === undefined && a.type === "child")) {
      newLayout.forEach((b) => {
        if (b.children?.[a.id] && b.id !== moveParent) delete b.children[a.id]
      })
    }
  })

  return { layout: newLayout, slides }
}
