import { get } from "svelte/store"
import { uid } from "uid"
import type { Show, Slide } from "../../types/Show"
import { checkName } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary } from "../stores"
import { ShowObj } from "./../classes/Show"
import { createCategory, setTempShows } from "./importHelpers"

export function convertPDF(PDFs: any[]) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    createCategory("Presentation", "presentation", { isDefault: true })

    let tempShows: any[] = []

    setTimeout(() => {
        PDFs.forEach(({ name, path, pages }: any) => {
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
                let imageName = "img-" + getIndex(pages, i) + ".png"
                console.log(imageName)
                media[mediaID] = { name: imageName, path: path + "/" + imageName, type: "image" }
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
            show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layouts } }
            // let newData: any = {name, category, settings: {}, meta}

            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

function getIndex(pages: number, index: number) {
    let temp: string = "0000000000" + index
    return temp.slice(-pages.toString().length)
}
