import JsonBible from "json-bible"
import { ApiBible as JsonBibleApi } from "json-bible/lib/api"
import { get } from "svelte/store"
import { Main } from "../../../../types/IPC/Main"
import type { Item } from "../../../../types/Show"
import type { BibleCategories } from "../../../../types/Tabs"
import { requestMain } from "../../../IPC/main"
import { activeScripture, dataPath, drawerTabsData, media, notFound, outLocked, outputs, scriptureHistory, scriptures, scripturesCache, scriptureSettings, styles, templates } from "../../../stores"
import { getKey } from "../../../values/keys"
import { customActionActivation } from "../../actions/actions"
import { clone, removeDuplicates } from "../../helpers/array"
import { getMediaStyle } from "../../helpers/media"
import { getActiveOutputs, setOutput } from "../../helpers/output"
import { Book } from "json-bible/lib/Bible"

const SCRIPTURE_API_URL = "https://contentapi.churchapps.org/bibles"

export async function loadJsonBible(id: string) {
    const bibleCategory = get(scriptures)[id]
    const isApi = bibleCategory?.api

    if (isApi) {
        const key = getKey("bibleapi")
        const apiId = bibleCategory?.id || id
        return await JsonBibleApi(key, apiId, SCRIPTURE_API_URL)
    }

    const bibleContent = await loadBibleNew(id)
    if (!bibleContent) throw new Error("Local Bible not found")

    return await JsonBible(bibleContent)
}

export async function loadBibleNew(scriptureId: string) {
    if (!get(scriptures)[scriptureId]) scriptureId = Object.entries(get(scriptures)).find(([_id, a]) => a.id === scriptureId)?.[0] || ""

    const scriptureData = get(scriptures)[scriptureId]
    if (!scriptureData) return null

    const localBible = await getLocalBible(scriptureId, scriptureData)
    if (!localBible) return null

    const customName = scriptureData.customName || scriptureData.name
    const metadataLocal = localBible.metadata || {}
    if (localBible.copyright) metadataLocal.copyright = localBible.copyright

    return {
        ...localBible,
        api: false,
        version: customName,
        metadata: metadataLocal,
        id: scriptureId,
        books: (localBible.books || []).map(a => ({ ...a, name: a.customName || a.name }))
    }
}

async function getLocalBible(scriptureId: string, scriptureData: BibleCategories) {
    if (get(scripturesCache)[scriptureId]) return get(scripturesCache)[scriptureId]

    const localBible = await requestMain(Main.BIBLE, { name: scriptureData.name, id: scriptureData.id || scriptureId, data: { index: 0 }, path: get(dataPath) })
    const content = localBible.content?.[1] || null

    if (localBible.error === "not_found" || !content) {
        notFound.update((a) => {
            a.bible.push({ id: scriptureId })
            return a
        })
        return null
    }

    scripturesCache.update((a) => {
        a[scriptureId] = content
        return a
    })

    return content
}

// OUTPUT

type BibleContentType = {
    id: string
    version: string
    book: string
    bookId: string
    chapter: number
    verses: { [key: string]: string }
    activeVerses: number[]
    attributionString: string
    attributionRequired: boolean
}

export async function playScripture() {
    if (get(outLocked)) return

    const tabId = get(drawerTabsData).scripture?.activeSubTab || ""
    const selectedScriptureData = get(scriptures)[tabId]
    if (!selectedScriptureData) return

    const active = get(activeScripture).reference
    const selectedVerses = active?.verses?.map(Number).sort((a, b) => a - b) || []
    if (selectedVerses.length === 0) return

    // TODO: check api bibles
    // TODO: check collections + if deleting some collection bibles

    const currentScriptures = selectedScriptureData.collection?.versions || [tabId]
    const biblesContent = await Promise.all(currentScriptures.map(async id => {
        const BibleData = await loadJsonBible(id)
        const Book = await BibleData.getBook(active?.book)

        const scriptureData = get(scriptures)[id]
        const version = scriptureData?.customName || scriptureData?.name || ""
        const attributionString = scriptureData?.attributionString || ""
        const attributionRequired = !!scriptureData?.attributionRequired

        const bookName = Book.name
        const selectedChapter = Number(active?.chapters[0])
        const Chapter = await Book.getChapter(selectedChapter)

        // WIP custom verse number offset per scripture

        let versesText: { [key: string]: string } = {}
        selectedVerses.forEach(v => {
            versesText[v] = Chapter.getVerse(v).getText()
        })

        // const reference = Chapter.getVerse(selectedVerses[0]).getReference()

        return { id, version, book: bookName, bookId: active?.book || "", chapter: selectedChapter, verses: versesText, activeVerses: selectedVerses, attributionString, attributionRequired } as BibleContentType
    }))

    const slides = getScriptureSlides({ biblesContent, selectedVerses }, true)

    let splitted = selectedVerses[0].toString().split("_")
    const id = splitted[0]
    const subverse = Number(splitted[1] || 0)
    const value = id + (subverse ? getVersePartLetter(subverse) : "")

    // scripture usage history
    scriptureHistory.update((a) => {
        let newItem = {
            id: biblesContent[0].id,
            book: biblesContent[0].bookId,
            chapter: biblesContent[0].chapter,
            verse: selectedVerses[0],
            reference: `${biblesContent[0].book} ${biblesContent[0].chapter}:${value}`,
            text: getSplittedVerses(biblesContent[0].verses)[selectedVerses[0]] || biblesContent[0].verses[selectedVerses[0]] || ""
        }
        // WIP multiple verses, play from another version

        let existingIndex = a.findIndex((a) => JSON.stringify(a) === JSON.stringify(newItem))
        if (existingIndex > -1) a.splice(existingIndex, 1)
        a.push(newItem)

        return a
    })

    let outputIsScripture = get(outputs)[getActiveOutputs()[0]]?.out?.slide?.id === "temp"
    if (!outputIsScripture) customActionActivation("scripture_start")

    const attributionString = [...new Set(biblesContent.map((a) => a?.attributionString).filter(Boolean))].join(" / ")
    const includeCount = 3

    let tempItems: Item[] = slides[0] || []
    setOutput("slide", { id: "temp", tempItems, previousSlides: getPreviousSlides(), nextSlides: getNextSlides(), attributionString, translations: biblesContent.length })

    // const verseRange = joinRange(sorted)

    // TODO: track
    // let reference = `${biblesContent[0].book} ${biblesContent[0].chapter}:${verseRange}`
    // biblesContent.forEach((translation) => {
    //     let name = translation.version || ""
    //     let apiId = translation.api ? get(scriptures)[translation.id!]?.id || translation.id || "" : null
    //     if (name || apiId) trackScriptureUsage(name, apiId, reference)
    // })

    const templateId = get(scriptureSettings).template || "scripture" // $styles[styleId]?.templateScripture || ""
    const template = get(templates)[templateId] || {}
    const templateBackground = template.settings?.backgroundPath

    // play template background
    if (!templateBackground) return

    // get style (for media "fit")
    let currentOutput = get(outputs)[getActiveOutputs()[0]]
    let currentStyle = get(styles)[currentOutput?.style || ""] || {}

    let mediaStyle = getMediaStyle(get(media)[templateBackground], currentStyle)
    setOutput("background", { path: templateBackground, loop: true, muted: true, ...mediaStyle })

    ///

    function getPreviousSlides() {
        let lowestIndex = getVerseId(selectedVerses.sort((a, b) => getVerseId(a) - getVerseId(b))[0])

        let slides: any[] = []
        for (let i = 1; i <= includeCount; i++) {
            let verseIndex = lowestIndex - i
            slides.push(getScriptureSlides({ biblesContent, selectedVerses: [verseIndex] }, true, true)[0])
        }

        return slides
    }
    function getNextSlides() {
        let highestIndex = getVerseId(selectedVerses.sort((a, b) => getVerseId(b) - getVerseId(a))[0])

        let slides: any[] = []
        for (let i = 1; i <= includeCount; i++) {
            let verseIndex = highestIndex + i
            slides.push(getScriptureSlides({ biblesContent, selectedVerses: [verseIndex] }, true, true)[0])
        }

        return slides
    }
}

function getVerseId(verseRef: number | string) {
    return Number(verseRef.toString().split("_")[0])
}

export function getVersePartLetter(subverse: number) {
    return (Number(subverse) + 9).toString(36)
}
export const textKeys = {
    showVersion: "[version]",
    showVerse: "[reference]"
}

export function joinRange(array: (number | string)[]) {
    let prev = -1
    let range = ""

    // sort in correct order (should not be, but can be mixed up: ["10", "9", "8_b", 8, "8_a", "7"])
    array = array.sort((a, b) => {
        const sa = String(a)
        const sb = String(b)

        // Run match and safely handle null
        const matchA = sa.match(/^(\d+)(?:_(.+))?$/) || []
        const matchB = sb.match(/^(\d+)(?:_(.+))?$/) || []

        const numA = Number(matchA[1] || 0)
        const suffixA = matchA[2] || ""

        const numB = Number(matchB[1] || 0)
        const suffixB = matchB[2] || ""

        // Compare numeric part first
        if (numA !== numB) return numA - numB

        // Then compare suffixes alphabetically (empty suffix first)
        if (suffixA === "" && suffixB !== "") return -1
        if (suffixA !== "" && suffixB === "") return 1
        return suffixA.localeCompare(suffixB)
    })

    array.forEach((a, i) => {
        const splitted = a.toString().split("_")
        const id = splitted[0]
        const subverse = Number(splitted[1] || 0)
        const v = id + (subverse ? getVersePartLetter(subverse) : "")

        if (Number(id) === prev) return

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

export function getScriptureSlides({ biblesContent, selectedVerses }: { biblesContent: BibleContentType[], selectedVerses: number[] }, onlyOne = false, disableReference = false) {
    const slides: Item[][] = [[]]

    const template = clone(get(templates)[get(scriptureSettings).template]?.items || [])
    const templateTextItems = template.filter((a) => a.lines)
    const templateOtherItems = template.filter((a) => !a.lines && a.type !== "text")

    const combineWithText = templateTextItems.length <= 1 || get(scriptureSettings).combineWithText

    biblesContent.forEach((bible, bibleIndex) => {
        const currentTemplate = templateTextItems[bibleIndex] || templateTextItems[0]
        const itemStyle = currentTemplate?.style || "top: 150px;left: 50px;width: 1820px;height: 780px;"
        const itemAlignStyle = currentTemplate?.align || ""
        const alignStyle = currentTemplate?.lines?.[1]?.align || currentTemplate?.lines?.[0]?.align || "text-align: start;"
        const textStyle = currentTemplate?.lines?.[1]?.text?.[0]?.style || currentTemplate?.lines?.[0]?.text?.[0]?.style || "font-size: 80px;"

        const emptyItem = { align: itemAlignStyle, lines: [{ text: [], align: alignStyle }], style: itemStyle, specialStyle: currentTemplate?.specialStyle || {}, actions: currentTemplate?.actions || {} } // scrolling, bindings

        let slideIndex = 0
        slides[slideIndex].push(clone(emptyItem))

        const verses = getSplittedVerses(bible.verses)

        let verseLine = 0
        selectedVerses.forEach((s, rangeIndex) => {
            const slideArr = slides[slideIndex][bibleIndex]
            if (!slideArr?.lines?.[0]?.text) return

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
                    customType: "disableTemplate" // dont let template style verse numbers
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

            // if (bibleIndex + 1 < biblesContent.length) return
            if (onlyOne || (rangeIndex + 1) % get(scriptureSettings).versesPerSlide > 0) return

            if (!disableReference && bibleIndex + 1 >= biblesContent.length) {
                let range: any[] = onlyOne ? selectedVerses : selectedVerses.slice(rangeIndex - get(scriptureSettings).versesPerSlide + 1, rangeIndex + 1)
                if (get(scriptureSettings).splitReference === false || get(scriptureSettings).firstSlideReference) range = selectedVerses
                let indexes = [biblesContent.length]
                if (combineWithText) indexes = [...Array(biblesContent.length)].map((_, i) => i)
                indexes.forEach((i) => addMeta(clone(get(scriptureSettings)), joinRange(range), { slideIndex, itemIndex: i }))
            }

            if (rangeIndex + 1 >= selectedVerses.length) return

            slideIndex++
            verseLine = 0
            if (!slides[slideIndex]) slides.push([clone(emptyItem)])
            else slides[slideIndex].push(clone(emptyItem))
        })

        // add remaining
        if (!disableReference && bibleIndex + 1 >= biblesContent.length) {
            const remainder = onlyOne ? selectedVerses.length : selectedVerses.length % get(scriptureSettings).versesPerSlide
            let range: any[] = selectedVerses.slice(selectedVerses.length - remainder, selectedVerses.length)
            if (get(scriptureSettings).splitReference === false || get(scriptureSettings).firstSlideReference) range = selectedVerses
            let indexes = [biblesContent.length]
            if (combineWithText) indexes = [...Array(biblesContent.length)].map((_, i) => i)
            if (remainder) indexes.forEach((i) => addMeta(clone(get(scriptureSettings)), joinRange(range), { slideIndex, itemIndex: i }))
        }

        // auto size & item options
        slides.forEach((slide, i) => {
            slide.forEach((_item, j) => {
                // specific outputs
                if (templateTextItems[j]?.bindings) slides[i][j].bindings = templateTextItems[j].bindings

                // auto size
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
        if (!biblesContent[0]) return

        const lines: any[] = []

        // WIP itemIndex is mostly correct if combineWithText

        // if (combineWithText) itemIndex = 0
        const metaTemplate = templateTextItems[itemIndex] || templateTextItems[0]
        const alignStyle = metaTemplate?.lines?.[0]?.align || ""
        const verseStyle = metaTemplate?.lines?.[0]?.text?.[0]?.style || "font-size: 50px;"
        // remove text in () on scripture names
        const bibleVersions = biblesContent.map((a) => (a?.version || "").replace(/\([^)]*\)/g, "").trim())
        const versions = combineWithText ? bibleVersions[itemIndex] : bibleVersions.join(" + ")
        const books = combineWithText ? biblesContent[itemIndex]?.book : removeDuplicates(biblesContent.map((a) => a.book)).join(" / ")

        // custom value (API)
        if (biblesContent.find((a) => a?.attributionRequired)) {
            showVersion = true
            if (!customText.includes(textKeys.showVersion)) customText += textKeys.showVersion
        }

        const referenceDivider = get(scriptureSettings).referenceDivider || ":"
        let text = customText
        if (!showVersion && !showVerse) return
        text = text.replaceAll(textKeys.showVersion, showVersion ? versions : "")
        text = text.replaceAll(textKeys.showVerse, showVerse ? books + " " + biblesContent[0].chapter + referenceDivider + range : "")

        text.split("\n").forEach((line) => {
            if (!line.trim()) return
            lines.push({ text: [{ value: line, style: verseStyle }], align: alignStyle })
        })

        if (lines.length) {
            // add reference to the main text if just one item or it's enabled!
            if (combineWithText) {
                if (!slides[slideIndex][itemIndex]) slides[slideIndex][itemIndex] = { lines: [], style: "" }
                if (get(scriptureSettings).referenceAtBottom && slides[slideIndex][itemIndex].lines) slides[slideIndex][itemIndex].lines!.push(...lines)
                else slides[slideIndex][itemIndex].lines = [...lines, ...(slides[slideIndex][itemIndex].lines || [])]
            } else {
                slides[slideIndex].push({
                    lines,
                    style: metaTemplate?.style || "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
                    specialStyle: metaTemplate?.specialStyle || {},
                    actions: metaTemplate?.actions || {}
                })
            }
        }
    }
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

export function formatBibleText(text: string | undefined) {
    if (!text) return ""
    return stripMarkdown(text).replaceAll("/ ", " ").replaceAll("*", "").replaceAll("&amp;", '&')
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


// MOVE SELECTION

export function moveSelection(lengths: { book: number, chapters: number, verses: number }, currentSelection: { book: number, chapters: number[], verses: number[] }, moveLeft = false) {
    const { book: maxBooks, chapters: maxChapters, verses: maxVerses } = lengths
    let { book, chapters, verses } = clone(currentSelection)

    const verseCount = verses.length
    const currentChapter = chapters[0]
    const firstVerse = verses[0]
    const lastVerse = verses[verses.length - 1]

    if (!moveLeft) {
        // ---- MOVE RIGHT ----
        if (lastVerse < maxVerses) {
            // Just move within the same chapter
            const newStart = firstVerse + verseCount
            if (newStart <= maxVerses) {
                verses = Array.from({ length: verseCount }, (_, i) => newStart + i).filter(v => v <= maxVerses)
            } else {
                // overflow: go to next chapter
                if (currentChapter < maxChapters) {
                    chapters = [currentChapter + 1]
                    verses = Array.from({ length: verseCount }, (_, i) => i + 1).filter(v => v <= maxVerses)
                } else if (book < maxBooks) {
                    // overflow to next book
                    book += 1
                    chapters = [1]
                    verses = Array.from({ length: verseCount }, (_, i) => i + 1)
                }
            }
        } else {
            // overflow: go to next chapter
            if (currentChapter < maxChapters) {
                chapters = [currentChapter + 1]
                verses = Array.from({ length: verseCount }, (_, i) => i + 1).filter(v => v <= maxVerses)
            } else if (book < maxBooks) {
                // overflow to next book
                book += 1
                chapters = [1]
                verses = Array.from({ length: verseCount }, (_, i) => i + 1)
            }
        }
    } else {
        // ---- MOVE LEFT ----
        if (firstVerse > 1) {
            const newStart = Math.max(1, firstVerse - verseCount)
            verses = Array.from({ length: verseCount }, (_, i) => newStart + i)
        } else {
            // Need to move to previous chapter
            if (currentChapter > 1) {
                chapters = [currentChapter - 1]
                const lastVersePrev = maxVerses
                const newStart = Math.max(1, lastVersePrev - verseCount + 1)
                verses = Array.from({ length: verseCount }, (_, i) => newStart + i)
            } else if (book > 1) {
                // Move to previous book
                book -= 1
                chapters = [maxChapters]
                const newStart = Math.max(1, maxVerses - verseCount + 1)
                verses = Array.from({ length: verseCount }, (_, i) => newStart + i)
            }
        }
    }

    return { book, chapters, verses }
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

let usedNames: { [key: string]: string[] } = {}
export function getShortBookName(key: string, book: Book, i: number) {
    if ((book as any).abbreviation) return (book as any).abbreviation
    if (book.id?.length === 3) return book.id[0].toUpperCase() + book.id.slice(1, 3).toLowerCase()

    const name = book.name
    let shortName = isNaN(parseInt(name[0])) ? name.slice(0, 3) : name.replace(" ", "").slice(0, 4)

    // use four characters if same short name ("Jud"ges="Jud"e)
    if (i === 0) usedNames[key] = []
    if (usedNames[key].includes(shortName) && shortName.length === 3) shortName = name.slice(0, 4)
    usedNames[key].push(shortName)

    return shortName
}

// hard coded custom Bible data
const bibleData = {
    "eea18ccd2ca05dde-01": {
        nameLocal: "Bibel 2011 Bokmål" // med gammeltestamentlige apokryfer
    }
}
// ChurchAppsApiBible
export function customBibleData(data: any) {
    return { ...data, ...(bibleData[data.sourceKey] || {}) }
}