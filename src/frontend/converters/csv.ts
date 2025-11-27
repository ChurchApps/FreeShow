import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { clone } from "../components/helpers/array"
import { setQuickAccessMetadata } from "../components/helpers/setShow"
import { checkName } from "../components/helpers/show"
import { activePopup, alertMessage, drawerTabsData } from "../stores"
import { setTempShows } from "./importHelpers"

const DEFAULT_SLIDE = { group: "", color: "", globalGroup: "verse", settings: {}, notes: "", items: [] }

export function convertCSV(data: any) {
    alertMessage.set("popup.importing")
    activePopup.set("alert")

    const tempShows: any[] = []

    setTimeout(() => {
        data.forEach(file => {
            const name: string = file.name
            const content: string = file.content

            const slides: Slide[] = []
            content.split("\n").forEach(createSlide)
            function createSlide(csvLine: string) {
                const items: Item[] = []

                const fields = parseCSVLine(csvLine)
                fields.forEach(text => {
                    const line = { align: "", text: [{ value: text, style: "" }] }
                    items.push({ lines: [line], style: DEFAULT_ITEM_STYLE })
                })

                slides.push({ ...clone(DEFAULT_SLIDE), items })
            }

            const show = createShow({ slides, name })
            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

function createShow({ slides, name }) {
    const layoutID: string = uid()
    let category = get(drawerTabsData).shows?.activeSubTab
    if (category === "all" || category === "unlabeled") category = null
    let show = new ShowObj(false, category, layoutID)

    // remove empty slides
    slides = slides.filter(a => a.items.length)

    const layouts = getLayout(slides)
    const newSlides: any = {}
    layouts.forEach(({ id }, i) => {
        newSlides[id] = slides[i]
    })

    show.name = checkName(name)
    show.slides = newSlides
    show.layouts[layoutID].slides = layouts
    if (show.meta.CCLI) show = setQuickAccessMetadata(show, "CCLI", show.meta.CCLI)

    return show
}

function getLayout(slides: Slide[]) {
    const layout: any[] = slides.map(() => ({ id: uid() }))
    return layout
}

function parseCSVLine(line) {
    const regex = /"{3}([^"]+)"{3}|"(.*?)"|([^,]+)/g
    const matches: string[] = []
    let match

    while ((match = regex.exec(line)) !== null) {
        if (match[1] !== undefined) {
            matches.push(`"${match[1]}"`) // Keep one quote if triple quotes were used
        } else if (match[2] !== undefined) {
            matches.push(match[2]) // Regular quoted field
        } else {
            matches.push(match[3]) // Unquoted field
        }
    }

    return matches
}
