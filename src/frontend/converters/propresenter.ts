import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Layout } from "../../types/Show"
import { history } from "../components/helpers/history"
import { checkName, getGlobalGroup, initializeMetadata, newSlide } from "../components/helpers/show"
import { ShowObj } from "./../classes/Show"
import { activePopup, activeProject, dictionary, drawerTabsData, groups } from "./../stores"
import { xml2json } from "./xml"

export function convertProPresenter(data: any) {
    data?.forEach(({ content, name, extension }: any) => {
        let song: any = {}

        if (extension === "json") {
            try {
                song = JSON.parse(content)
            } catch (err) {
                console.error(err)
            }
        } else {
            song = xml2json(content)?.RVPresentationDocument
        }

        if (!song) return

        let category = get(drawerTabsData).shows?.activeSubTab
        if (category === "all" || category === "unlabeled") category = null

        let layoutID = uid()
        let show = new ShowObj(false, category || null, layoutID)
        show.name = checkName(name)

        let converted: any = {}

        if (extension === "json") {
            converted = convertJSONToSlides(song)
        } else {
            converted = convertToSlides(song, extension)
        }

        let { slides, layouts, media }: any = converted

        show.slides = slides
        show.layouts = {}
        show.media = media

        show.meta = initializeMetadata({
            title: song["@CCLISongTitle"],
            artist: song["@CCLIArtistCredits"],
            author: song["@CCLIAuthor"],
            publisher: song["@CCLIPublisher"],
            CCLI: song["@CCLISongNumber"],
            year: song["@CCLICopyrightYear"],
        })

        layouts.forEach((layout: any, i: number) => {
            show.layouts[i === 0 ? layoutID : layout.id] = {
                name: layout.name || get(dictionary).example?.default || "",
                notes: i === 0 ? song["@notes"] || "" : "",
                slides: layout.slides,
            }
        })

        let location: any = { page: "show" }
        if (data.length === 1) location.project = get(activeProject)
        history({ id: "newShow", newData: { id: song["@uuid"] || uid(), show, open: data.length < 2 }, location })
    })

    activePopup.set(null)
}

const JSONgroups: any = { V: "verse", C: "chorus", B: "bridge", T: "tag", O: "outro" }
function convertJSONToSlides(song: any) {
    let slides: any = {}
    let layoutSlides: any = []

    let initialSlidesList: string[] = song.verse_order_list || []
    let slidesList: string[] = []
    let slidesRef: any = {}

    song.verses.forEach(([text, label]) => {
        if (!text) return

        let id: string = uid()
        slidesList.push(label)
        slidesRef[label] = id

        layoutSlides.push({ id })

        let items = [
            {
                style: "left:50px;top:120px;width:1820px;height:840px;",
                lines: text.split("\n").map((a: any) => ({ align: "", text: [{ style: "", value: a }] })),
            },
        ]

        slides[id] = newSlide({ items })

        let globalGroup = label ? JSONgroups[label.replace(/[0-9]/g, "").toUpperCase()] : "verse"
        if (get(groups)[globalGroup]) slides[id].globalGroup = globalGroup
    })

    if (initialSlidesList.length) slidesList = initialSlidesList
    if (slidesList.length) {
        layoutSlides = []
        slidesList.forEach((label) => {
            if (slidesRef[label]) layoutSlides.push({ id: slidesRef[label] })
        })
    }

    let layouts = [{ id: uid(), name: "", notes: "", slides: layoutSlides }]
    return { slides, layouts }
}

function convertToSlides(song: any, extension: string) {
    let groups: any = []
    if (extension === "pro4") groups = song.slides.RVDisplaySlide || []
    if (extension === "pro5") groups = song.groups.RVSlideGrouping || []
    if (extension === "pro6") groups = song.array[0].RVSlideGrouping || []
    if (!Array.isArray(groups)) groups = [groups]
    let arrangements = song.arrangements || song.array?.[1]?.RVSongArrangement || []

    let slides: any = {}
    let layouts: any[] = [{ id: null, name: "", slides: [] }]
    let media: any = {}
    let sequences: any = {}

    let backgrounds: any = []

    groups.forEach((group) => {
        let groupSlides = group
        if (extension === "pro4") groupSlides = [groupSlides]
        if (extension === "pro5") groupSlides = groupSlides.slides.RVDisplaySlide
        if (extension === "pro6" && groupSlides.array) groupSlides = groupSlides.array.RVDisplaySlide
        if (!Array.isArray(groupSlides)) groupSlides = [groupSlides]
        if (!groupSlides?.length) return

        groupSlides.forEach((slide, i) => {
            let items: Item[] = getSlideItems(slide)
            if (!items) return

            let slideIsDisabled = slide["@enabled"] === "false"
            let slideId: string = uid()

            slides[slideId] = newSlide({ notes: slide["@notes"] || "", items })

            // media
            let media = slide.RVMediaCue

            // TODO: images
            let path: string = media?.RVVideoElement?.["@source"] || ""
            if (path) backgrounds[i] = { path, name: media["@displayName"] || "" }

            let isFirstSlide: boolean = i === 0
            if (isFirstSlide) {
                slides[slideId] = makeParentSlide(slides[slideId], {
                    label: group["@name"] || slides[slideId]["@label"] || "",
                    color: group["@color"] || slides[slideId]["@highlightColor"],
                })

                let groupId = group["@uuid"]
                sequences[groupId] = slideId

                let l: any = { id: slideId }
                if (slideIsDisabled) l.disabled = true
                layouts[0].slides.push(l)
            } else {
                // children
                let parentLayout = layouts[0].slides[layouts[0].slides.length - 1]
                let parentSlide = slides[parentLayout.id]
                if (!parentSlide.children) parentSlide.children = []
                parentSlide.children.push(slideId)

                if (slideIsDisabled) {
                    if (!parentLayout.children) parentLayout.children = {}
                    parentLayout.children[slideId] = { disabled: true }
                }
            }
        })
    })

    if (arrangements.length) {
        let newLayouts = arrangeLayouts(arrangements, sequences)
        // if (newLayouts.length) layouts = newLayouts
        if (newLayouts.length) layouts.push(...newLayouts)
    }

    backgrounds.forEach((background: any, i: number) => {
        if (!background || !layouts[i]) return
        if (!layouts[0].slides[i]) return

        let id = uid()
        layouts[0].slides[i].background = id
        media[id] = background
    })

    return { slides, layouts, media }
}

function getSlideItems(slide: any): any[] {
    let elements: any = null
    if (slide.displayElements) elements = slide.displayElements
    else elements = slide.array.find((a) => a["@rvXMLIvarName"] === "displayElements")
    if (!elements) return []

    if (!elements.RVTextElement) {
        return []
    }

    let items: any[] = []

    // TODO: get active show template style
    let itemStyle = "left:50px;top:120px;width:1820px;height:840px;"

    let itemStrings = elements.RVTextElement.NSString
    if (!itemStrings) itemStrings = [elements.RVTextElement["@RTFData"]]
    else if (itemStrings["#text"]) itemStrings = [itemStrings]
    itemStrings.forEach((content: any) => {
        let text = decodeBase64(content["#text"] || content)

        if (content["@rvXMLIvarName"] && content["@rvXMLIvarName"] !== "RTFData") return
        // text = convertFromRTFToPlain(text)
        text = decodeHex(text)

        items.push({ style: itemStyle, lines: splitTextToLines(text) })
    })

    return items
}

function makeParentSlide(slide, { label, color = "" }) {
    slide.group = label
    if (color) slide.color = rgbStringToHex(color)

    // set global group
    if (label.toLowerCase() === "group") label = "verse"
    let globalGroup = getGlobalGroup(label)
    // if (globalGroup && !label)
    slide.globalGroup = globalGroup || "verse"

    return slide
}

function arrangeLayouts(arrangements, sequences) {
    let layouts: Layout[] = []
    arrangements.forEach((arrangement) => {
        let groupIds = arrangement.array?.NSString || []
        if (!Array.isArray(groupIds)) groupIds = [groupIds]
        if (!groupIds.length) return

        let slides: any[] = groupIds.map((groupID) => ({ id: sequences[groupID] }))
        layouts.push({ id: arrangement["@uuid"], name: arrangement["@name"], notes: "", slides })
    })

    return layouts
}

/////

function splitTextToLines(text: string) {
    let lines: any[] = []
    let data = text.split("\n\n")
    lines = data.map((text: any) => ({ align: "", text: [{ style: "", value: text }] }))

    return lines
}

function decodeBase64(text: string) {
    let b = 0,
        l = 0,
        r = ""
    let m = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

    text.split("").forEach(function (v) {
        b = (b << 6) + m.indexOf(v)
        l += 6
        if (l >= 8) r += String.fromCharCode((b >>> (l -= 8)) & 0xff)
    })

    return r
}

function decodeHex(input: string) {
    let textStart = input.indexOf("\\cf2\\ltrch")
    // remove RTF before text
    if (textStart > -1) {
        input = input.slice(input.indexOf(" ", textStart), input.length)
    } else {
        // remove main RTF styles
        let paragraphs: string[] = input.split("\n\n")
        if (paragraphs[0].includes("rtf")) {
            paragraphs = paragraphs.slice(1, paragraphs.length)
            input = paragraphs.join("\n\n")
            input = input.slice(0, input.length - 1)
        }
    }

    input = input.replaceAll("\\\n", "<br>")
    var hex = input.split("\\'")
    var str = ""
    hex.map((txt, i) => {
        let styles: any[] = []
        let styleIndex = txt.indexOf("\\")

        while (styleIndex >= 0) {
            let nextSpace = txt.indexOf(" ", styleIndex)
            if (nextSpace < 1) nextSpace = txt.length
            styles.push(txt.slice(styleIndex, nextSpace).trim())
            txt = txt.slice(0, styleIndex) + txt.slice(nextSpace, txt.length)
            styleIndex = txt.indexOf("\\")
        }

        if (i === 0) str = txt
        else {
            str += String.fromCharCode(parseInt(txt.slice(0, 2), 16))
            str += txt.slice(2, txt.length)
        }
    })

    // remove any {{ at the start
    if (str.indexOf("{{") > -1 && str.indexOf("{{") < 3) str = str.slice(str.indexOf("{{") + 2, str.length)
    // remove any } and special chars at the end
    if (str.length - str.indexOf("}") < 3) str = str.slice(0, str.indexOf("}"))
    // remove whitespace at start and end
    str = str.trim()
    // remove breaks at start
    while (str.indexOf("<br>") === 0) str = str.slice(4, str.length)
    return str
}

function rgbStringToHex(rgbaString: string) {
    let [r, g, b, a]: any = rgbaString.split(" ")
    // TODO: alpha
    if (isNaN(r) || isNaN(g) || isNaN(b)) console.warn(r, g, b, a)

    return `#${toHex(r * 255)}${toHex(g * 255)}${toHex(b * 255)}`
}
const toHex = (c: number) => ("0" + Number(c.toFixed()).toString(16)).slice(-2)
