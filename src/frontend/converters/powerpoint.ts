import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Show, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { checkName } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary, drawerTabsData } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"

export function convertPowerpoint(files: any[]) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    // use selected category (or Presentation if no specific is selected)
    let categoryId = get(drawerTabsData).shows?.activeSubTab
    if (categoryId === "all" || categoryId === "unlabeled") categoryId = createCategory("presentation", "presentation", { isDefault: true })

    const tempShows: any[] = []

    setTimeout(() => {
        files.forEach(({ name, content }: any) => {
            // sort by number in name to ensure correct slide order (ppt/slides/slide1.xml)
            const slideKeys = sortByNameNumber(Object.keys(content).filter((a) => a.includes("ppt/slides/slide")))

            const slides: string[][][] = slideKeys.map((key) => convertPPTX(content[key]))
            if (!slides.length) {
                alertMessage.set('This format is unsupported, try using an online "PPT to TXT converter".')
                return
            }

            // create show
            const layoutID = uid()
            const show: Show = new ShowObj(false, categoryId, layoutID)
            show.name = checkName(name)
            show.origin = "powerpoint"

            const meta: any = content["docProps/core.xml"]?.["cp:coreProperties"]
            if (meta) {
                show.meta = {
                    title: meta["dc:title"]?.[0] || show.name,
                    artist: meta["dc:creator"]?.[0] || ""
                }
                show.timestamps = {
                    created: new Date(meta["dcterms:created"]?.[0]?._ || 0).getTime(),
                    modified: new Date(meta["dcterms:modified"]?.[0]?._ || 0).getTime(),
                    used: null
                }
            }

            const { slidesObj, layouts } = createSlides(slides)
            show.slides = slidesObj
            show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layouts } }

            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

// extract number from ppt/slides/slide1.xml
export function sortByNameNumber(array: string[]) {
    return array.sort((a, b) => {
        // get numbers in name
        const matchA = a.match(/\d+/)
        const matchB = b.match(/\d+/)
        const numA = matchA ? parseInt(matchA[0], 10) : Infinity
        const numB = matchB ? parseInt(matchB[0], 10) : Infinity

        if (numA !== numB) return numA - numB

        return a.localeCompare(b)
    })
}

function convertPPTX(content: any) {
    const slide: string[][] = []

    // textboxes
    // WIP extract images etc.
    const lists = content?.["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0]?.["p:sp"] || []
    lists.forEach((list: any) => {
        if (!list?.["p:txBody"]?.length) return

        const lines: string[] = []
        list["p:txBody"][0]?.["a:p"]?.forEach((paragraph: any) => {
            // Check if paragraph has content
            if (!paragraph["a:r"] && !paragraph["a:br"]) return

            const textRuns = paragraph["a:r"] || []
            const lineBreaks = paragraph["a:br"] || []

            // If there are line breaks, split the text runs accordingly
            if (lineBreaks.length > 0) {
                textRuns.forEach((textRun: any) => {
                    const text = textRun["a:t"]?.[0] || ""
                    if (text.trim()) lines.push(text.trim())
                })
            } else {
                // No line breaks, concatenate all text runs into one line
                let paragraphText = ""
                textRuns.forEach((textRun: any) => {
                    paragraphText += textRun["a:t"]?.[0] || ""
                })
                if (paragraphText.trim()) lines.push(paragraphText.trim())
            }
        })
        slide.push(lines)
    })

    return slide
}

function createSlides(slides: string[][][]) {
    const slidesObj: { [key: string]: Slide } = {}
    const layouts: any[] = []

    slides.forEach((slide: any, i: number) => {
        const id: string = uid()
        layouts.push({ id })

        const items: Item[] = []
        slide.forEach((textbox) => {
            const lines: any[] = []
            textbox.forEach((line) => {
                lines.push({ align: "text-align: start;", text: [{ style: "", value: line }] })
            })

            items.push({ style: "inset-inlint-start:50px;top:120px;width:1820px;height:840px;", lines })
        })

        slidesObj[id] = {
            group: (i + 1).toString(),
            color: null,
            settings: {},
            notes: "",
            items
        }
    })

    return { slidesObj, layouts }
}
