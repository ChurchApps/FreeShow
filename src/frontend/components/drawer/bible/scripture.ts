import { get } from "svelte/store"
import type { StringObject } from "../../../../types/Main"
import { dataPath, scriptureSettings, scriptures, scripturesCache, templates } from "../../../stores"
import { getKey } from "../../../values/keys"
import { clone, removeDuplicates } from "../../helpers/array"
import { sendMain } from "../../../IPC/main"
import { Main } from "../../../../types/IPC/Main"

const api = "https://contentapi.churchapps.org/bibles/"
const tempCache: any = {}
const fetchTimeout: any = {}
export let isFallback = false
export async function fetchBible(load: string, active: string, ref: any = { versesList: [], bookId: "GEN", chapterId: "GEN.1" }) {
    let versesId: any = null
    if (ref.versesList.length) {
        versesId = ref.versesList[0].keyName + "-" + ref.versesList[ref.versesList.length - 1].keyName
        versesId = versesId.split("-")
        versesId = versesId[0] + "-" + versesId[versesId.length - 1]
    }

    const urls: StringObject = {
        books: `${api}${active}/books`,
        chapters: `${api}${active}/${ref.bookId}/chapters`,
        verses: `${api}${active}/chapters/${ref.chapterId}/verses`,
        versesText: `${api}${active}/verses/${versesId}`,
    }

    if (fetchTimeout[active]) clearTimeout(fetchTimeout[active])
    if (tempCache[urls[load]]) return tempCache[urls[load]]

    return new Promise((resolve, reject) => {
        const KEY = getKey("bibleapi" + (isFallback ? "_fallback" : ""))
        if (!KEY) return reject("No API key!")
        if (urls[load].includes("null")) return reject("Something went wrong!")

        fetchTimeout[active] = setTimeout(() => {
            // WIP display error messages...
            reject("Timed out!")
        }, 40000)

        fetch(urls[load], { headers: { "api-key": KEY } })
            .then((response) => {
                // fallback key
                if (response.status >= 400) {
                    isFallback = true
                    console.error("Could not fetch, trying fallback key")
                    fetch(urls[load], { headers: { "api-key": getKey("bibleapi_fallback") } })
                        .then((response1) => response1.json())
                        .then(manageResult)
                        .catch((e) => {
                            clearTimeout(fetchTimeout[active])
                            reject(e)
                        })
                    return
                }

                return response.json()
            })
            .then(manageResult)
            .catch((e) => {
                clearTimeout(fetchTimeout[active])
                reject(e)
            })

        function manageResult(data) {
            if (!data) return

            tempCache[urls[load]] = data
            clearTimeout(fetchTimeout[active])
            resolve(data)
        }
    })
}

export function searchBibleAPI(active: string, searchQuery: string) {
    const url = `${api}${active}/search?query=${searchQuery}`

    return new Promise((resolve, reject) => {
        fetch(url)
            .then((response) => {
                // fallback key
                if (response.status >= 400) {
                    console.error("Could not fetch, trying fallback key")
                    fetch(url, { headers: { "api-key": getKey("bibleapi_fallback") } })
                        .then((response1) => response1.json())
                        .then((data) => resolve(data.data))
                        .catch((e) => {
                            reject(e)
                        })
                    return
                }

                return response.json()
            })
            .then((data) => {
                if (data) resolve(data.data)
            })
            .catch((e) => {
                reject(e)
            })
    })
}

export function loadBible(active: string, index = 0, bible: any) {
    Object.entries(get(scriptures)).forEach(([id, scripture]: any) => {
        if (!scripture || (scripture.id !== active && id !== active)) return

        const customName = get(scriptures)[id]?.customName || scripture.name || get(scriptures)[id]?.name
        const isAPI = scripture.api

        if (isAPI) {
            bible.api = true
            bible.version = customName
            bible.copyright = scripture.copyright
            bible.attributionRequired = scripture.attributionRequired || false
            bible.attributionString = scripture.attributionString || ""
            return
        }
        delete bible.api

        if (get(scripturesCache)[id]) {
            bible.version = customName
            bible.metadata = get(scripturesCache)[id].metadata || {}
            bible.copyright = get(scripturesCache)[id].copyright
            bible.id = id
            return
        }

        sendMain(Main.BIBLE, { name: scripture.name, id: scripture.id || id, data: { index }, path: get(dataPath) })
    })

    return bible
}

export function receiveBibleContent(data: any) {
    if (data.error === "not_found" || !data.content?.[1]) return

    const content = data.content[1] || {}
    scripturesCache.update((a) => {
        a[data.content[0]] = content
        return a
    })

    const bible: any = content
    const id = data.content[0] || data.id

    bible.version = get(scriptures)[id]?.customName || content.name || get(scriptures)[id]?.name || ""
    bible.metadata = content.metadata || {}
    if (content.copyright) bible.copyright = content.copyright
    bible.id = id

    return bible
}

export function joinRange(array: string[]) {
    let prev = -1
    let range = ""

    array.forEach((a: string, i: number) => {
        const splitted = a.toString().split("_")
        const id = splitted[0]
        const subverse = Number(splitted[1] || 0)
        const v = id + (subverse ? getVersePartLetter(subverse) : "")

        if (Number(id) - 1 === prev) {
            if (i + 1 === array.length) range += "-" + v
        } else {
            if (range.length) {
                if (prev !== Number(range[range.length - 1])) range += "-" + prev
                range += "+"
            }
            range += v
        }

        prev = Number(id)
    })

    return range
}

export function getSplittedVerses(verses: { [key: string]: string }) {
    if (!get(scriptureSettings).splitLongVerses) return verses || {}

    const chars = Number(get(scriptureSettings).longVersesChars || 100)
    const newVerses: { [key: string | number]: string } = {}
    Object.keys(verses || {}).forEach((verseKey) => {
        const verse = verses[verseKey]
        const newVerseStrings = splitText(verse, chars)

        for (let i = 0; i < newVerseStrings.length; i++) {
            const key = newVerseStrings.length === 1 ? "" : `_${i + 1}`
            newVerses[verseKey + key] = newVerseStrings[i]
        }
    })

    return newVerses
}

export function splitText(value: string, maxLength: number) {
    const splitted: string[] = []

    // for (let i = 0; i < value.length; i += maxLength) {
    //     let string = value.substring(i, i + maxLength)
    //     // merge short strings
    //     if (string.length < 10) splitted[splitted.length - 1] += string
    //     else splitted.push(string)
    // }

    let start = 0
    while (start < value.length) {
        // find the next possible break point
        let end = start + maxLength
        if (end < value.length) {
            const spaceIndex = value.lastIndexOf(" ", end)
            if (spaceIndex > start) {
                end = spaceIndex // adjust to the last space within range
            }
        }

        const trimmedValue = value.substring(start, end).trim()
        splitted.push(trimmedValue)

        start = end + 1
    }

    // merge short strings
    if (splitted.length > 1 && splitted[splitted.length - 1].length < 20) {
        splitted[splitted.length - 2] += " " + splitted.pop()
    }

    return splitted
}

export function getVersePartLetter(subverse: number) {
    return (Number(subverse) + 9).toString(36)
}

export const textKeys = {
    showVersion: "[version]",
    showVerse: "[reference]",
}
export function getSlides({ bibles, sorted }, onlyOne = false, disableReference = false) {
    const slides: any[][] = [[]]

    const template = clone(get(templates)[get(scriptureSettings).template]?.items || [])
    const templateTextItems = template.filter((a) => a.lines)
    const templateOtherItems = template.filter((a) => !a.lines && a.type !== "text")

    const combineWithText = templateTextItems.length <= 1 || get(scriptureSettings).combineWithText

    bibles.forEach((bible, bibleIndex) => {
        const currentTemplate = templateTextItems[bibleIndex] || templateTextItems[0]
        const itemStyle = currentTemplate?.style || "top: 150px;inset-inline-start: 50px;width: 1820px;height: 780px;"
        const itemAlignStyle = currentTemplate?.align || ""
        const alignStyle = currentTemplate?.lines?.[1]?.align || currentTemplate?.lines?.[0]?.align || "text-align: start;"
        const textStyle = currentTemplate?.lines?.[1]?.text?.[0]?.style || currentTemplate?.lines?.[0]?.text?.[0]?.style || "font-size: 80px;"

        const emptyItem = { align: itemAlignStyle, lines: [{ text: [], align: alignStyle }], style: itemStyle, specialStyle: currentTemplate?.specialStyle || {}, actions: currentTemplate?.actions || {} } // scrolling, bindings

        let slideIndex = 0
        slides[slideIndex].push(clone(emptyItem))

        const verses = getSplittedVerses(bible.verses)

        let verseLine = 0
        sorted.forEach((s: any, rangeIndex: number) => {
            const slideArr: any = slides[slideIndex][bibleIndex]
            if (!slideArr?.lines[0]?.text) return

            let text: string = verses[s] || bible.verses[s] || ""
            if (!text) return

            let lineIndex = 0
            // verses on individual lines
            if (get(scriptureSettings).versesOnIndividualLines) {
                lineIndex = verseLine
                verseLine++
                if (!slideArr.lines![lineIndex]) slideArr.lines![lineIndex] = { text: [], align: alignStyle }
            }

            // verse number
            if (get(scriptureSettings).verseNumbers) {
                let size = get(scriptureSettings).numberSize || 50
                if (rangeIndex === 0) size *= 1.2
                const verseNumberStyle = `${textStyle};font-size: ${size}px;color: ${get(scriptureSettings).numberColor || "#919191"};text-shadow: none;`

                const splitted = s.toString().split("_")
                const id = splitted[0]
                const subverse = Number(splitted[1] || 0)
                const value = id + (subverse ? getVersePartLetter(subverse) : "") + " "

                slideArr.lines![lineIndex].text.push({
                    value,
                    style: verseNumberStyle,
                    customType: "disableTemplate", // dont let template style verse numbers
                })
            }

            // custom Jesus red to JSON format: !{}!
            text = text.replace(/<span class="wj" ?>(.*?)<\/span>/g, "!{$1}!")
            text = text.replace(/<red ?>(.*?)<\/red>/g, "!{$1}!")

            // highlight Jesus text
            const textArray: any[] = []
            if (get(scriptureSettings).redJesus) {
                const jesusWords: any[] = []
                let jesusStart = text.indexOf("!{")

                while (jesusStart > -1) {
                    let jesusEnd = 0

                    const splitted = text.split("")
                    splitted.find((letter, i) => {
                        if (i < jesusStart + 1 || jesusEnd) return false

                        if (letter === "}" && splitted[i + 1] === "!") {
                            jesusEnd = i + 2
                            return true
                        }

                        return false
                    })

                    if (jesusEnd) {
                        jesusWords.push([jesusStart, jesusEnd])
                        jesusStart = text.indexOf("!{", jesusEnd)
                    } else {
                        jesusWords.push([jesusStart, text.length])
                        jesusStart = -1
                    }
                }

                if (!jesusWords[0]) {
                    textArray.push({ value: removeTags(formatBibleText(text)), style: textStyle })
                } else if (jesusWords[0]?.[0] > 0) {
                    textArray.push({ value: removeTags(formatBibleText(text.slice(0, jesusWords[0][0]))), style: textStyle })
                }

                const redText = `color: ${get(scriptureSettings).jesusColor || "#FF4136"};`
                jesusWords.forEach(([start, end], i) => {
                    textArray.push({ value: removeTags(formatBibleText(text.slice(start + 2, end - 2))), style: textStyle + redText, customType: "disableTemplate_jw" })

                    if (!jesusWords[i + 1] || end < jesusWords[i + 1][0]) {
                        const remainingText = removeTags(formatBibleText(text.slice(end, jesusWords[i + 1]?.[0] ?? -1)))
                        if (remainingText.length) textArray.push({ value: remainingText, style: textStyle })
                    }
                })
            } else {
                // allow bibles with custom html tags
                // text = removeTags(formatBibleText(text))
                text = formatBibleText(text)

                if (text.charAt(text.length - 1) !== " ") text += " "

                textArray.push({ value: text, style: textStyle })
            }

            slideArr.lines![lineIndex].text.push(...textArray)

            // if (bibleIndex + 1 < bibles.length) return
            if (onlyOne || (rangeIndex + 1) % get(scriptureSettings).versesPerSlide > 0) return

            if (!disableReference && bibleIndex + 1 >= bibles.length) {
                let range: any[] = onlyOne ? sorted : sorted.slice(rangeIndex - get(scriptureSettings).versesPerSlide + 1, rangeIndex + 1)
                if (get(scriptureSettings).splitReference === false || get(scriptureSettings).firstSlideReference) range = sorted
                let indexes = [bibles.length]
                if (combineWithText) indexes = [...Array(bibles.length)].map((_, i) => i)
                indexes.forEach((i) => addMeta(clone(get(scriptureSettings)), joinRange(range), { slideIndex, itemIndex: i }))
            }

            if (rangeIndex + 1 >= sorted.length) return

            slideIndex++
            verseLine = 0
            if (!slides[slideIndex]) slides.push([clone(emptyItem)])
            else slides[slideIndex].push(clone(emptyItem))
        })

        // add remaining
        if (!disableReference && bibleIndex + 1 >= bibles.length) {
            const remainder = onlyOne ? sorted.length : sorted.length % get(scriptureSettings).versesPerSlide
            let range: any[] = sorted.slice(sorted.length - remainder, sorted.length)
            if (get(scriptureSettings).splitReference === false || get(scriptureSettings).firstSlideReference) range = sorted
            let indexes = [bibles.length]
            if (combineWithText) indexes = [...Array(bibles.length)].map((_, i) => i)
            if (remainder) indexes.forEach((i) => addMeta(clone(get(scriptureSettings)), joinRange(range), { slideIndex, itemIndex: i }))
        }

        // auto size
        slides.forEach((slide, i) => {
            slide.forEach((_item, j) => {
                if (!templateTextItems[j]?.auto || !slides[i][j].lines?.[0]?.text) return

                // WIP historyActions - TEMPLATE...
                slides[i][j].auto = true
                if (templateTextItems[j]?.textFit) slides[i][j].textFit = templateTextItems[j]?.textFit
                // slides[i][j].lines![0].text.forEach((_, k) => {
                //     if (slides[i][j].lines![0].text[k].customType === "disableTemplate") return
                //     // slides[i][j].lines![0].text[k].style += "font-size: " + autoSize + "px;"
                // })
            })
        })
    })

    // add other items
    slides.forEach((items, i) => {
        slides[i] = [...templateOtherItems, ...items]
        if (get(scriptureSettings).invertItems) slides[i].reverse()
    })

    return slides

    function addMeta({ showVersion, showVerse, customText }, range: string, { slideIndex, itemIndex }) {
        if (!bibles[0]) return

        const lines: any[] = []

        // WIP itemIndex is mostly correct if combineWithText

        // if (combineWithText) itemIndex = 0
        const metaTemplate = templateTextItems[itemIndex] || templateTextItems[0]
        const alignStyle = metaTemplate?.lines?.[0]?.align || ""
        const verseStyle = metaTemplate?.lines?.[0]?.text?.[0]?.style || "font-size: 50px;"
        // remove text in () on scripture names
        const bibleVersions = bibles.map((a) => (a?.version || "").replace(/\([^)]*\)/g, "").trim())
        const versions = combineWithText ? bibleVersions[itemIndex] : bibleVersions.join(" + ")
        const books = combineWithText ? bibles[itemIndex]?.book : removeDuplicates(bibles.map((a) => a.book)).join(" / ")

        // custom value (API)
        if (bibles.find((a) => a?.attributionRequired)) {
            showVersion = true
            if (!customText.includes(textKeys.showVersion)) customText += textKeys.showVersion
        }

        const referenceDivider = get(scriptureSettings).referenceDivider || ":"
        let text = customText
        if (!showVersion && !showVerse) return
        text = text.replaceAll(textKeys.showVersion, showVersion ? versions : "")
        text = text.replaceAll(textKeys.showVerse, showVerse ? books + " " + bibles[0].chapter + referenceDivider + range : "")

        text.split("\n").forEach((line) => {
            if (!line.trim()) return
            lines.push({ text: [{ value: line, style: verseStyle }], align: alignStyle })
        })

        if (lines.length) {
            // add reference to the main text if just one item or it's enabled!
            if (combineWithText) {
                if (!slides[slideIndex][itemIndex]) slides[slideIndex][itemIndex] = { lines: [] }
                if (get(scriptureSettings).referenceAtBottom) slides[slideIndex][itemIndex].lines.push(...lines)
                else slides[slideIndex][itemIndex].lines = [...lines, ...(slides[slideIndex][itemIndex].lines || [])]
            } else {
                slides[slideIndex].push({
                    lines,
                    style: metaTemplate?.style || "top: 910px;inset-inline-start: 50px;width: 1820px;height: 150px;opacity: 0.8;",
                    specialStyle: metaTemplate?.specialStyle || {},
                    actions: metaTemplate?.actions || {},
                })
            }
        }
    }
}

export function formatBibleText(text: string | undefined) {
    if (!text) return ""
    return stripMarkdown(text).replaceAll("/ ", " ").replaceAll("*", "")
}

function removeTags(text) {
    return text.replace(/(<([^>]+)>)/gi, "")
}

export function removeTagsAndContent(input) {
    const regex = /<[^>]*>[^<]*<\/[^>]*>/g
    return input.replace(regex, "")
}

function stripMarkdown(input: string) {
    input = input.replace(/#\s*(.*?)\s*#/g, "")
    input = input.replace(/\*\{(.*?)\}\*/g, "")
    input = input.replace(/!\{(.*?)\}!/g, "$1")
    // input = input.replace(/\[(.*?)\]/g, "[$1]")
    input = input.replace(/(\*\*|__)(.*?)\1/g, "$2")
    input = input.replace(/(\*|_)(.*?)\1/g, "$2")
    input = input.replace(/\+\+(.*?)\+\+/g, "$1")
    input = input.replace(/~~(.*?)~~/g, "$1")
    input = input.replace(/"([^"]*?)"/g, "$1")
    input = input.replace(/\n/g, "")
    input = input.replace(/¶/g, "")

    return input
}

// hard coded custom Bible data
const bibleData = {
    "eea18ccd2ca05dde-01": {
        nameLocal: "Bibel 2011 Bokmål", // med gammeltestamentlige apokryfer
    },
}
// ChurchAppsApiBible
export function customBibleData(data: any) {
    return { ...data, ...(bibleData[data.sourceKey] || {}) }
}

// HELPERS

export function setBooksCache(scriptureId: string, data: any) {
    scriptures.update((a) => {
        a[scriptureId].books2 = data
        a[scriptureId].cacheUpdate = new Date()
        return a
    })
}

export function getShortBibleName(name: string) {
    if (!name) return ""

    name = name
        .replace(/[^a-zA-Z ]+/g, "")
        .trim()
        .replaceAll("  ", " ")

    if (name.split(" ").length < 2) name = name.slice(0, 3)
    else name = name.split(" ").reduce((current, word) => (current += word[0]), "")

    return name || "B"
}

// this is used to reset the API bookId in collections with other bibles
export const bookIds: string[] = [
    "GEN",
    "EXO",
    "LEV",
    "NUM",
    "DEU",
    "JOS",
    "JDG",
    "RUT",
    "1SA",
    "2SA",
    "1KI",
    "2KI",
    "1CH",
    "2CH",
    "EZR",
    "NEH",
    "EST",
    "JOB",
    "PSA",
    "PRO",
    "ECC",
    "SNG",
    "ISA",
    "JER",
    "LAM",
    "EZK",
    "DAN",
    "HOS",
    "JOL",
    "AMO",
    "OBA",
    "JON",
    "MIC",
    "NAM",
    "HAB",
    "ZEP",
    "HAG",
    "ZEC",
    "MAL",
    "MAT",
    "MRK",
    "LUK",
    "JHN",
    "ACT",
    "ROM",
    "1CO",
    "2CO",
    "GAL",
    "EPH",
    "PHP",
    "COL",
    "1TH",
    "2TH",
    "1TI",
    "2TI",
    "TIT",
    "PHM",
    "HEB",
    "JAS",
    "1PE",
    "2PE",
    "1JN",
    "2JN",
    "3JN",
    "JUD",
    "REV",
]

const colorCodesFull = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8]
const colorCodesNT = [5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8]
const colors = ["", "#f17d46", "#ffd17c", "#8cdfff", "#8888ff", "#ff97f2", "#ffdce7", "#88ffa9", "#ffd3b6"]

export function getColorCode(books, bookId: number | string) {
    const bookIndex = typeof bookId === "number" ? bookId : books.findIndex((a) => a.id === bookId)

    if (books.length === colorCodesFull.length) return colors[colorCodesFull[bookIndex]]
    else if (books.length === colorCodesNT.length) return colors[colorCodesNT[bookIndex]]
    return ""
}
