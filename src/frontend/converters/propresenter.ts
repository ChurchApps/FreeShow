import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Layout, Slide, SlideData } from "../../types/Show"
import { getExtension, getFileName, getMediaType } from "../components/helpers/media"
import { checkName, getGlobalGroup, initializeMetadata, newSlide } from "../components/helpers/show"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, dictionary, groups, shows } from "./../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { xml2json } from "./xml"

const itemStyle = "left:50px;top:120px;width:1820px;height:840px;"

export function convertProPresenter(data: any) {
    alertMessage.set("popup.importing")
    activePopup.set("alert")

    let categoryId = createCategory("ProPresenter")

    let tempShows: any[] = []

    setTimeout(() => {
        data?.forEach(({ content, name, extension }: any) => {
            let song: any = {}

            if (!content) {
                console.log("File missing content!")
                return
            }

            if (extension === "json" || extension === "pro") {
                try {
                    song = JSON.parse(content)
                } catch (err) {
                    console.error(err)
                }
            } else {
                song = xml2json(content)?.RVPresentationDocument
            }

            if (!song) return

            let layoutID = uid()
            let show = new ShowObj(false, categoryId, layoutID)
            let showId = song["@uuid"] || song.uuid?.string || uid()
            show.name = checkName(song.name === "Untitled" ? name : song.name || name, showId)

            // propresenter often uses the same id for duplicated songs
            let existingShow = get(shows)[showId] || tempShows.find((a) => a.id === showId)?.show
            if (existingShow && existingShow.name !== (song.name || name)) showId = uid()

            let converted: any = {}

            if (extension === "json") {
                converted = convertJSONToSlides(song)
            } else if (extension === "pro") {
                converted = convertProToSlides(song)
            } else {
                converted = convertToSlides(song, extension)
            }

            let { slides, layouts, media }: any = converted

            show.slides = slides
            show.layouts = {}
            show.media = media

            show.meta = initializeMetadata({
                title: song["@CCLISongTitle"] || song.ccli?.songTitle,
                artist: song["@CCLIArtistCredits"],
                author: song["@CCLIAuthor"] || song.ccli?.author,
                publisher: song["@CCLIPublisher"] || song.ccli?.publisher,
                CCLI: song["@CCLISongNumber"] || song.ccli?.songNumber,
                year: song["@CCLICopyrightYear"] || song.ccli?.copyrightYear,
            })

            layouts.forEach((layout: any, i: number) => {
                show.layouts[i === 0 ? layoutID : layout.id] = {
                    name: layout.name || get(dictionary).example?.default || "",
                    notes: i === 0 ? song["@notes"] || "" : "",
                    slides: layout.slides,
                }
            })

            tempShows.push({ id: showId, show })
        })

        setTempShows(tempShows)
    }, 10)
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
                style: itemStyle,
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

    // console.log(song)

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

        let slideIndex: number = -1
        groupSlides.forEach((slide) => {
            let items: Item[] = getSlideItems(slide)
            if (!items?.length) return
            slideIndex++

            let slideIsDisabled = slide["@enabled"] === "false"
            let slideId: string = uid()

            slides[slideId] = newSlide({ notes: slide["@notes"] || "", items })

            // media
            let media = slide.RVMediaCue

            // TODO: images
            let path: string = media?.RVVideoElement?.["@source"] || ""
            if (path) backgrounds[slideIndex] = { path, name: media["@displayName"] || "" }

            let isFirstSlide: boolean = slideIndex === 0
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
    if (!slide) return []

    let elements: any = null
    if (slide.displayElements) elements = slide.displayElements
    else elements = slide.array.find((a) => a["@rvXMLIvarName"] === "displayElements")
    if (!elements) return []

    if (!elements.RVTextElement) {
        return []
    }

    let items: any[] = []

    let textElement = elements.RVTextElement
    let itemStrings = elements.RVTextElement.NSString
    if (!itemStrings && Array.isArray(textElement)) itemStrings = textElement.map((a) => a.NSString)
    if (!itemStrings) itemStrings = [elements.RVTextElement["@RTFData"]]
    else if (itemStrings["#text"]) itemStrings = [itemStrings]

    itemStrings.forEach((content: any) => {
        if (!content) return
        let text = decodeBase64(content["#text"] || content)
        // console.log(text)

        if (content["@rvXMLIvarName"] && content["@rvXMLIvarName"] !== "RTFData") return
        // text = convertFromRTFToPlain(text)
        text = decodeHex(text)
        // console.log(text)

        if (text === "Double-click to edit") text = ""
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

    // WIP better convertion ?
    // including GB2312 decode

    // https://www.oreilly.com/library/view/rtf-pocket-guide/9781449302047/ch04.html
    r = r.replaceAll("\\u8217 ?", "'")

    // should be converted, but don't know proper length then
    // r = r.replaceAll("\'", "\\u")

    r = r.replaceAll("\\'92", "'")
    r = r.replaceAll("\\'96", "–")
    // convert ‘ & ’ to '
    r = r.replaceAll("‘", "'").replaceAll("’", "'")

    r = r.replaceAll("\\'e6", "æ")
    r = r.replaceAll("\\'f8", "ø")
    r = r.replaceAll("\\'e5", "å")
    r = r.replaceAll("\\'c6", "Æ")
    r = r.replaceAll("\\'d8", "Ø")
    r = r.replaceAll("\\'c5", "Å")

    r = r.replaceAll("\\'f6", "ö")
    r = r.replaceAll("\\'e4", "ä")
    r = r.replaceAll("\\'d6", "Ö")
    r = r.replaceAll("\\'c4", "Ä")

    r = r.replaceAll("\\'89", "ä") // ‰
    r = r.replaceAll("\\'88", "ö") // ∘
    r = r.replaceAll("\\'c2", "å") // Â
    r = r.replaceAll("\\'a5", "ra") // ¥

    // decode encoded unicode dec letters
    // https://unicodelookup.com/
    let decCode = r.indexOf("\\u")
    while (decCode > -1) {
        let endOfCode = r.indexOf(" ?", decCode) + 2

        if (endOfCode > 1 && endOfCode - decCode <= 10) {
            let decodedLetter = String.fromCharCode(Number(r.slice(decCode, endOfCode).replace(/[^\d-]/g, "")))
            if (!decodedLetter.includes("\\x")) r = r.slice(0, decCode) + decodedLetter + r.slice(endOfCode)
        }

        decCode = r.indexOf("\\u", decCode + 1)
    }

    return r
}

function RTFToText(input: string) {
    input = input.slice(0, input.lastIndexOf("}"))
    input = input.replaceAll("\\pard", "\\remove")
    input = input.replaceAll("\\part", "\\remove")
    input = input.replaceAll("\\par", "__BREAK__")
    input = input.replaceAll("\\\n", "__BREAK__")
    input = input.replaceAll("\n", "__BREAK__")
    input = input.replaceAll("\\u8232", "__BREAK__")

    // https://stackoverflow.com/a/188877
    const regex = /\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/gm
    let newInput = input.replace(regex, "").replaceAll("\\*", "")

    // some files have {} wapped around the text, so it gets removed
    if (!newInput.replaceAll("__BREAK__", "").trim().length) {
        input = input.replaceAll("}", "").replaceAll("{", "")
        newInput = input.replace(regex, "").replaceAll("\\*", "")

        let formatting = newInput.lastIndexOf(";;;;")
        if (formatting >= 0) newInput = newInput.slice(formatting + 4)

        newInput = newInput.replaceAll(";;", "")
    }

    let splitted = newInput.split("__BREAK__").filter((a) => a)
    return splitted.join("\n").trim()
}

function decodeHex(input: string) {
    let textStart = input.indexOf("\\ltrch")
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
    let hex = input.split("\\'")
    let str = ""
    hex.map((txt, i) => {
        let styles: any[] = []

        // fix skipping first word sometimes
        txt = txt.replaceAll("\r\n", "")
        let breakPos = txt.indexOf("\n")
        let lineFormattingPos = txt.indexOf("\\f0")
        if (breakPos >= 0 && lineFormattingPos >= 0 && lineFormattingPos < breakPos) txt = txt.slice(breakPos, txt.length)

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

    // fix line formatting
    str = str.replaceAll("}{", "<br>").replaceAll("} {", "<br>").replaceAll("}  {", "<br>").replaceAll("{ }", "")
    // remove any {{ at the start
    if (str.indexOf("{{") > -1 && str.indexOf("{{") < 3) str = str.slice(str.indexOf("{{") + 2, str.length)
    // remove whitespace at start and end
    str = str.trim()
    // remove any } and special chars at the end
    if (str.length - str.lastIndexOf("}") < 3) str = str.slice(0, str.lastIndexOf("}"))
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

///// PRO 7 /////

function convertProToSlides(song: any) {
    let slides: any = {}
    let media: any = {}
    let layouts: any = []

    // console.log(song)

    let tempLayouts: any = {}
    const tempArrangements: any[] = getArrangements(song.arrangements)
    const tempGroups: any[] = getGroups(song.cueGroups)
    const tempSlides: any[] = getSlides(song.cues)
    // console.log(tempArrangements, tempGroups, tempSlides)

    if (!tempArrangements?.length) {
        tempArrangements.push({ groups: Object.keys(tempGroups), name: "" })
    }

    let slidesWithoutGroup = Object.keys(tempSlides).filter((id) => !Object.values(tempGroups).find((a) => a.slides.includes(id)))
    if (slidesWithoutGroup.length) slidesWithoutGroup.forEach((id) => createSlide(id))

    tempArrangements.forEach(createLayout)
    function createLayout({ name = "", groups }: any) {
        layouts.push({ id: uid(), name, notes: "", slides: createSlides(groups) })
    }

    function createSlides(groups: string[]) {
        let layoutSlides: any[] = []

        groups.forEach((groupId) => {
            let group = tempGroups[groupId]

            let allSlides = group.slides.map((id, i) => createSlide(id, i === 0, { color: group.color, name: group.name }))
            if (allSlides.length > 1) {
                let children = allSlides.slice(1).map(({ id }) => id)
                slides[allSlides[0].id].children = children
            }

            layoutSlides.push(allSlides[0])
        })

        return layoutSlides
    }

    function createSlide(id: string, isParent: boolean = true, { color, name }: any = {}) {
        if (tempLayouts[id]) return tempLayouts[id]

        let slideId = uid()
        let layoutSlide: SlideData = { id: slideId }

        let tempSlide = tempSlides[id]

        if (tempSlide.disabled) layoutSlide.disabled = true

        if (tempSlide.media) {
            let mediaId = uid()
            let path = tempSlide.media
            media[mediaId] = { name: getFileName(path), path, type: getMediaType(getExtension(path)) }
            layoutSlide.background = mediaId
        }

        let slide: Slide = {
            group: null,
            color: null,
            settings: {
                background: tempSlide.backgroundColor,
                resolution: tempSlide.size,
            },
            notes: "",
            items: tempSlide.items.map(convertItem),
        }

        if (isParent) {
            let group = name || tempSlide.name || ""
            let globalGroup = getGlobalGroup(group)
            slide.color = color || ""
            slide.group = group || ""
            if (globalGroup) slide.globalGroup = globalGroup
        }

        slides[slideId] = slide
        tempLayouts[id] = layoutSlide
        return layoutSlide
    }

    return { slides, layouts, media }
}

function convertItem(item: any) {
    let text = item.text
    let style = itemStyle
    if (item.bounds) {
        let pos = item.bounds.origin
        let size = item.bounds.size
        if (Object.keys(pos).length === 2 && Object.keys(size).length === 2) {
            style = `left:${pos.x}px;top:${pos.y}px;width:${size.width}px;height:${size.height}px;`
        }
    }

    let newItem: Item = {
        style,
        lines: text.split("\n").map(getLine),
    }

    return newItem

    function getLine(text: string) {
        return { align: "", text: [{ value: text, style: "" }] }
    }
}

function getArrangements(arrangements: any) {
    if (!arrangements) return []

    let newArrangements: any = []
    arrangements.forEach((a) => {
        newArrangements.push({
            name: a.name,
            groups: a.groupIdentifiers.map((a) => a.string),
        })
    })

    return newArrangements
}

function getGroups(groups) {
    if (!groups) return {}

    let newGroups: any = {}
    groups.forEach(({ group, cueIdentifiers }) => {
        newGroups[group.uuid.string] = {
            name: group.name,
            color: getColorValue(group.color),
            slides: cueIdentifiers.map((a) => a.string),
        }
    })

    return newGroups
}

function getSlides(cues: any) {
    let slides: any = {}

    cues.forEach((slide) => {
        let baseSlide = slide.actions.find((a) => a.slide?.presentation)?.slide?.presentation?.baseSlide || {}
        if (!baseSlide) return

        slides[slide.uuid.string] = {
            name: slide.name,
            disabled: !slide.isEnabled,
            media: slide.actions.find((a) => a.media?.element)?.media?.element?.url?.absoluteString,
            backgroundColor: getColorValue(baseSlide.backgroundColor),
            size: baseSlide.size,
            items: baseSlide.elements?.map(getItem) || [],
        }
    })

    return slides
}

function getItem(item: any) {
    let newItem: any = {}

    newItem.bounds = item.element.bounds
    newItem.text = decodeRTF(item.element.text.rtfData)

    return newItem
}

function decodeRTF(text: string) {
    text = decodeBase64(text)
    // console.log(text)
    text = RTFToText(text)
    // console.log(text)
    return text
}

function getColorValue(color: any) {
    if (!color) return ""

    color = {
        red: color.red || 0,
        green: color.green || 0,
        blue: color.blue || 0,
        alpha: color.alpha || 1,
    }

    return "rgb(" + [color.red.toFixed(2), color.green.toFixed(2), color.blue.toFixed(2)].join(" ") + " / " + color.alpha.toFixed(1) + ")"
}
