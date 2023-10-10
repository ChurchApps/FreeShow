import { get } from "svelte/store"
import { BIBLE } from "../../../../types/Channels"
import type { StringObject } from "../../../../types/Main"
import { bibleApiKey, scripturePath, scriptureSettings, scriptures, scripturesCache, templates } from "../../../stores"
import { clone } from "../../helpers/array"
import { getAutoSize } from "../../edit/scripts/autoSize"

export async function fetchBible(load: string, active: string, ref: any = { versesList: [], bookId: "GEN", chapterId: "GEN.1" }) {
    const api = "https://api.scripture.api.bible/v1/bibles/"
    let versesId: any = null
    if (ref.versesList.length) {
        versesId = ref.versesList[0].id + "-" + ref.versesList[ref.versesList.length - 1].id
        versesId = versesId.split("-")
        versesId = versesId[0] + "-" + versesId[versesId.length - 1]
    }

    const urls: StringObject = {
        books: `${api}${active}/books`,
        chapters: `${api}${active}/books/${ref.bookId}/chapters`,
        verses: `${api}${active}/chapters/${ref.chapterId}/verses`,
        versesText: `${api}${active}/verses/${versesId}`,
    }

    return new Promise((resolve, reject) => {
        if (!get(bibleApiKey)) return reject("No API key!")
        if (urls[load].includes("null")) return reject("Something went wrong!")

        fetch(urls[load], { headers: { "api-key": get(bibleApiKey) } })
            .then((response) => response.json())
            .then((data) => {
                resolve(data.data)
            })
            .catch((e) => {
                reject(e)
            })
    })
}

export function loadBible(active: string, index: number = 0, bible: any) {
    Object.entries(get(scriptures)).forEach(([id, scripture]: any) => {
        if (!scripture || (scripture.id !== active && id !== active)) return

        let customName = get(scriptures)[id]?.customName || scripture.name || get(scriptures)[id]?.name
        let isAPI = scripture.api

        if (isAPI) {
            bible.api = true
            bible.version = customName
            return
        }
        delete bible.api

        if (get(scripturesCache)[id]) {
            bible.version = customName
            bible.copyright = get(scripturesCache)[id].copyright
            bible.id = id
            return
        }

        window.api.send(BIBLE, { name: scripture.name, id: scripture.id || id, data: { index }, path: get(scripturePath) })
    })

    return bible
}

export function joinRange(array: string[]) {
    let prev: number = -1
    let range: string = ""
    array.forEach((a: string, i: number) => {
        if (Number(a) - 1 === prev) {
            if (i + 1 === array.length) range += "-" + a
        } else {
            if (range.length) {
                if (prev !== Number(range[range.length - 1])) range += "-" + prev
                range += "+"
            }
            range += a
        }
        prev = Number(a)
    })
    return range
}

export const textKeys = {
    showVersion: "[version]",
    showVerse: "[reference]",
}
export function getSlides({ bibles, sorted }) {
    let slides: any[][] = [[]]

    let template = get(templates)[get(scriptureSettings).template]?.items || []
    let templateTextItems = template.filter((a) => a.lines)
    let templateOtherItems = template.filter((a) => !a.lines && a.type !== "text")

    bibles.forEach((bible, bibleIndex) => {
        let currentTemplate = templateTextItems[bibleIndex] || templateTextItems[0]
        let itemStyle = currentTemplate?.style || "top: 150px;left: 50px;width: 1820px;height: 780px;"
        let alignStyle = currentTemplate?.lines?.[0]?.align || "text-align: left;"
        let textStyle = currentTemplate?.lines?.[1]?.text?.[0]?.style || currentTemplate?.lines?.[0]?.text?.[0]?.style || "font-size: 80px;"

        let emptyItem = { lines: [{ text: [], align: alignStyle }], style: itemStyle, specialStyle: currentTemplate?.specialStyle || {} }

        let slideIndex: number = 0
        slides[slideIndex].push(clone(emptyItem))

        sorted.forEach((s: any, i: number) => {
            let slideArr: any = slides[slideIndex][bibleIndex]

            if (get(scriptureSettings).verseNumbers) {
                let size = 50
                if (i === 0) size *= 1.5
                let verseNumberStyle = textStyle + "font-size: " + size + "px;color: " + (get(scriptureSettings).numberColor || "#919191")

                slideArr.lines![0].text.push({
                    value: s + " ",
                    style: verseNumberStyle,
                })
            }

            let text: string = bible.verses[s] || ""
            // TODO: formatting (already function in Scripture.svelte)
            // if (redJesus) {
            //   text = text
            // } else
            text = text.replace(/(<([^>]+)>)/gi, "")
            if (text.charAt(text.length - 1) !== " ") text += " "

            slideArr.lines![0].text.push({ value: text, style: textStyle })

            // if (bibleIndex + 1 < bibles.length) return
            if ((i + 1) % get(scriptureSettings).versesPerSlide > 0) return

            if (bibleIndex + 1 >= bibles.length) {
                let range: any[] = sorted.slice(i - get(scriptureSettings).versesPerSlide + 1, i + 1)
                addMeta(get(scriptureSettings), joinRange(range), { slideIndex, itemIndex: bibles.length })
            }

            if (i + 1 >= sorted.length) return

            slideIndex++
            if (!slides[slideIndex]) slides.push([clone(emptyItem)])
            else slides[slideIndex].push(clone(emptyItem))
        })

        // auto size
        slides.forEach((slide, i) => {
            slide.forEach((item, j) => {
                if (!template[j]?.auto) return
                let autoSize: number = getAutoSize(item)
                // WIP historyActions - TEMPLATE...
                slides[i][j].auto = true
                slides[i][j].lines![0].text.forEach((_, k) => {
                    slides[i][j].lines![0].text[k].style += "font-size: " + autoSize + "px;"
                })
            })
        })

        if (bibleIndex + 1 < bibles.length) return
        let remainder = sorted.length % get(scriptureSettings).versesPerSlide
        let range: any[] = sorted.slice(sorted.length - remainder, sorted.length)
        if (remainder) addMeta(get(scriptureSettings), joinRange(range), { slideIndex, itemIndex: bibles.length })
    })

    // add other items
    slides.forEach((items, i) => {
        slides[i] = [...templateOtherItems, ...items]
    })

    return slides

    function addMeta({ showVersion, showVerse, customText }, range: string, { slideIndex, itemIndex }) {
        if (!bibles[0]) return

        let lines: any[] = []

        let metaTemplate = template[itemIndex] || template[0]
        let verseStyle = metaTemplate?.lines?.[0]?.text?.[0]?.style || "font-size: 50px;"
        let versions = bibles.map((a) => a.version).join(" + ")
        let books = [...new Set(bibles.map((a) => a.book))].join(" / ")

        let text = customText
        if (!showVersion && !showVerse) return
        if (showVersion) text = text.replaceAll(textKeys.showVersion, versions)
        if (showVerse) text = text.replaceAll(textKeys.showVerse, books + " " + bibles[0].chapter + ":" + range)

        text.split("\n").forEach((line) => {
            lines.push({ text: [{ value: line, style: verseStyle }], align: "" })
        })

        if (lines.length) {
            // add reference to the main text if just one item
            if (template.length <= 1) {
                // let firstLineStyle: string = metaTemplate?.lines?.[0]?.text?.[0]?.style || "font-size: 50px;"

                // let verseLines = slides[slideIndex][0].lines || []
                // console.log(verseLines)
                // verseLines.forEach((line, i) =>
                //     line.text?.forEach((_text, j) => {
                //         verseLines[i].text[j].style = firstLineStyle
                //     })
                // )

                slides[slideIndex][0].lines = [...lines, ...(slides[slideIndex][0].lines || [])]
            } else {
                slides[slideIndex].push({
                    lines,
                    style: metaTemplate?.style || "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
                })
            }
        }
    }
}
