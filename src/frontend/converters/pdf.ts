import { get } from "svelte/store"
import { ShowObj } from "./../classes/Show"
import { uid } from "uid"
import { checkName } from "../components/helpers/show"
import type { Show, Slide } from "../../types/Show"
import { history } from "../components/helpers/history"
import { activeProject } from "../stores"
export function convertPDF({ name, path, pages }: any) {
  // create show
  let layoutID = uid()
  let show: Show = new ShowObj(false, "presentation", layoutID)
  show.name = checkName(name)
  // let { slidesObj, layouts } = createSlides(slides)
  // create images
  let media: any = {}
  let slides: { [key: string]: Slide } = {}
  let layouts: any[] = []
  ;[...Array(pages)].map((_a, i: number) => {
    i++
    let mediaID = uid()
    media[mediaID] = { name: "img-" + i + ".png", path: path + "/img-" + i + ".png", type: "image" }
    let slideID = uid()
    slides[slideID] = {
      group: i.toString(),
      color: null,
      settings: {},
      notes: "",
      items: [],
    }
    layouts.push({ id: slideID, background: mediaID })
  })
  show.media = media
  show.slides = slides
  show.layouts = { [layoutID]: { name: "", notes: "", slides: layouts } }
  // let newData: any = {name, category, settings: {}, meta}
  history({ id: "newShow", newData: { show }, location: { page: "show", project: get(activeProject) } })
}
