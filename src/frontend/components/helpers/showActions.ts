import { get } from "svelte/store"
import type { OutSlide } from "../../../types/Show"
import { activeEdit, activePage, activeProject, activeShow, outAudio, outBackground, outLocked, outOverlays, outSlide, outTransition, projects, showsCache } from "./../../stores"
import { _show } from "./shows"

const keys: any = {
  ArrowDown: (index: number | null, shows: any) => {
    // change active show in project
    if (index === null) return 0
    index = shows.findIndex((_a: any, i: number) => i - 1 === index)
    return index === null || index < 0 ? 0 : index
  },
  ArrowUp: (index: number | null, shows: any) => {
    // change active show in project
    if (index === null) return shows.length - 1
    index = shows.findIndex((_a: any, i: number) => i + 1 === index)
    return index === null || index < 0 ? shows.length - 1 : index
  },
}

export function checkInput(e: any) {
  if (e.target?.closest(".edit") || e.ctrlKey || e.metaKey) return

  if (keys[e.key]) {
    if (get(activeProject) === null) return
    e.preventDefault()
    let shows = get(projects)[get(activeProject)!].shows
    let index: null | number = get(activeShow)?.index !== undefined ? get(activeShow)!.index! : null
    let newIndex: number = keys[e.key](index, shows)

    // Set active show in project list
    if (newIndex !== index) activeShow.set({ ...shows[newIndex], index: newIndex })
  }
}

export function nextSlide(e: any, start: boolean = false, end: boolean = false, loop: boolean = false) {
  console.log(get(outSlide))

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
    (start || !slide || e?.ctrlKey || (isLastSlide && get(activeShow)!.id !== slide?.id && get(showsCache)[get(activeShow)!.id]?.settings.activeLayout !== slide.layout))
  ) {
    let id = loop ? slide!.id : get(activeShow)!.id
    if (!id) return

    // layout = GetLayout()
    layout = _show(id).layouts("active").ref()[0]
    if (!layout.filter((a) => !a.data.disabled).length) return

    index = 0
    while (layout[index].data.disabled) index++

    console.log(id, layout, index)
    outSlide.set({ id, layout: _show(id).get("settings.activeLayout"), index })
    updateOut(index, layout)
    return
  }

  if (!slide) return

  // TODO: Check for loop to beginning slide...
  index = getNextEnabled(slide.index, end)

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
  while (layout[index].data.disabled) index--

  if (slide) outSlide.set({ ...slide, index })
  else if (get(activeShow)) outSlide.set({ id: get(activeShow)!.id, layout: activeLayout, index })

  updateOut(index, layout)
}

function getNextEnabled(index: null | number, end: boolean = false): null | number {
  if (index === null) return null

  index++

  let slide: null | OutSlide = get(outSlide)
  let layout: any[] = _show(slide ? slide.id : "active")
    .layouts(slide ? [slide.layout] : "active")
    .ref()[0]

  if (layout[index - 1]?.data.end) index = 0
  if (!layout[index]) return null
  if (index >= layout.length || !layout.slice(index, layout.length).filter((a) => !a.data.disabled).length) return null

  while (layout[index].data.disabled && index < layout.length) index++

  if (end) {
    index = layout.length - 1
    while (layout[index].data.disabled && index > 0) index--
  }

  return index
}

export function updateOut(index: number, layout: any) {
  activeEdit.set({ slide: index, items: [] })
  _show(get(activeShow)!.id).set({ key: "timestamps.used", value: new Date().getTime() })
  let data = layout[index].data

  // background
  if (data.background) {
    let bg = get(showsCache)[get(outSlide)?.id || get(activeShow)!.id].media[data.background!]
    outBackground.set({ name: bg.name, type: bg.type || "media", path: bg.path, id: bg.id, muted: bg.muted !== false, loop: bg.loop !== false })
  }

  // overlays
  if (data.overlays?.length) {
    outOverlays.set([...new Set([...get(outOverlays), ...data.overlays])])
  }

  // audio
  // if (data.audio) {
  //   let a = get(showsCache)[get(outSlide)?.id || get(activeShow)!.id].audio[data.audio!]
  //   outBackground.set({ path: a.path, volume: a.volume })
  // }

  // nextTimer
  if ((data.nextTimer || 0) > 0) {
    outTransition.set({ duration: data.nextTimer })
  } else outTransition.set(null)

  // actions
  if (data.actions) {
    if (data.actions.clearBackground) outBackground.set(null)
    if (data.actions.clearOverlays) outOverlays.set([])
    if (data.actions.clearAudio) outAudio.set([])
  }
}
