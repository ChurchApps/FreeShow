import { uid } from "uid"
import { ShowObj } from "../classes/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { checkName, initializeMetadata } from "../components/helpers/show"
import { activePopup, alertMessage } from "../stores"
import { translateText } from "../utils/language"
import { createCategory, setTempShows } from "./importHelpers"
import { xml2json } from "./xml"

function cdataString(data: any): string {
    if (typeof data === "string") {
        return data
    }
    if (data && typeof data === "object" && "#cdata" in data) {
        return data["#cdata"]
    }
    return ""
}

function createSlides({ slide, slide2 }: any) {
    const slides: any = {}
    const layout: any[] = [];

    [
        cdataString(slide),
        cdataString(slide2)
    ].forEach(s => s
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
                    style: DEFAULT_ITEM_STYLE,
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
    )

    return { slides, layout }
}

export function convertVerseVIEW(data: any) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

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
            const songs = Array.isArray(songDB.song) ? songDB.song : [songDB.song]

            for (const song of songs) {
                const layoutID = uid()

                const categoryId = createCategory(`VerseVIEW/${cdataString(song.category) || "Uncategorized"}`)
                const show = new ShowObj(false, categoryId, layoutID)
                show.origin = "verseview"

                show.name = checkName(cdataString(song.name))

                const { slides, layout }: any = createSlides(song)

                const songNum = cdataString(song.subcat)

                show.meta = initializeMetadata({
                    number: Number.isNaN(songNum) ? String(songNum) : '',
                    title: cdataString(song.name),
                    author: cdataString(song.author),
                    publisher: cdataString(song.copyright),
                    copyright: cdataString(song.copyright),
                    // CCLI: null,
                    // year: song.year,
                })
                show.slides = slides
                show.layouts = {
                    [layoutID]: {
                        name: translateText("example.default"),
                        notes: "",
                        slides: layout
                    }
                }

                tempShows.push({ id: uid(), show })
            }
        })

        setTempShows(tempShows)
    }, 10)
}
