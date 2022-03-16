import { get } from "svelte/store"
import type { OutSlide } from "../../../types/Show"
import { activeEdit, activePage, activeProject, activeShow, outBackground, outLocked, outOverlays, outSlide, outTransition, projects, showsCache } from "./../../stores"
import { _show } from "./shows"

const keys: any = {
  ArrowDown: (index: number | null, shows: any) => {
    // change active show in project
    if (index === null) return 0
    return shows.findIndex((_a: any, i: number) => i - 1 === index) || 0
  },
  ArrowUp: (index: number | null, shows: any) => {
    // change active show in project
    if (index === null) return shows.length - 1
    return shows.findIndex((_a: any, i: number) => i + 1 === index) || shows.length - 1
  },
}

export function checkInput(e: any) {
  if (e.target?.closest(".edit") || e.ctrlKey) return

  if (keys[e.key]) {
    if (get(activeProject) === null) return
    e.preventDefault()
    let shows = get(projects)[get(activeProject)!].shows
    let index: null | number = get(activeShow)?.index || null
    let newIndex: number = keys[e.key](index, shows)

    // Set active show in project list
    if (newIndex !== index) activeShow.set({ ...shows[newIndex], index: newIndex })
  }
}

export function nextSlide(e: any) {
  if (get(outLocked)) return
  if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

  let slide: null | OutSlide = get(outSlide)
  // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
  let layout: any[] = _show(slide ? slide.id : "active")
    .layouts(slide ? [slide.layout] : "active")
    .ref()[0]
  let isLastSlide: boolean = slide ? slide.index === layout.length - 1 && !layout[slide.index].end : false
  let index: null | number = null

  // TODO: active show slide index on delete......

  // go to beginning if live mode & ctrl | no output | last slide active
  if (
    get(activePage) === "show" &&
    get(activeShow) &&
    (!slide || e?.ctrlKey || (isLastSlide && get(activeShow)!.id !== slide?.id && get(showsCache)[get(activeShow)!.id]?.settings.activeLayout !== slide.layout))
  ) {
    // layout = GetLayout()
    layout = _show("active").layouts("active").ref()[0]
    if (!layout.filter((a) => !a.data.disabled).length) return

    index = 0
    while (layout[index].data.disabled) index++

    outSlide.set({ id: get(activeShow)!.id, layout: _show("active").get("settings.activeLayout"), index })
    updateOut(index, layout)
    return
  }

  if (!slide) return

  // TODO: Check for loop to beginning slide...
  index = getNextEnabled(slide.index)

  if (index !== null) {
    outSlide.set({ ...slide, index })
    updateOut(index, layout)
  }
}

export function previousSlide() {
  if (get(outLocked)) return
  if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

  let slide: null | OutSlide = get(outSlide)
  // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
  let layout: any[] = _show(slide ? slide.id : "active")
    .layouts(slide ? [slide.layout] : "active")
    .ref()[0]
  let activeLayout: string = _show(slide ? slide.id : "active").get("settings.activeLayout")
  let index: number = slide?.index !== undefined ? slide.index - 1 : layout.length - 1

  if (index < 0 || !layout.slice(0, index + 1).filter((a) => !a.data.disabled).length) return
  while (layout[index].disabled) index--

  if (slide) outSlide.set({ ...slide, index })
  else if (get(activeShow)) outSlide.set({ id: get(activeShow)!.id, layout: activeLayout, index })

  updateOut(index, layout)
}

function getNextEnabled(index: null | number): null | number {
  if (index === null) return null

  index++

  let slide: null | OutSlide = get(outSlide)
  let layout: any[] = _show(slide ? slide.id : "active")
    .layouts(slide ? [slide.layout] : "active")
    .ref()[0]

  if (layout[index].data.end) index = 0
  if (index >= layout.length || !layout.slice(index, layout.length).filter((a) => !a.data.disabled).length) return null

  while (layout[index].data.disabled || index > layout.length) index++
  return index
}

function updateOut(index: number, layout: any) {
  activeEdit.set({ slide: index, items: [] })

  // background
  if (layout[index].background) {
    let bg = get(showsCache)[get(outSlide)?.id || get(activeShow)!.id].media[layout[index].background!]
    outBackground.set({ path: bg.path, muted: bg.muted !== false })
  }

  // overlays
  if (layout[index].overlays?.length) {
    outOverlays.set([...new Set([...get(outOverlays), ...layout[index].overlays])])
  }

  // audio
  // if (layout[index].audio) {
  //   let a = get(showsCache)[get(outSlide)?.id || get(activeShow)!.id].audio[layout[index].audio!]
  //   outBackground.set({ path: a.path, volume: a.volume })
  // }

  // transition
  let t: any = layout[index].transition
  console.log(index, t)
  if (t && t.duration > 0) {
    t.action = "nextSlide"
    outTransition.set(t)
  } else outTransition.set(null)
}
