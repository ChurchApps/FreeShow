import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Show, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { checkName } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"

export function convertPowerpoint(files: any[]) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    let categoryId = createCategory("Presentation", "presentation", { isDefault: true })

    let tempShows: any[] = []

    setTimeout(() => {
        files.forEach(({ name, content }: any) => {
            let slides: string[][][] = []
            Object.keys(content).forEach((key) => {
                if (key.includes("ppt/slides/slide")) slides.push(convertPPTX(content[key]))
                else alertMessage.set('This format is unsupported, try using an online "PPT to TXT converter".')
            })

            // create show
            let layoutID = uid()
            let show: Show = new ShowObj(false, categoryId, layoutID)
            show.name = checkName(name)

            let meta: any = content["docProps/core.xml"]?.["cp:coreProperties"]
            if (meta) {
                show.meta = {
                    title: meta["dc:title"]?.[0] || show.name,
                    artist: meta["dc:creator"]?.[0] || "",
                }
                show.timestamps = {
                    created: new Date(meta["dcterms:created"]?.[0]?._ || 0).getTime(),
                    modified: new Date(meta["dcterms:modified"]?.[0]?._ || 0).getTime(),
                    used: null,
                }
            }

            let { slidesObj, layouts } = createSlides(slides)
            show.slides = slidesObj
            show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layouts } }

            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

function convertPPTX(content: any) {
    let slide: string[][] = []

    // textboxes
    // WIP extract images etc.
    let lists = content?.["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0]?.["p:sp"] || []
    lists.forEach((list: any) => {
        if (!list?.["p:txBody"]?.length) return

        let lines: string[] = []
        list["p:txBody"][0]?.["a:p"]?.forEach((line: any) => {
            if (!line?.["a:r"]) return

            let value: string = ""
            line["a:r"].forEach((list: any) => {
                value += list["a:t"]?.[0] || ""
            })

            lines.push(value)
        })
        slide.push(lines)
    })

    return slide
}

function createSlides(slides: string[][][]) {
    let slidesObj: { [key: string]: Slide } = {}
    let layouts: any[] = []

    slides.forEach((slide: any, i: number) => {
        let id: string = uid()
        layouts.push({ id })

        let items: Item[] = []
        slide.forEach((textbox) => {
            let lines: any[] = []
            textbox.forEach((line) => {
                lines.push({ align: "text-align: left;", text: [{ style: "", value: line }] })
            })

            items.push({ style: "left:50px;top:120px;width:1820px;height:840px;", lines })
        })

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
