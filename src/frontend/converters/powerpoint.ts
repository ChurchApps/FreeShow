import { get } from "svelte/store"
import { uid } from "uid"
import type { Show, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
import { activeProject, dictionary } from "../stores"

export function convertPowerpoint(files: any[]) {
  files.forEach(({ name, content }: any) => {
    let slides: string[][] = []
    Object.keys(content).forEach((key) => {
      if (key.includes("ppt/slides/slide")) {
        let slide: string[] = []
        let lists = content[key]["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"]
        lists?.forEach((list: any) => {
          if (list["p:txBody"]) {
            list["p:txBody"][0]["a:p"]?.forEach((line: any) => {
              if (line["a:r"]) {
                let value: string = ""
                line["a:r"].forEach((list: any) => {
                  value += list["a:t"][0]
                })
                slide.push(value)
              }
            })
          }
        })
        slides.push(slide)
      }
    })
    console.log(slides)

    // create show
    let layoutID = uid()
    let show: Show = new ShowObj(false, "presentation", layoutID)
    show.name = checkName(name)
    let meta: any = content["docProps/core.xml"]["cp:coreProperties"]
    show.meta = {
      title: meta["dc:title"][0],
      artist: meta["dc:creator"][0],
    }
    console.log(meta)
    show.timestamps = {
      created: new Date(meta["dcterms:created"][0]._).getTime(),
      modified: new Date(meta["dcterms:modified"][0]._).getTime(),
      used: null,
    }
    let { slidesObj, layouts } = createSlides(slides)
    show.slides = slidesObj
    show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layouts } }
    // let newData: any = {name, category, settings: {}, meta}

    let location: any = { page: "show" }
    if (files.length === 1) location.project = get(activeProject)
    history({ id: "newShow", newData: { show }, location })

    // // meta
    // docProps/core.xml cp:coreProperties
    // dc:creator: [""]
    // dc:title: [""]
    // dcterms:created: [{_: "2020-06-29T12:32:37Z"}]
    // dcterms:modified: [{_: "2020-07-02T08:27:31Z"}]

    // // slides
    // ppt/slideLayouts/slideLayout1.xml ...

    // ppt/slides/slide1.xml
    // p:sld: {…}
    // p:cSld: [{…}]
    // p:spTree: [{…}]
    // p:sp: [{…}]
    // p:txBody: [{…}]
    // a:p [{}]
    // a:r [{}]
    // a:t: ["text"]
  })
}

function createSlides(slides: string[][]) {
  let slidesObj: { [key: string]: Slide } = {}
  let layouts: any[] = []
  slides.forEach((slide: any, i: number) => {
    let id: string = uid()
    layouts.push({ id })
    let items = [{ style: "left:50px;top:120px;width:1820px;height:840px;", lines: slide.map((a: any) => ({ align: "text-align: left;", text: [{ style: "", value: a }] })) }]
    slidesObj[id] = {
      group: (i + 1).toString(),
      color: null,
      settings: {},
      notes: "",
      items,
    }
  })
  return { slidesObj, layouts }
}
