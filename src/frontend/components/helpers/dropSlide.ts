import { get } from "svelte/store"
import { shows, activeShow, selected } from "./../../stores"
import { GetLayout } from "./get"
import type { SlideData } from "./../../../types/Show"
import { uid } from "uid"

export function drop(data: number, side: "start" | "end") {
  let layout: SlideData[] = GetLayout() // new layout

  // let index: number = get(drag).index === null ? layout.length : get(drag).index!

  let sel: any[] = get(selected).elems

  // let slides: SlideData[] = [] // new slides
  let slides: any[] = [] // new slides
  let newChildren: { [key: string]: SlideData[] } = {}

  if (side === "end" && sel[0] !== data) data++
  let insertIndex: number = data

  if (get(selected).id === "slide") {
    // logic:
    // main moved = move group
    // moved before main
    // moved after main = add after main + change children
    // child moved = move child
    // -
    // moving multiple:
    // main & childs = create new group
    // only mains = move groups
    // only children = move children

    // check if first selected slide is a child
    let parent: string

    if (data === 0) {
      parent = layout[0].id
      if (layout[0].parent) delete layout[0].parent
    } else if (sel[0] && !layout[sel[0]].parent) parent = layout[sel[0]].id
    else parent = layout[data - 1].parent || layout[data - 1].id

    // remove selected
    sel
      .sort((a, b) => a - b)
      .forEach((i) => {
        console.log(i, insertIndex)

        if (i < insertIndex) insertIndex--
        if (layout[i - slides.length].parent) {
          // ! only if not same parent is selected
          // newChild(layout[i - slides.length])
        }
        slides.push(layout.splice(i - slides.length, 1)[0])
      })

    // add children to new
    let pos = 0
    console.log({ ...layout })
    console.log({ ...layout[insertIndex + pos] })
    while (layout[insertIndex + pos]?.parent) {
      newChild(layout[insertIndex + pos])
      pos++
    }

    // remove all children slides
    layout.forEach((slideData: SlideData, i: number) => {
      if (slideData.parent) {
        layout.splice(i, 1)
        if (i < insertIndex) insertIndex--
      }
    })

    // check if its both parents and childs
    let both: boolean = false
    let children: number = 0
    let parents: number = 0
    slides.forEach((slide: SlideData, i: number) => {
      if (slide.parent) children++
      else if (i > 0) parents++
    })
    if (children > 0 && parents > 0) both = true

    // create new slide (group)
    if (both) {
      let id: string = uid(10) // ? 10
      shows.update((s) => {
        s[get(activeShow)!.id].slides[id] = { ...s[get(activeShow)!.id].slides[parent] }
        s[get(activeShow)!.id].slides[id].label = s[get(activeShow)!.id].slides[id].label + "_copy"
        // s[get(activeShow)!.id].slides[id].color = null
        // TODO: history
        return s
      })
      // TODO: group remove parents....
      slides[0].id = id
      parent = id
      if (slides[0].parent) delete slides[0].parent
    }

    console.log(parent)
    console.log([...slides])
    // TODO: selecting multiple childs from same parent...
    // TODO: slides behaving weirdly...
    slides.forEach((slide: SlideData, i: number) => {
      console.log(slide)

      if (slide.parent && (!both || i > 0)) newChild(slide)
      if (slide.parent) slides.splice(i, 1)
    })
    console.log({ ...newChildren })

    // add new child
    function newChild(data: SlideData) {
      if (!newChildren[parent]) newChildren[parent] = []
      newChildren[parent].push(data)
    }
  } else if (get(selected).id === "slide_group") {
    // let group: Slide = get(shows)[get(activeShow)!.id].slides[data]
    // group.children.forEach((child: SlideData) => {});
    // slides = [{ id: data, color: group.color }]
    slides = [...get(selected).elems]

    // TODO: add children to group!

    // remove all children slides
    layout.forEach((slideData: SlideData, i: number) => {
      if (slideData.parent) {
        layout.splice(i, 1)
        if (i < data!) insertIndex--
      }
    })
  }
  console.log([...slides], [...layout], insertIndex)

  // add slides
  layout = [...layout.slice(0, insertIndex), ...slides, ...layout.slice(insertIndex, layout.length)]
  console.log([...layout])

  // update children
  // Object.entries(newChildren).forEach((childArr) => {
  //   shows.update((s) => {
  //     childArr[1].forEach((slide: SlideData) => {
  //       let found: boolean = false
  //       let childs: SlideData[] = []
  //       s[get(activeShow)!.id].slides[slide.parent!].children!.forEach((child: SlideData) => {
  //         if (!found && child.id !== slide.id) {
  //           delete child.parent
  //           childs.push(child)
  //         } else found = true
  //       })
  //       s[get(activeShow)!.id].slides[slide.parent!].children = childs
  //     })
  //     s[get(activeShow)!.id].slides[childArr[0]].children = childArr[1]
  //     // childArr[1].forEach((obj: SlideData) => {
  //     //   slide.children = obj
  //     // });
  //     // TODO: history
  //     return s
  //   })
  // })

  // update layout
  shows.update((s) => {
    s[get(activeShow)!.id].layouts[get(shows)[get(activeShow)!.id].settings.activeLayout].slides = layout
    // TODO: history
    return s
  })
}
