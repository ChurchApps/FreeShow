import { activePopup, alertMessage, dictionary } from "../stores"
import { xml2json } from "./xml"
import { uid } from "uid"
import { ShowObj } from "../classes/Show"
import { createCategory, setTempShows } from "./importHelpers"
import { checkName, initializeMetadata } from "../components/helpers/show"
import { get } from "svelte/store"

function createSlides({ slide }: any) {
    const slides: any = {}
    const layout: any[] = []

    if (typeof slide !== "string") {
        slide = slide["#cdata"]
    }

    if (!slide) return { slides, layout }

    slide
        .split("<slide>")
        .filter((a) => Boolean(a.trim()))
        .map((lines) =>
            lines
                .replace(/<BR>/gi, "<br>")
                .split("<br>")
                .map((line) => line.trim())
                .filter((a) => Boolean(a.trim()))
        )
        .forEach((lines: string[]) => {
            const id: string = uid()
            layout.push({ id })

            const items = [
                {
                    style: "inset-inline-start:50px;top:120px;width:1820px;height:840px;",
                    lines: lines.map((text: any) => ({ align: "", text: [{ style: "", value: text.trim() }] })),
                },
            ]

            slides[id] = {
                group: "",
                color: null,
                settings: {},
                notes: "",
                items,
            }
        })

    return { slides, layout }
}

export function convertVerseVIEW(data: any) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    const categoryId = createCategory("VerseVIEW")

    setTimeout(() => {
        const tempShows: any[] = []

        data?.forEach(({ content }: any) => {
            if (!content) {
                console.error("File missing content!")
                return
            }

            const root = xml2json(content)

            if (!root) return

            const { songDB } = root
            const { song: songs } = songDB

            for (const song of songs) {
                const layoutID = uid()
                const show = new ShowObj(false, categoryId, layoutID)

                show.name = checkName(song.name)

                const { slides, layout }: any = createSlides(song)

                show.meta = initializeMetadata({
                    // number: song.number,
                    title: song.name,
                    author: song.author,
                    // publisher: song.publisher,
                    // copyright: song.copyright,
                    // CCLI: null,
                    // year: song.year,
                })
                show.slides = slides
                show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layout } }

                tempShows.push({ id: uid(), show })
            }
        })

        setTempShows(tempShows)
    }, 10)
}
