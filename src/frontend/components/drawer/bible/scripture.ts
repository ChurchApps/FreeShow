import JsonBible from "json-bible"
import { ApiBiblesList, ApiBible as JsonBibleApi } from "json-bible/lib/api"
import type { CustomBibleListContent } from "json-bible/lib/api/ApiBible"
import { stripMarkdown } from "json-bible/lib/markdown"
import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../../../types/IPC/Main"
import type { BibleContent } from "../../../../types/Scripture"
import type { Item, Show } from "../../../../types/Show"
import { ShowObj } from "../../../classes/Show"
import { createCategory } from "../../../converters/importHelpers"
import { requestMain } from "../../../IPC/main"
import { splitTextContentInHalf } from "../../../show/slides"
import { activePopup, activeProject, activeScripture, drawerTabsData, media, notFound, outLocked, outputs, overlays, popupData, scriptureHistory, scriptures, scripturesCache, scriptureSettings, styles, templates } from "../../../stores"
import { trackScriptureUsage } from "../../../utils/analytics"
import { getKey } from "../../../values/keys"
import { customActionActivation } from "../../actions/actions"
import { getItemText } from "../../edit/scripts/textStyle"
import { clone, removeDuplicates } from "../../helpers/array"
import { history } from "../../helpers/history"
import { getMediaStyle } from "../../helpers/media"
import { getActiveOutputs, setOutput } from "../../helpers/output"
import { checkName } from "../../helpers/show"

const SCRIPTURE_API_URL = "https://api.churchapps.org/content/bibles"

export async function getApiBiblesList() {
    try {
        return await ApiBiblesList("*", SCRIPTURE_API_URL)
    } catch (err) {
        console.error("Error loading API Bible:", err)
        return await ApiBiblesList(getKey("bibleapi"))
    }
}

export async function loadJsonBible(id: string) {
    const scriptureData = get(scriptures)[id]
    const isApi = !!scriptureData?.api

    if (isApi) {
        const key = getKey("bibleapi")
        const apiId = scriptureData?.id || id
        try {
            return await JsonBibleApi(key, apiId, SCRIPTURE_API_URL)
        } catch (err) {
            console.error("Error loading API Bible:", err)
            return await JsonBibleApi(key, apiId)
        }
    }

    if (scriptureData?.collection) throw new Error("Collections must load one at a time")

    const localBible = await getLocalBible(id)
    if (!localBible) throw new Error("Local Bible not found")

    // load custom book names for local bibles (as many xml names are missing or in English) & fix numbers
    localBible.books = localBible.books.map((a, i) => ({ ...a, name: (a as any).customName || a.name, number: !isNaN(a.number) ? Number(a.number) : i + 1 }))

    return await JsonBible(localBible)
}

async function getLocalBible(id: string) {
    if (get(scripturesCache)[id]) return clone(get(scripturesCache)[id])

    const scriptureData = get(scriptures)[id]
    if (!scriptureData) return null

    const localBibleResponse = await requestMain(Main.BIBLE, { name: scriptureData.name, id })
    const localBible = localBibleResponse.content?.[1]

    if (localBibleResponse.error === "not_found" || !localBible) {
        notFound.update((a) => {
            a.bible.push(id)
            return a
        })
        return null
    }

    // update
    const metadata = localBible.metadata || {}
    if ((localBible as any).copyright) metadata.copyright = (localBible as any).copyright
    if (Object.keys(metadata).length) localBible.metadata = metadata
    if (!localBible.name) localBible.name = scriptureData.name || ""

    scripturesCache.update((a) => {
        a[id] = clone(localBible)
        return a
    })

    return localBible
}

// GET CONTENT

export async function getActiveScripturesContent() {
    const tabId = get(drawerTabsData).scripture?.activeSubTab || ""
    const selectedScriptureData = get(scriptures)[tabId]
    if (!selectedScriptureData) return null

    const active = get(activeScripture).reference

    // Sort verses by numeric verse id and subverse (e.g. "2_0", "2_1") so mixed
    // values like ["2_1","2_0", 1] end up ordered by base id then subverse.
    const selectedVerses = active?.verses.map(v => {
        if (!Array.isArray(v)) return []

        return v.sort((a, b) => {
            // strip optional chapter prefix (e.g. "2:1") before parsing
            const sa = String(a).replace(/^\d+:/, "")
            const sb = String(b).replace(/^\d+:/, "")

            const pa = getVerseIdParts(sa)
            const pb = getVerseIdParts(sb)

            if (pa.id !== pb.id) return pa.id - pb.id
            if (pa.subverse !== pb.subverse) return pa.subverse - pb.subverse
            return 0
        })
    }) || []

    if (!selectedVerses[0]?.length) return null

    const currentScriptures = selectedScriptureData.collection?.versions || [tabId]

    return await Promise.all(currentScriptures.map(async id => {
        const BibleData = await loadJsonBible(id)
        const Book = await BibleData.getBook(active?.book)

        const scriptureData = get(scriptures)[id]
        const version = scriptureData?.customName || scriptureData?.name || ""
        const attributionString = scriptureData?.attributionString || ""
        const attributionRequired = !!scriptureData?.attributionRequired

        const bookName = Book.name
        const selectedChapters = active?.chapters.map(c => Number(c)) || []
        const Chapters = await Promise.all(selectedChapters.map(c => Book.getChapter(c)))

        const metadata = BibleData.data.metadata || {}
        Object.entries(scriptureData?.metadata || {}).forEach(([key, value]) => {
            metadata[key] = value
        })
        if (scriptureData?.copyright) metadata.copyright = scriptureData.copyright
        if (scriptureData?.name && !metadata.title) metadata.title = scriptureData.name

        // WIP custom verse number offset per scripture (for collections)

        // add the three prior and next verse numbers to selected for the stage display next slide
        const selected = clone(selectedVerses)
        const includeCount = 3
        selected[0].unshift(...Array.from({ length: includeCount }, (_, i) => getVerseId(selected[0][0]) - (i + 1)).reverse())
        selected[0].push(...Array.from({ length: includeCount }, (_, i) => getVerseId(selected[0][selected[0].length - 1]) + (i + 1)))
        // remove selected not in range of min to max verse number
        const minVerseNumber = 1
        const maxVerseNumber = Chapters[0].data.verses[Chapters[0].data.verses.length - 1].number ?? Chapters[0].data.verses.length
        selected[0] = selected[0].filter(v => {
            const id = getVerseId(v)
            if (isNaN(id)) return true
            return id >= minVerseNumber && id <= maxVerseNumber
        })

        const splitLongVerses = get(scriptureSettings).splitLongVerses
        const allVersesText: { [key: string]: string }[] = []
        selected.forEach((verses, i) => {
            const versesText: { [key: string]: string } = {}

            // WIP if 1_1, 1_2, 1_3 all add up to over the splitted verse length combined, then merge into "1"

            verses.forEach(v => {
                const { id, subverse } = getVerseIdParts(v)

                const text = Chapters[i].getVerse(id).getHTML()
                const splittedVerses = getSplittedVerses({ [id]: text })

                const newVerseId = id + (subverse ? `_${subverse}` : "")
                if (splitLongVerses && splittedVerses[newVerseId]) versesText[v] = splittedVerses[newVerseId]
                else versesText[v] = text
            })

            allVersesText.push(versesText)
        })

        // const reference = Chapter.getVerse(selectedVerses[0]).getReference()

        return { id, isApi: scriptureData.api, version, metadata, book: bookName, bookId: active?.book || "", chapters: selectedChapters, verses: allVersesText, activeVerses: selectedVerses, attributionString, attributionRequired } as BibleContent
    }))
}

// OUTPUT

export async function playScripture() {
    if (get(outLocked)) return

    const biblesContent = await getActiveScripturesContent()
    if (!biblesContent?.length) return
    const selectedChapters = biblesContent[0]?.chapters || []
    const selectedVerses = biblesContent[0]?.activeVerses || []

    const slides = getScriptureSlides({ biblesContent, selectedChapters, selectedVerses }, true)

    const { id, subverse } = getVerseIdParts(selectedVerses[0]?.[0])
    const showSplitSuffix = get(scriptureSettings).splitLongVersesSuffix
    const value = `${id}${showSplitSuffix && subverse ? getVersePartLetter(subverse) : ""}`

    // scripture usage history
    scriptureHistory.update((a) => {
        const newItem = {
            id: biblesContent[0].id,
            book: biblesContent[0].bookId,
            chapter: biblesContent[0].chapters[0],
            verse: selectedVerses[0],
            reference: `${biblesContent[0].book} ${biblesContent[0].chapters[0]}:${value}`,
            text: getSplittedVerses(biblesContent[0].verses?.[0])[selectedVerses[0]?.[0]] || biblesContent[0].verses[selectedVerses[0]?.[0]] || ""
        }
        // WIP multiple verses, play from another version

        const existingIndex = a.findIndex((a) => JSON.stringify(a) === JSON.stringify(newItem))
        if (existingIndex > -1) a.splice(existingIndex, 1)
        a.push(newItem)

        return a
    })

    const outputIsScripture = get(outputs)[getActiveOutputs()[0]]?.out?.slide?.id === "temp"
    if (!outputIsScripture) customActionActivation("scripture_start")

    const attributionString = getMergedAttribution(biblesContent)
    const includeCount = 3

    const tempItems: Item[] = slides[0] || []
    const categoryId = get(drawerTabsData).scripture?.activeSubTab || ""
    setOutput("slide", { id: "temp", categoryId, tempItems, previousSlides: getPreviousSlides(), nextSlides: getNextSlides(), attributionString, translations: biblesContent.length })

    // track
    const verseRange = joinRange(selectedVerses[0])
    const reference = `${biblesContent[0].book} ${biblesContent[0].chapters[0]}:${verseRange}`
    biblesContent.forEach((translation) => {
        const name = translation.version || ""
        const apiId = translation.isApi ? get(scriptures)[translation.id]?.id || translation.id || "" : null
        if (name || apiId) trackScriptureUsage(name, apiId, reference)
    })

    const templateId = get(scriptureSettings).template || "scripture" // $styles[styleId]?.templateScripture || ""
    const template = get(templates)[templateId] || {}
    const templateBackground = template.settings?.backgroundPath

    // play template background
    if (!templateBackground) return

    // get style (for media "fit")
    const currentOutput = get(outputs)[getActiveOutputs()[0]]
    const currentStyle = get(styles)[currentOutput?.style || ""] || {}

    const mediaStyle = getMediaStyle(get(media)[templateBackground], currentStyle)
    setOutput("background", { path: templateBackground, loop: true, muted: true, ...mediaStyle })

    ///

    function getPreviousSlides() {
        const lowestIndex = getVerseId(selectedVerses[0].sort((a, b) => getVerseId(a) - getVerseId(b))[0])

        const slides: any[] = []
        for (let i = 1; i <= includeCount; i++) {
            const verseIndex = lowestIndex - i
            slides.push(getScriptureSlides({ biblesContent: biblesContent!, selectedChapters, selectedVerses: [[verseIndex]] }, true, true)[0])
        }

        return slides
    }
    function getNextSlides() {
        const highestIndex = getVerseId(selectedVerses[0].sort((a, b) => getVerseId(b) - getVerseId(a))[0])

        const slides: any[] = []
        for (let i = 1; i <= includeCount; i++) {
            const verseIndex = highestIndex + i
            slides.push(getScriptureSlides({ biblesContent: biblesContent!, selectedChapters, selectedVerses: [[verseIndex]] }, true, true)[0])
        }

        return slides
    }
}

export function outputIsScripture(updater = get(outputs)) {
    const outputId = getActiveOutputs(updater, true, true, true)[0]
    return updater[outputId]?.out?.slide?.id === "temp"
}

export function getMergedAttribution(biblesContent: BibleContent[]) {
    return [...new Set(biblesContent.map((a) => a?.attributionString).filter(Boolean))].join(" / ")
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
    if (!Array.isArray(array) || !array.length) return ""

    const sorted = array.slice().sort((a, b) => {
        const sa = String(a)
        const sb = String(b)

        const chapA = sa.match(/^(\d+):/)
        const chapB = sb.match(/^(\d+):/)
        const chapANum = chapA ? Number(chapA[1]) : null
        const chapBNum = chapB ? Number(chapB[1]) : null

        const restA = sa.replace(/^\d+:/, "")
        const restB = sb.replace(/^\d+:/, "")

        const matchA = restA.match(/^(\d+)(?:_(.+))?$/) || []
        const matchB = restB.match(/^(\d+)(?:_(.+))?$/) || []

        const numA = Number(matchA[1] || 0)
        const suffixA = matchA[2] || ""

        const numB = Number(matchB[1] || 0)
        const suffixB = matchB[2] || ""

        if (chapANum !== null && chapBNum !== null) {
            if (chapANum !== chapBNum) return chapANum - chapBNum
            if (numA !== numB) return numA - numB
            if (suffixA === "" && suffixB !== "") return -1
            if (suffixA !== "" && suffixB === "") return 1
            return suffixA.localeCompare(suffixB)
        }

        if (chapANum !== null && chapBNum === null) return 1
        if (chapANum === null && chapBNum !== null) return -1

        if (numA !== numB) return numA - numB
        if (suffixA === "" && suffixB !== "") return -1
        if (suffixA !== "" && suffixB === "") return 1
        return suffixA.localeCompare(suffixB)
    })

    const normalized: string[] = []
    sorted.forEach((entry) => {
        const raw = String(entry)
        const chapterMatch = raw.match(/^(\d+):/)
        const chapterPrefix = chapterMatch ? `${chapterMatch[1]}:` : ""
        const noChapter = raw.replace(/^\d+:/, "")

        const { id, endNumber } = getVerseIdParts(noChapter)
        if (!id) return

        const base = `${chapterPrefix}${id}${endNumber ? "-" + endNumber : ""}`
        if (normalized[normalized.length - 1] !== base) normalized.push(base)
    })

    if (!normalized.length) return ""

    type NormalizedPart = { chapter: string | null, start: number, end: number }

    const parts: NormalizedPart[] = normalized
        .map((token) => {
            const hasChapter = token.includes(":")
            const [chapterPart, versePart] = hasChapter ? token.split(":") : [null, token]
            const [startPart, endPart] = versePart.split("-")

            const start = Number(startPart)
            const end = Number(endPart || startPart)

            if (Number.isNaN(start) || Number.isNaN(end)) return null

            return { chapter: chapterPart, start, end }
        })
        .filter((part): part is NormalizedPart => !!part)

    if (!parts.length) return ""

    const segments: NormalizedPart[] = []
    parts.forEach((part) => {
        const last = segments[segments.length - 1]
        const sameChapter = last && (last.chapter === part.chapter)
        const isConsecutive = last && sameChapter && part.start <= last.end + 1

        if (!last) {
            segments.push({ ...part })
            return
        }

        if (isConsecutive) {
            last.end = Math.max(last.end, part.end)
            return
        }

        segments.push({ ...part })
    })

    return segments
        .map((segment) => {
            const chapterPrefix = segment.chapter ? `${segment.chapter}:` : ""
            if (segment.start === segment.end) return `${chapterPrefix}${segment.start}`
            return `${chapterPrefix}${segment.start}-${segment.end}`
        })
        .join(" ; ")
}

export function getScriptureSlides({ biblesContent, selectedChapters, selectedVerses }: { biblesContent: BibleContent[], selectedChapters: number[], selectedVerses: (number | string)[][] }, onlyOne = false, disableReference = false) {
    const slides: Item[][] = [[]]

    const template = get(templates)[get(scriptureSettings).template]
    const templateItems = clone(template?.items || [])
    const templateTextItems = templateItems.filter((a) => a.lines && !getItemText(a).includes("{"))
    const templateOtherItems = templateItems.filter((a) => (!a.lines && a.type !== "text") || getItemText(a).includes("{"))
    const templateOverlayItems = get(overlays)[template?.settings?.overlayId || ""]?.items || []

    const combineWithText = templateTextItems.length <= 1 || get(scriptureSettings).combineWithText

    biblesContent.forEach((bible, bibleIndex) => {
        const allVerses: { text: string; chapterNumber: number; verseId: string }[] = []
        selectedChapters.forEach((chapterNumber, chapterIndex) => {
            const chapterVerses = selectedVerses[chapterIndex] || []
            chapterVerses.forEach((s) => {
                const verseText = bible.verses[chapterIndex]?.[s.toString()] || ""
                allVerses.push({ text: verseText, chapterNumber, verseId: s.toString() })
            })
        })
        const currentVerseNumbers = allVerses.map(a => `${selectedChapters.length > 1 && a.chapterNumber !== selectedChapters[0] ? `${a.chapterNumber}:` : ""}${a.verseId}`)

        const currentTemplate = templateTextItems[bibleIndex] || templateTextItems[0]
        const itemStyle = currentTemplate?.style || "top: 150px;left: 50px;width: 1820px;height: 780px;"
        const itemAlignStyle = currentTemplate?.align || ""
        const alignStyle = currentTemplate?.lines?.[1]?.align || currentTemplate?.lines?.[0]?.align || "text-align: start;"
        const textStyle = currentTemplate?.lines?.[1]?.text?.[0]?.style || currentTemplate?.lines?.[0]?.text?.[0]?.style || "font-size: 80px;"

        const emptyItem = { align: itemAlignStyle, lines: [{ text: [], align: alignStyle }], style: itemStyle, specialStyle: currentTemplate?.specialStyle || {}, actions: currentTemplate?.actions || {} } // scrolling, bindings

        let slideIndex = 0
        slides[slideIndex].push(clone(emptyItem))

        let verseLine = 0
        allVerses.forEach((v, rangeIndex) => {
            const slideArr = slides[slideIndex][bibleIndex]
            if (!slideArr?.lines?.[0]?.text) return

            let text: string = v.text
            if (!text) return

            let lineIndex = 0
            // verses on individual lines
            if (get(scriptureSettings).versesOnIndividualLines) {
                lineIndex = verseLine
                verseLine++
                if (!slideArr.lines[lineIndex]) slideArr.lines[lineIndex] = { text: [], align: alignStyle }
            }

            // verse number
            if (get(scriptureSettings).verseNumbers) {
                let size = get(scriptureSettings).numberSize || 50
                if (rangeIndex === 0) size *= 1.2
                const verseNumberStyle = `${textStyle};font-size: ${size}px;color: ${get(scriptureSettings).numberColor || "#919191"};text-shadow: none;`

                const { id, subverse, endNumber } = getVerseIdParts(v.verseId)
                const showSuffix = get(scriptureSettings).splitLongVersesSuffix
                const showBaseNumber = !subverse || subverse === 1 || showSuffix

                let verseNumberValue = ""
                if (showBaseNumber) verseNumberValue = `${id}${endNumber ? "-" + endNumber : ""}`
                if (showSuffix && subverse) verseNumberValue += getVersePartLetter(Number(subverse))

                if (verseNumberValue) {
                    slideArr.lines[lineIndex].text.push({
                        value: `${verseNumberValue} `,
                        style: verseNumberStyle,
                        customType: "disableTemplate" // dont let template style verse numbers
                    })
                }
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

            slideArr.lines[lineIndex].text.push(...textArray)

            // if (bibleIndex + 1 < biblesContent.length) return
            if (onlyOne || (rangeIndex + 1) % get(scriptureSettings).versesPerSlide > 0) return

            if (!disableReference && bibleIndex + 1 >= biblesContent.length) {
                let range: any[] = onlyOne ? currentVerseNumbers : currentVerseNumbers.slice(rangeIndex - get(scriptureSettings).versesPerSlide + 1, rangeIndex + 1)
                if (get(scriptureSettings).splitReference === false || get(scriptureSettings).firstSlideReference) range = currentVerseNumbers
                let indexes = [biblesContent.length]
                if (combineWithText) indexes = [...Array(biblesContent.length)].map((_, i) => i)
                indexes.forEach((i) => addMeta(clone(get(scriptureSettings)), joinRange(range), v.chapterNumber, { slideIndex, itemIndex: i }))
            }

            if (rangeIndex + 1 >= allVerses.length) return

            slideIndex++
            verseLine = 0
            if (!slides[slideIndex]) slides.push([clone(emptyItem)])
            else slides[slideIndex].push(clone(emptyItem))
        })

        // add remaining
        if (!disableReference && bibleIndex + 1 >= biblesContent.length) {
            const remainder = onlyOne ? currentVerseNumbers.length : currentVerseNumbers.length % get(scriptureSettings).versesPerSlide
            let range: any[] = currentVerseNumbers.slice(currentVerseNumbers.length - remainder, currentVerseNumbers.length)
            if (get(scriptureSettings).splitReference === false || get(scriptureSettings).firstSlideReference) range = currentVerseNumbers
            let indexes = [biblesContent.length]
            if (combineWithText) indexes = [...Array(biblesContent.length)].map((_, i) => i)

            // get chapter number based on first verse in current range
            const currentChapterNumber = (() => {
                if (selectedChapters.length === 1) return selectedChapters[0]
                const firstVerse = range[0] || ""
                const chapterMatch = firstVerse.toString().match(/^(\d+):/)
                if (chapterMatch) return Number(chapterMatch[1])
                return selectedChapters[0]
            })()

            if (remainder) indexes.forEach((i) => addMeta(clone(get(scriptureSettings)), joinRange(range), currentChapterNumber, { slideIndex, itemIndex: i }))
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
        slides[i] = [...templateOverlayItems, ...templateOtherItems, ...items]
        if (get(scriptureSettings).invertItems) slides[i].reverse()
    })

    return slides

    function addMeta({ showVersion, showVerse, customText }, range: string, chapterNumber: number, { slideIndex, itemIndex }) {
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
        text = text.replaceAll(textKeys.showVerse, showVerse ? books + " " + chapterNumber + referenceDivider + range : "")

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

// regex split (id_subverse-endNumber) or just (id) or just (id_subverse) or (id-endNumber)
export function getVerseIdParts(verseId: string | number) {
    const regex = /(\d+(?:\.\d+)?)(?:_(\d+))?(?:-(\d+))?/
    const match = verseId?.toString().match(regex)
    if (!match) return { id: 0, subverse: 0, endNumber: 0 }

    const [_, id, subverse, endNumber] = match
    return { id: Number(id), subverse: Number(subverse) || 0, endNumber: Number(endNumber) || 0 }
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
    if (!value) return []

    const queue: string[] = [value.trim()]
    const segments: string[] = []
    const proportion = Math.floor(maxLength * 0.3)
    const upperBound = Math.max(maxLength - 1, 0)
    let minSegmentLength = Math.max(10, proportion)
    if (upperBound > 0) minSegmentLength = Math.min(minSegmentLength, upperBound)
    if (minSegmentLength < 1) minSegmentLength = 1

    while (queue.length) {
        const current = queue.shift()?.trim()
        if (!current) continue

        if (current.length <= maxLength) {
            segments.push(current)
            continue
        }

        const halves = getSplitHalves(current, maxLength)
        if (!halves) {
            segments.push(current)
            continue
        }

        let [first, second] = halves

        const rebalanced = rebalanceHalves(first, second, maxLength, minSegmentLength)
        first = rebalanced.first
        second = rebalanced.second

        if (second.length < 1) {
            segments.push(first)
            continue
        }

        if (second.length > 0) queue.unshift(second)
        if (first.length > 0) queue.unshift(first)
    }

    if (segments.length > 1 && segments[segments.length - 1].length < minSegmentLength) {
        segments[segments.length - 2] = `${segments[segments.length - 2]} ${segments.pop()}`.trim()
    }

    return segments
}

function getSplitHalves(text: string, maxLength: number): [string, string] | null {
    const halves = splitTextContentInHalf(text)
    if (halves.length >= 2) {
        const first = halves[0].trim()
        const second = halves[1].trim()
        if (first.length && second.length) return [first, second]
    }

    if (text.length <= maxLength) return null

    let pivot = text.lastIndexOf(" ", maxLength)
    if (pivot <= 0) pivot = text.indexOf(" ", maxLength)
    if (pivot <= 0) pivot = maxLength

    const first = text.slice(0, pivot).trim()
    const second = text.slice(pivot).trim()
    if (!first.length || !second.length) return null
    return [first, second]
}

function rebalanceHalves(first: string, second: string, maxLength: number, minSegmentLength: number) {
    if (second.length >= minSegmentLength || first.length <= minSegmentLength) {
        return { first, second }
    }

    const words = first.split(/\s+/).filter(Boolean)
    while (words.length > 1 && second.length < minSegmentLength) {
        const moved = words.pop()
        if (!moved) break

        const candidateFirst = words.join(" ").trim()
        const candidateSecond = `${moved} ${second}`.trim()

        if (!candidateFirst.length || candidateFirst.length > maxLength || candidateSecond.length > maxLength) {
            words.push(moved)
            break
        }

        first = candidateFirst
        second = candidateSecond
    }

    return { first, second }
}

function removeTags(text) {
    return text.replace(/(<([^>]+)>)/gi, "")
}

export function formatBibleText(text: string | undefined, redJesus = false) {
    if (!text) return ""
    if (redJesus) text = text.replace(/!\{(.*?)\}!/g, '<span class="wj">$1</span>')
    return stripMarkdown(text).replaceAll("/ ", " ").replaceAll("*", "").replaceAll("&amp;", '&')
}

// CREATE SHOW/SLIDES

export async function createScriptureShow(showPopup = false) {
    const biblesContent = await getActiveScripturesContent()
    if (!biblesContent?.length) return

    const selectedVerses = biblesContent?.[0]?.activeVerses || []
    // const verseRange = joinRange(selectedVerses)
    // if (!verseRange) return
    if (!selectedVerses[0]?.length) return

    if (showPopup) {
        const showVersion = biblesContent.find((a) => a?.attributionRequired) || get(scriptureSettings).showVersion

        popupData.set({ showVersion, create: true })
        activePopup.set("scripture_show")
        return
    }

    const show = getScriptureShow(biblesContent)
    if (!show) return

    history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } })
}

export function getScriptureShow(biblesContent: BibleContent[] | null) {
    if (!biblesContent?.length) return null

    const selectedChapters = biblesContent[0]?.chapters || []
    const selectedVerses = biblesContent?.[0]?.activeVerses || []

    let slides: Item[][] = [[]]
    if (selectedVerses.length || get(scriptureSettings)) slides = getScriptureSlides({ biblesContent, selectedChapters, selectedVerses })

    // create first slide reference
    // const itemIndex = get(scriptureSettings)?.invertItems ? 1 : 0
    const textboxes = slides[0].filter((a) => (a.type || "text") === "text" && a.lines?.length)
    if (get(scriptureSettings).firstSlideReference && textboxes[0]?.lines?.[0]?.text?.[0]) {
        const textboxesClone = clone(textboxes)

        // remove reference item
        // slides.forEach((a) => a.splice(a.length - 1, 1))
        // get verse text for correct styling
        let metaStyle = get(scriptureSettings)?.invertItems ? textboxesClone.at(-1) : textboxesClone.at(-2)
        if (!metaStyle) metaStyle = clone(textboxesClone[0])

        if (metaStyle) slides = [[metaStyle], ...slides]
        // only keep one line/text item (not verse number)
        slides[0][0].lines = [slides[0][0].lines![0]]
        slides[0][0].lines[0].text = [slides[0][0].lines[0].text[1] || slides[0][0].lines[0].text[0]]
        // set verse text to reference
        const refValue = (get(scriptureSettings)?.invertItems ? textboxesClone.at(-2) : textboxesClone.at(-1))?.lines?.at(get(scriptureSettings)?.referenceAtBottom ? -1 : 0)?.text?.[0].value || ""
        slides[0][0].lines[0].text[0].value = refValue
    }

    // template data
    const template = clone(get(templates)[get(scriptureSettings).template])
    const backgroundPath = template?.settings?.backgroundPath
    const media = {}
    const backgroundId = uid(5)
    if (backgroundPath) media[backgroundId] = { path: backgroundPath, loop: true, muted: true }

    const slides2: any = {}
    const layouts: any[] = []
    slides.forEach((items: any, i) => {
        const id = uid()
        const referenceText = getReferenceText(biblesContent)

        slides2[id] = { group: referenceText, color: null, settings: {}, notes: "", items }
        const l: any = { id }

        if (backgroundId && i === 0) l.background = backgroundId

        layouts.push(l)
    })

    const firstSlideTemplateId = template?.settings?.firstSlideTemplate || ""
    if (firstSlideTemplateId) {
        const firstLayoutId = layouts[0]?.id
        if (firstLayoutId && slides2[firstLayoutId]) {
            const firstTemplate = clone(get(templates)[firstSlideTemplateId || ""])
            const firstTemplateSettings = firstTemplate?.settings
            slides2[firstLayoutId].settings = { ...(slides2[firstLayoutId].settings || {}), template: firstSlideTemplateId }
            if (firstTemplateSettings?.backgroundColor) slides2[firstLayoutId].color = firstTemplateSettings.backgroundColor
            if (firstTemplateSettings?.backgroundPath) {
                const existingMediaId = Object.entries(media as Record<string, any>).find(([, value]) => value.path === firstTemplateSettings.backgroundPath)?.[0]
                const mediaId = existingMediaId || uid(5)
                media[mediaId] = { path: firstTemplateSettings.backgroundPath, loop: true, muted: true }
                const firstLayout = layouts.find((layout) => layout.id === firstLayoutId)
                if (firstLayout) firstLayout.background = mediaId
            }
        }
    }

    // add scripture category
    const categoryId = createCategory("scripture", "scripture", { isDefault: true, isArchive: true })

    const layoutID = uid()
    // only set template if not combined (because it might be a custom reference style on first line)
    const templateId = get(scriptureSettings).combineWithText ? false : get(scriptureSettings).template || false
    // this can be set to private - to only add to project and not in drawer, because it's mostly not used again
    const show: Show = new ShowObj(false, categoryId, layoutID, new Date().getTime(), get(scriptureSettings).verseNumbers ? false : templateId)

    Object.keys(biblesContent[0].metadata || {}).forEach((key) => {
        if (key.startsWith("@")) return
        if (typeof biblesContent[0].metadata?.[key] === "string") show.meta[key] = biblesContent[0].metadata[key]
    })
    // if (bibles[0].copyright) show.meta.copyright = bibles[0].copyright

    const verseRange = joinRange(selectedVerses[0])
    const bibleShowName = `${biblesContent[0].book} ${selectedChapters[0]},${verseRange}`
    show.name = checkName(bibleShowName)
    if (show.name !== bibleShowName) show.name = checkName(`${bibleShowName} - ${getShortBibleName(biblesContent[0].version || "")}`)
    show.slides = slides2
    show.layouts = { [layoutID]: { name: biblesContent[0].version || "", notes: "", slides: layouts } }
    show.media = media

    const versions = biblesContent.map((a) => a.version).join(" + ")
    show.reference = {
        type: "scripture",
        data: {
            collection: get(drawerTabsData).scripture?.activeSubTab || biblesContent[0].id || "",
            translations: biblesContent.length,
            version: versions,
            api: biblesContent[0].isApi,
            book: biblesContent[0].bookId ?? biblesContent[0].book,
            chapter: biblesContent[0].chapters[0],
            verses: biblesContent[0].activeVerses,
            attributionString: biblesContent[0].attributionString
        }
    }

    // WIP add template background?

    return show
}

export function getReferenceText(biblesContent: BibleContent[]) {
    // const referenceTextItem = items.find((a) => a.lines?.find((a) => a.text?.find((a) => a.value.includes(":") && a.value.length < 25)))
    // if (referenceTextItem) return referenceTextItem.lines?.[0]?.text?.[0]?.value

    const books = removeDuplicates(biblesContent.map((a) => a.book)).join(" / ")
    const referenceDivider = get(scriptureSettings).referenceDivider || ":"
    const range = joinRange(biblesContent[0].activeVerses[0])
    const reference = `${books} ${biblesContent[0].chapters[0]}${referenceDivider}${range}`
    return reference

    // let v = get(scriptureSettings).versesPerSlide
    // if (get(scriptureSettings).firstSlideReference) i--
    // let range: any[] = selectedVerses.slice((i + 1) * v - v, (i + 1) * v)
    // let scriptureRef = books + " " + biblesContent[0].chapter + referenceDivider + joinRange(range)
    // if (i === -1) scriptureRef = "—"
}

// MOVE SELECTION

export function moveSelection(lengths: { book: number, chapters: number, verses: number }, currentSelection: { book: number, chapters: number[], verses: (number | string)[] }, moveLeft = false) {
    const { book: maxBooks, chapters: maxChapters, verses: maxVerses } = lengths
    let { book, chapters, verses } = clone(currentSelection)

    // Normalize verses: strip any subverse parts (e.g. "1_1" -> 1) so movement
    // calculations use the base verse numbers. getVerseIdParts safely handles
    // values like "1_2" or numeric inputs.
    const normalizedVerses = (verses || []).map((v) => getVerseIdParts(String(v)).id)
    const verseCount = normalizedVerses.length
    const currentChapter = chapters[0]
    const firstVerse = normalizedVerses[0]
    const lastVerse = normalizedVerses[normalizedVerses.length - 1]

    if (!moveLeft) {
        // ---- MOVE RIGHT ----
        if (lastVerse < maxVerses) {
            // Just move within the same chapter
            const newStart = firstVerse + verseCount
            if (newStart <= maxVerses) {
                // return plain verse numbers (strip subverse parts)
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

// hard coded custom Bible data
const bibleData = {
    "eea18ccd2ca05dde-01": {
        nameLocal: "Bibel 2011 Bokmål" // med gammeltestamentlige apokryfer
    }
}
export function customBibleData(data: CustomBibleListContent) {
    return { ...data, ...(bibleData[data.sourceKey] || {}) } as CustomBibleListContent
}

export function swapPreviewBible(collectionId: string) {
    const collection = get(scriptures)[collectionId]?.collection
    const versions = collection?.versions || []
    const currentPreviewIndex = collection?.previewIndex || 0

    if (versions.length <= 1) return

    scriptures.update((a) => {
        const newIndex = (currentPreviewIndex + 1) % versions.length
        a[collectionId].collection!.previewIndex = newIndex
        return a
    })
}

// WIP similar to array.ts rangeSelect
// Custom range selection for scripture verses that handles split verses (e.g., "1_1", "5_2")
export function scriptureRangeSelect(e: any, currentlySelected: (number | string)[], newSelection: number | string, availableVerses: { id: string }[]): (number | string)[] {
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) return [newSelection]

    if (e.ctrlKey || e.metaKey) {
        if (currentlySelected.includes(newSelection)) {
            return currentlySelected.filter((id) => id !== newSelection)
        } else {
            return [...currentlySelected, newSelection]
        }
    }

    if (e.shiftKey && !currentlySelected.includes(newSelection) && currentlySelected.length > 0) {
        // Helper function to convert verse IDs to sortable numbers
        const verseToNumber = (verseId: number | string): number => {
            const str = String(verseId)
            // Check if it's a split verse (contains underscore)
            if (str.includes("_")) {
                const [id, subverse] = str.split("_").map(Number)
                return id + (subverse || 0) * 0.1
            }
            // Regular verse number
            const num = Number(str)
            return isNaN(num) ? -1 : num
        }

        // Convert to sortable numbers
        const newSelectionNum = verseToNumber(newSelection)
        const lastSelectedNum = verseToNumber(currentlySelected[currentlySelected.length - 1])

        // Only proceed if both conversions were successful
        if (newSelectionNum !== -1 && lastSelectedNum !== -1) {
            // Get all verse numbers in the range
            const start = Math.min(newSelectionNum, lastSelectedNum)
            const end = Math.max(newSelectionNum, lastSelectedNum)

            // Find all verses in the range from available verses
            for (const verse of availableVerses) {
                const verseNum = verseToNumber(verse.id)
                if (verseNum > start && verseNum < end && !currentlySelected.includes(verse.id)) {
                    currentlySelected.push(verse.id)
                }
            }

            // Always include the new selection (the end point)
            if (!currentlySelected.includes(newSelection)) {
                currentlySelected.push(newSelection)
            }

            // remove duplicates
            currentlySelected = [...new Set(currentlySelected)]
        }
    }

    return currentlySelected
}
