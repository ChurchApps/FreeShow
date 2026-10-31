import { get } from "svelte/store"
import { uid } from "uid"
import type { Show, Slide, SlideData } from "../../../types/Show"
import { ShowObj } from "../../classes/Show"
import { checkName } from "../../components/helpers/show"
import { activePopup, alertMessage, drawerTabsData } from "../../stores"
import { translateText } from "../../utils/language"
import { createCategory, setTempShows } from "../importHelpers"
import { PowerPointPackage } from "./PowerPointHelper"

// missing charts/SmartArt
// item/line background, some text color incorrect
// extract embedded videos/audio

export function convertPowerpoint(files: any[]) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    // use selected category (or Presentation if no specific is selected)
    let categoryId = get(drawerTabsData).shows?.activeSubTab
    if (categoryId === "all" || categoryId === "unlabeled") categoryId = createCategory("presentation", "presentation", { isDefault: true })

    const tempShows: any[] = []

    setTimeout(() => {
        files.forEach(({ name, content }: any) => {
            // console.log("PPT", content)

            let pkg: PowerPointPackage
            try {
                pkg = new PowerPointPackage(content)
            } catch {
                return
            }
            const presentationPart = pkg.getPresentation()
            if (!presentationPart) return

            // load font faces
            const contentPaths = content.contentPaths || {}
            // loadAllFonts(contentPaths)
            const fonts = getAllFontNames(contentPaths)

            const convertedSlides = pkg.getSlides()
            let slides: { [key: string]: Slide } = {}
            let layouts: SlideData[] = []
            let firstSlideId = ""
            convertedSlides.forEach((slide) => {
                if (!slide) return

                const id = uid()
                // hidden PowerPoint slides are disabled
                const layoutData = { transition: { type: "none", duration: 0, easing: "linear" } as const, ...(slide.hidden ? { disabled: true } : {}) }

                slides[id] = {
                    group: !firstSlideId ? "." : null,
                    color: null,
                    settings: { color: slide.bgColor || "" },
                    notes: slide.notes,
                    items: slide.items
                }

                if (!firstSlideId) {
                    firstSlideId = id
                    slides[id].children = []
                    layouts.push({ id, ...layoutData, children: {} })
                } else {
                    slides[firstSlideId].children!.push(id)
                    layouts[0].children![id] = layoutData
                }
            })

            // create show
            const layoutID = uid()
            const show: Show = new ShowObj(false, categoryId, layoutID, 0, false)
            show.name = checkName(name)
            show.origin = "powerpoint"
            show.settings.customFonts = fonts

            const meta = getCoreProperties(content["docProps/core.xml"])
            if (meta) {
                show.meta = {
                    title: meta["dc:title"] || show.name,
                    artist: meta["dc:creator"] || ""
                }
                const created = new Date(meta["dcterms:created"] || 0).getTime()
                const modified = new Date(meta["dcterms:modified"] || 0).getTime()
                if (created || modified) show.timestamps = { created: created || modified, modified: modified || created, used: null }
            }

            show.slides = slides
            show.layouts = { [layoutID]: { name: translateText("example.default"), notes: "", slides: layouts } }

            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

// docProps/core.xml (parsed with preserveOrder) -> { "dc:title": "..." }
function getCoreProperties(json: any): { [key: string]: string } | null {
    const props = Array.isArray(json) ? json.find((n) => n?.["cp:coreProperties"])?.["cp:coreProperties"] : null
    if (!Array.isArray(props)) return null

    const values: { [key: string]: string } = {}
    props.forEach((prop) => {
        const key = Object.keys(prop || {}).find((k) => k !== ":@")
        const text = key ? prop[key]?.[0]?.["#text"] : null
        if (key && text != null) values[key] = String(text)
    })
    return values
}

function getAllFontNames(contentPaths: Record<string, string>) {
    const fontNames: { name: string; path: string }[] = []
    Object.keys(contentPaths).forEach((key) => {
        if (key.startsWith("ppt/fonts/") && key.endsWith(".fntdata")) {
            const fileName = key.slice(key.lastIndexOf("/") + 1)
            const match = fileName.match(/^(.+?)-?(regular|bold|italic|boldItalic)?\.fntdata$/i)
            if (match) {
                const name = spaceOnUppercase(match[1])
                fontNames.push({ name, path: contentPaths[key] })
            }
        }
    })
    return fontNames
}

function spaceOnUppercase(str: string) {
    // should not have space if there are multiple uppercase in a row (e.g., "PT Sans" not "P T Sans")
    return str.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
}
