import { get } from "svelte/store"
import type { OutSlide } from "../../../types/Show"
import {
  activeEdit,
  activePage,
  activeProject,
  activeShow,
  media,
  outBackground,
  outLocked,
  outOverlays,
  outSlide,
  outTransition,
  projects,
  showsCache,
  videoExtensions,
} from "./../../stores"
import { clearAudio, playAudio } from "./audio"
import { _show } from "./shows"

const keys: any = {
  ArrowDown: (index: number | null, shows: any) => {
    // change active show in project
    if (index === null) return 0
    index = shows.findIndex((_a: any, i: number) => i - 1 === index)
    return index === null || index < 0 ? null : index
  },
  ArrowUp: (index: number | null, shows: any) => {
    // change active show in project
    if (index === null) return shows.length - 1
    index = shows.findIndex((_a: any, i: number) => i + 1 === index)
    return index === null || index < 0 ? null : index
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
    if (newIndex !== null && newIndex !== index) activeShow.set({ ...shows[newIndex], index: newIndex })
  }
}

export function nextSlide(e: any, start: boolean = false, end: boolean = false, loop: boolean = false, bypassLock: boolean = false) {
  console.log(get(outSlide))

  if (get(outLocked) && !bypassLock) return
  if (document.activeElement instanceof window.HTMLElement) document.activeElement.blur()

  let slide: null | OutSlide = get(outSlide)
  // let layout: SlideData[] = GetLayout(slide ? slide.id : null, slide ? slide.layout : null)
  let layout: any[] = _show(slide ? slide.id : "active")
    .layouts(slide ? [slide.layout] : "active")
    .ref()[0]
  let isLastSlide: boolean = slide && layout ? slide.index === layout.length - 1 && !layout[slide.index].end : false
  let index: null | number = null

  // TODO: active show slide index on delete......

  // go to beginning if live mode & ctrl | no output | last slide active
  if (
    get(activePage) === "show" &&
    get(activeShow) &&
    (start || !slide || e?.ctrlKey || (isLastSlide && (get(activeShow)!.id !== slide?.id || get(showsCache)[get(activeShow)!.id]?.settings.activeLayout !== slide.layout)))
  ) {
    let id = loop ? slide!.id : get(activeShow)!.id
    if (!id) return

    // layout = GetLayout()
    layout = _show(id).layouts("active").ref()[0]
    if (!layout?.filter((a) => !a.data.disabled).length) return

    index = 0
    while (layout[index].data.disabled) index++

    console.log(id, layout, index)
    outSlide.set({ id, layout: _show(id).get("settings.activeLayout"), index })
    updateOut(id, index, layout)
    return
  }

  if (!slide || slide.id === "temp") return

  // TODO: Check for loop to beginning slide...
  index = getNextEnabled(slide.index!, end)

  if (index !== null) {
    outSlide.set({ ...slide, index })
    updateOut(slide ? slide.id : "active", index, layout)
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

  updateOut(slide ? slide.id : "active", index, layout)
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

export function getMediaFilter(bakgroundPath: string) {
  let filter = ""
  let mediaFilter = get(media)[bakgroundPath]?.filter
  if (mediaFilter) Object.entries(mediaFilter).forEach(([id, a]: any) => (filter += ` ${id}(${a})`))
  return filter
}
export function getMediaFlipped(bakgroundPath: string) {
  return get(media)[bakgroundPath]?.flipped || false
}

export function updateOut(id: string, index: number, layout: any, extra: boolean = true) {
  if (get(activePage) !== "edit") activeEdit.set({ slide: index, items: [] })
  console.log(id)

  _show(id).set({ key: "timestamps.used", value: new Date().getTime() })
  let data = layout[index]?.data

  // holding "alt" key will disable all extra features
  if (!extra || !data) return

  // background
  if (data.background) {
    let bg = _show(id).get("media")[data.background!]
    if (bg) {
      let filter = getMediaFilter(bg.path)
      let flipped = getMediaFlipped(bg.path)
      outBackground.set({
        name: bg.name,
        type: bg.type || get(videoExtensions).includes(bg.path.slice(bg.path.lastIndexOf(".") + 1, bg.path.length)) ? "video" : "image",
        path: bg.path,
        id: bg.id,
        muted: bg.muted !== false,
        loop: bg.loop !== false,
        filter,
        flipped,
      })
    }
  }

  // overlays
  if (data.overlays?.length) {
    outOverlays.set([...new Set([...get(outOverlays), ...data.overlays])])
  }

  // audio
  if (data.audio) {
    let a = _show(id).get("media")[data.audio!]
    playAudio(a)
  }

  // nextTimer
  if ((data.nextTimer || 0) > 0) {
    outTransition.set({ duration: data.nextTimer })
  } else outTransition.set(null)

  // actions
  if (data.actions) {
    if (data.actions.clearBackground) outBackground.set(null)
    if (data.actions.clearOverlays) outOverlays.set([])
    if (data.actions.clearAudio) clearAudio()
  }
}
