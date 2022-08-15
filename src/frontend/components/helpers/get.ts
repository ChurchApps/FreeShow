import { get } from "svelte/store"
import type { Project, Projects } from "../../../types/Projects"
import type { ID, Show, Shows, Slide, SlideData } from "../../../types/Show"
import { activeProject, activeShow, projects, showsCache } from "../../stores"
import type { ShowRef } from "../../../types/Projects"

export function splitPath(path: string) {
  const name: string = path.substring((path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")) + 1)
  const extension: string = name.lastIndexOf(".") > -1 ? name.substring(name.lastIndexOf(".") + 1) : ""
  const shortName: string = extension ? name.slice(0, name.indexOf(extension) - 1) : name
  console.log(path, name)
  return { path, name, extension, shortName }
}

// export const getProject = (id: ID): Project => get(projects)[id]
// export const getProjectShows = (id: ID): Project => getProject(id)[get(activeProject)].shows
// export const getShow = (showID: ID): Show => get(showsCache)[showID]
// export const getSlide = (showID: ID, slideIndex: number): Slide => getShow(showID).slides[slideID] // TODO: get layout...

export const getOutBackground = () => {
  "base64://"
}
// export const getOutSlide = (): null | Slide => {
//   // let activeOutput: Output = get(output)
//   return {
//     group: null,
//     color: null,
//     settings: {},
//     notes: "",
//     items: [],
//   } // getSlide(activeOutput.slide.id, activeOutput.slide.index)
// }
export const getOutOverlays = () => []

export const GetLayout = (showID: null | ID = null, layoutID: null | ID = null): SlideData[] => {
  // console.trace(showID)
  if (!showID) showID = get(activeShow)!.id
  let currentShow: Show = get(showsCache)[showID]
  if (!layoutID) layoutID = currentShow?.settings?.activeLayout
  let layoutSlides: SlideData[] = []
  if (currentShow?.layouts) {
    currentShow.layouts[layoutID].slides.forEach((ls) => {
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
  // this.active = () => {
  //   this.slides = s[get(activeShow).id].slides

  //   let type = get(activeShow).type
  //   if (type === "video") return s[get(activeShow).id]
  //   else return s[get(activeShow).id]
  // }
  const active: Show | null = list[get(activeShow)?.id!] || null /////////
  return { list, active }
}

export const getSlide = (out: any): Slide => {
  return get(showsCache)[out.id].slides[GetLayout(out.id, out.layout)[out.index]?.id]
}

export function GetProjects() {
  let list: Projects = get(projects)
  const active: Project = list[get(activeProject)!]
  return { list, active }
  // this.active = p[get(activeProject)]
  // this.active = (): Project => p[get(activeProject)]
  // return p
}
// GetProjects.prototype.active = (): Project => get(projects)[get(activeProject)]
