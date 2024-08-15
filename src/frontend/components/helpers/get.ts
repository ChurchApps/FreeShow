import { get } from "svelte/store"
import type { Project, Projects } from "../../../types/Projects"
import type { ID, Show, Shows, Slide, SlideData } from "../../../types/Show"
import { activeProject, activeShow, projects, showsCache } from "../../stores"
import type { ShowRef } from "../../../types/Projects"
import { getExtension, getFileName, removeExtension } from "./media"

// please don't use the functions in this file!
// they are outdated, but still in use

export function splitPath(path: string) {
  const name: string = getFileName(path)
  const extension: string = getExtension(name)
  const shortName: string = removeExtension(name)
  return { path, name, extension, shortName }
}

export const getOutBackground = () => {
  "base64://"
}
export const getOutOverlays = () => []

export const GetLayout = (showID: null | ID = null, layoutID: null | ID = null): SlideData[] => {
  if (!showID) showID = get(activeShow)?.id || null
  if (!showID) return []
  let currentShow: Show = get(showsCache)[showID]
  if (!layoutID) layoutID = currentShow?.settings?.activeLayout
  let layoutSlides: SlideData[] = []
  if (currentShow?.layouts) {
    currentShow.layouts[layoutID]?.slides?.forEach((ls) => {
      if (ls && currentShow.slides[ls.id]) {
        let slide: Slide = currentShow.slides[ls.id]
        let newLS = { ...ls }
        delete newLS.children
        layoutSlides.push({ ...newLS, color: slide.color })

        if (slide.children) {
          slide.children.forEach((id: string) => {
            if (ls.children?.[id]) {
              let slideData: any = ls.children[id]
              if (slideData) layoutSlides.push({ id, ...slideData, color: slide.color, parent: ls.id })
            } else layoutSlides.push({ id, color: slide.color, parent: ls.id })
          })
        }
      }
    })
  }
  return layoutSlides
}

export const GetLayoutRef = (showID: null | ID = null, layoutID: null | ID = null): any[] => {
  if (!showID) showID = get(activeShow)!.id
  let currentShow: Show = get(showsCache)[showID]
  if (!layoutID) layoutID = currentShow.settings.activeLayout
  let layoutSlides: any[] = []
  if (currentShow) {
    currentShow.layouts[layoutID].slides.forEach((ls, i) => {
      let slide: Slide = currentShow.slides[ls.id]
      if (slide) {
        layoutSlides.push({ type: "parent", id: ls.id, index: i })
        if (slide.children) {
          slide.children.forEach((id: string, j) => {
            layoutSlides.push({ type: "child", id, parent: ls.id, layoutIndex: i, slideIndex: j })
          })
        }
      }
    })
  }
  return layoutSlides
}

// only for groups
export const GetSlideLayout = (slideID: ID): any[] => {
  let currentShow: Show = get(showsCache)[get(activeShow)!.id]
  let layoutSlides: any[] = []
  if (currentShow) {
    let slide: Slide = currentShow.slides[slideID]
    layoutSlides.push({ id: slideID })
    slide.children?.forEach((id: string) => layoutSlides.push({ id: id, color: slide.color, parent: slideID }))
  }
  return layoutSlides
}
export const GetSlideLayoutRef = (slideID: ID): any[] => {
  let currentShow: Show = get(showsCache)[get(activeShow)!.id]
  let layoutSlides: any[] = []
  if (currentShow) {
    let slide: Slide = currentShow.slides[slideID]
    layoutSlides.push({ type: "parent", id: slideID, index: null })
    slide.children?.forEach((id: string, j) => layoutSlides.push({ type: "child", id, parent: slideID, layoutIndex: null, slideIndex: j }))
  }
  return layoutSlides
}

export const GetShow = (ref: ShowRef): Show => {
  let s: Show
  if (ref.type === "video") {
  } else {
    s = get(showsCache)[ref.id]
  }
  return s!
}

export function GetShows() {
  let list: Shows = get(showsCache)
  const active: Show | null = list[get(activeShow)?.id!] || null
  return { list, active }
}

export const getSlide = (out: any): Slide => {
  return get(showsCache)[out.id].slides[GetLayout(out.id, out.layout)[out.index]?.id]
}

export function GetProjects() {
  let list: Projects = get(projects)
  const active: Project = list[get(activeProject)!]
  return { list, active }
}