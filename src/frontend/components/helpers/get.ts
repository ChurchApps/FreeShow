import { stageShows } from "./../../stores"
import type { ShowRef } from "./../../../types/Projects"
import { get } from "svelte/store"
import type { Project, Projects } from "../../../types/Projects"
import type { ID, Show, Shows, Slide, SlideData } from "../../../types/Show"
import { activeProject, activeShow, projects, shows } from "../../stores"

// export const getProject = (id: ID): Project => get(projects)[id]
// export const getProjectShows = (id: ID): Project => getProject(id)[get(activeProject)].shows
// export const getShow = (showID: ID): Show => get(shows)[showID]
// export const getSlide = (showID: ID, slideIndex: number): Slide => getShow(showID).slides[slideID] // TODO: get layout...

export const getStageShows = () => {
  return Object.entries(get(stageShows))
    .map(([id, a]) => ({ id, enabled: a.enabled, name: a.name, password: a.password }))
    .filter((a) => a.enabled)
}
export const getOutBackground = () => {
  "base64://"
}
export const getOutSlide = (): null | Slide => {
  // let activeOutput: Output = get(output)
  return {
    label: null,
    color: null,
    settings: {},
    notes: "",
    items: [],
  } // getSlide(activeOutput.slide.id, activeOutput.slide.index)
}
export const getOutOverlays = () => []

export const GetLayout = (showID: null | ID = null): SlideData[] => {
  if (!showID) showID = get(activeShow)!.id
  let currentShow: Show = get(shows)[showID]
  let layoutSlides: SlideData[] = []
  if (currentShow) {
    currentShow.layouts[currentShow.settings.activeLayout].slides.forEach((ls) => {
      let slide: Slide = currentShow.slides[ls.id]
      layoutSlides.push({ ...ls, color: slide.color })
      if (slide.children) {
        slide.children.forEach((sc) => {
          layoutSlides.push({ ...sc, color: slide.color, childOf: ls.id })
        })
        // layoutSlides = [...layoutSlides, ...slide.children]
      }
    })
  }
  return layoutSlides
}

export const GetShow = (ref: ShowRef): Show => {
  let s: Show
  if (ref.type === "video") {
  } else {
    s = get(shows)[ref.id]
  }
  return s!
}

export function GetShows() {
  let list: Shows = get(shows)
  // this.active = () => {
  //   this.slides = s[get(activeShow).id].slides

  //   let type = get(activeShow).type
  //   if (type === "video") return s[get(activeShow).id]
  //   else return s[get(activeShow).id]
  // }
  const active: Show | null = list[get(activeShow)?.id!] || null /////////
  return { list, active }
}

export const getSlide = (showID: ID, slideIndex: number): Slide => {
  return get(shows)[showID].slides[GetLayout(showID)[slideIndex]?.id]
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
