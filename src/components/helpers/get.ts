import { get } from "svelte/store"
import type { Project, Projects } from "../../../types/Projects"
import type { ID, Layout, Output, OutputValues, Show, Shows, Slide } from "../../../types/Show"
import { activeProject, activeShow, output, projects, shows } from "../../stores"

// export const getProject = (id: ID): Project => get(projects)[id]
// export const getProjectShows = (id: ID): Project => getProject(id)[get(activeProject)].shows
// export const getShow = (showID: ID): Show => get(shows)[showID]
// export const getSlide = (showID: ID, slideIndex: number): Slide => getShow(showID).slides[slideID] // TODO: get layout...
export const getOutput = (): OutputValues => {
  let activeOutput: Output = get(output)
  return {
    background: "base64://",
    slide: {
      label: null,
      color: null,
      notes: "",
      items: [],
    }, // getSlide(activeOutput.slide.id, activeOutput.slide.index)
    overlay: "",
    audio: "",
  }
}

export const GetLayout = (showID: ID): null | Layout => {
  let currentShow = get(shows)[showID]
  if (currentShow) {
    if (currentShow.settings.activeLayout === null) {
      shows.update((s) => {
        s[showID].settings.activeLayout = Object.keys(currentShow.layouts)[0]
        return s
      })
    }
    return currentShow.layouts[currentShow.settings.activeLayout]
  }
  return null
}

export function GetShows() {
  let list: Shows = get(shows)
  // this.active = () => {
  //   this.slides = s[get(activeShow).id].slides

  //   let type = get(activeShow).type
  //   if (type === "video") return s[get(activeShow).id]
  //   else return s[get(activeShow).id]
  // }
  const active: Show = list[get(activeShow)?.id]
  return { list, active }
}

export const getSlide = (showID: ID, slideIndex: number): Slide => {
  return get(shows)[showID].slides[GetLayout(showID).slides[slideIndex].id]
}

export function GetProjects() {
  let list: Projects = get(projects)
  const active: Project = list[get(activeProject)]
  return { list, active }
  // this.active = p[get(activeProject)]
  // this.active = (): Project => p[get(activeProject)]
  // return p
}
// GetProjects.prototype.active = (): Project => get(projects)[get(activeProject)]
