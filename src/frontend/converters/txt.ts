import { get } from "svelte/store"
import { uid } from "uid"
import type { Chords, Item, Show, Slide, SlideData } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { getItemText, getSlideText } from "../components/edit/scripts/textStyle"
import { clone } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { checkName, getCustomMetadata, getLabelId } from "../components/helpers/show"
import { _show } from "../components/helpers/shows"
import { linesToTextboxes } from "../components/show/formatTextEditor"
import { activePopup, activeProject, activeShow, alertMessage, dictionary, drawerTabsData, formatNewShow, groupNumbers, groups, special, splitLines } from "../stores"
import { translateText } from "../utils/language"
import { setTempShows } from "./importHelpers"

export function getQuickExample() {
    const tip = translateText("create_show.quick_lyrics_example_tip")
    const line = translateText("create_show.quick_lyrics_example_text")
    const verse = translateText("groups.verse")
    const chorus = translateText("groups.chorus")

    // [Verse]\nLine 1\nLine 2\n\nLine 3\nLine 4\n\n[Chorus]\nLine 1\nLine 2\nx2
    return `${tip}...\n\n[${verse}]\n${line} 1\n${line} 2\n\n${line} 3\n${line} 4\n\n[${chorus}]\n${line} 1\n${line} 2\nx2`
}

// convert .txt files to shows
export function convertTexts(files: { content: string; name?: string; extension?: string }[]) {
    if (files.length > 1) {
        alertMessage.set("popup.importing")
        activePopup.set("alert")
    }

    let activeCategory = get(drawerTabsData).shows?.activeSubTab
    if (activeCategory === "all" || activeCategory === "unlabeled") activeCategory = null
    const tempShows: { id: string; show: Show }[] = []

    setTimeout(() => {
        files?.forEach(({ content, name }) => {
            const showData = convertText({ name, category: activeCategory, text: content, noFormatting: true, returnData: true })
            tempShows.push(showData)
        })

        setTempShows(tempShows)
    }, 50)
}

// convert a plain text input into a show
// , onlySlides: boolean = false, { existingSlides } = { existingSlides: {} }
export function convertText({ name = "", origin = "", category = null, text, noFormatting = false, returnData = false, open = true }: any) {
    // remove empty spaces (as groups [] should be used for empty slides)
    // in "Text edit" spaces can be used to create empty "child" slides
    text = text.replaceAll("\r", "").replaceAll("\n \n", "\n\n")

    // preprocess chord lines before splitting into sections
    const allLines = text.split("\n")
    const processedLines = preprocessLines(allLines)
    const processedText = processedLines.join("\n")

    let sections = processedText.split("\n\n").filter(Boolean)

    // example: Artist=Casting Crowns, CCLI=123456
    const metadataKeys = getCustomMetadata()
    const plainTextMetadata: { [key: string]: string } = {}
    let plainNotes = ""
    sections.forEach((section, i) => {
        const lines = section.split("\n")
        const newLines: string[] = []
        lines.forEach(line => {
            if (!line.includes("=")) {
                newLines.push(line)
                return
            }

            const meta = line.split("=")
            const metaKey = meta[0].toLowerCase().replaceAll(" ", "")
            if (metaKey === "notes") {
                plainNotes = meta[1]
                return
            }

            const metadataKey = Object.keys(metadataKeys).find(key => key.toLowerCase().replaceAll(" ", "") === metaKey || translateText("meta." + key).toLowerCase() === metaKey)
            if (!metadataKey) {
                // create slide with unknown metadata
                // newLines.push(line)
                // add unknown metadata to show, without adding it globally
                plainTextMetadata[meta[0]] = meta[1]
                return
            }

            plainTextMetadata[metadataKey] = meta[1]
        })
        sections[i] = newLines.join("\n")
    })
    if (sections[0] === "") sections.splice(0, 1)

    // get ccli
    let ccli = ""
    if (!Object.keys(plainTextMetadata).length && sections[sections.length - 1].includes("www.ccli.com")) {
        ccli = sections.pop()!
    }

    let labeled: { type: string; text: string }[] = []

    // find chorus phrase
    const patterns = findPatterns(sections)
    sections = patterns.sections
    labeled = patterns.indexes.map((a, i) => ({ type: a, text: sections[i] }))
    labeled = checkRepeats(labeled)

    if (!name) name = plainTextMetadata.title || trimNameFromString(labeled[0].text)

    const layoutID: string = uid()
    const show: Show = new ShowObj(false, category, layoutID)
    if (origin) show.origin = origin
    // , existingSlides
    const { slides, layouts } = createSlides(labeled, noFormatting)

    // if (onlySlides) return { slides, layouts }

    show.name = checkName(name)
    show.slides = slides
    show.layouts[layoutID].slides = layouts

    if (ccli) {
        const meta: string[] = ccli.split("\n")
        // songselect order
        if (meta[4]?.includes("CCLI")) {
            show.meta = {
                title: show.name,
                CCLI: meta[4].substring(meta[4].indexOf("#") + 1), // CCLI License
                // CCLI Song = meta[1]
                // artist: meta[0],
                author: meta[0],
                // composer: meta[0],
                // publisher: meta[0],
                copyright: meta[2]
            }
        } else {
            show.meta = {
                title: show.name,
                CCLI: meta[0].substring(meta[0].indexOf("#") + 2),
                artist: meta[1],
                author: meta[2],
                composer: meta[3],
                publisher: meta[1],
                copyright: meta[4]
            }
        }
    } else if (Object.keys(plainTextMetadata).length) {
        show.meta = plainTextMetadata
    }
    if (show.meta.number !== undefined) show.quickAccess = { number: show.meta.number }

    if (plainNotes) show.layouts[layoutID].notes = plainNotes

    const showId = uid()
    if (returnData) return { id: showId, show }

    if (!open) {
        // WIP DON'T OPEN
    }

    const selectedIndex = get(activeShow)?.index === undefined ? undefined : get(activeShow)!.index! + 1
    history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject), index: selectedIndex } }, oldData: { id: showId }, location: { page: "show", id: "show" } })

    return { id: showId, show }
}

export function trimNameFromString(text: string) {
    if (!text?.length) return ""

    const txt = text.split("\n")
    let name = txt[0]

    // don't get group if any
    if (txt.length > 1 && (name.includes("[") || name.includes(":"))) name = txt[1]

    name = name
        .replace(/[,.!]/g, "")
        .replace(/<[^>]*>/g, "")
        .trim()

    if (name.length > 30) name = name.slice(0, name.indexOf(" ", 30))
    if (name.length > 38) name = name.slice(0, 30)

    return name
}

function isChordLine(line: string): boolean {
    if (!line || line.trim() === "") return false

    const chordPattern = /[A-G][#b]?(?:m|M|maj|min|dim|aug|sus|add)?(?:\d+)?(?:\/[A-G][#b]?)?/g
    const nonWhitespace = line.replace(/\s/g, "")
    if (!nonWhitespace) return false

    const chords = line.match(chordPattern) || []
    if (chords.length === 0) return false

    const chordChars = chords.join("").length
    const nonChordChars = nonWhitespace.length - chordChars

    // If more than 20% of non-whitespace characters are not chords, it's probably not a chord line
    return nonChordChars / nonWhitespace.length <= 0.2
}
function preprocessLines(lines: string[]): string[] {
    const output: string[] = []
    let i = 0

    while (i < lines.length) {
        const currentLine = lines[i]

        // Check if this is a section header (like [Verse], [Chorus], etc.)
        const isSectionHeader = currentLine.trim().match(/^\[.+\]$/)
        if (isSectionHeader) {
            output.push(currentLine)
            i++
            // Skip any empty lines after the section header
            while (i < lines.length && lines[i].trim() === "") {
                i++
            }
            continue
        }

        // Check if current line is a chord line with a lyric line below
        if (isChordLine(currentLine)) {
            let j = i + 1
            // Skip one empty line if present
            if (j < lines.length && lines[j].trim() === "") {
                j++
            }

            if (j < lines.length && lines[j].trim() !== "" && !isChordLine(lines[j])) {
                // Found a lyric line - combine chord and lyric lines
                const combinedLine = insertChordsIntoLyrics(currentLine, lines[j])
                output.push(combinedLine)
                i = j + 1
            } else {
                // No corresponding lyric line found
                output.push(currentLine)
                i++
            }
        } else {
            // Not a chord line, add as is
            output.push(currentLine)
            i++
        }
    }

    return output
}
function insertChordsIntoLyrics(chordLine: string, lyricLine: string): string {
    const chordRegex = /[A-G][#b]?(?:m|M|maj|min|dim|aug|sus|add)?(?:\d+)?(?:\/[A-G][#b]?)?/g
    const chords: { chord: string; position: number }[] = []
    let match: RegExpExecArray | null

    while ((match = chordRegex.exec(chordLine)) !== null) {
        // Adjust chord position to attach to words instead of spaces
        let position = match.index

        // If chord position is at a space, move it to the next word
        if (position < lyricLine.length && lyricLine[position] === " ") {
            // Find the next non-space character
            while (position < lyricLine.length && lyricLine[position] === " ") {
                position++
            }
        }

        chords.push({
            chord: match[0],
            position
        })
    }

    if (chords.length === 0) return lyricLine

    let result = ""
    let chordIdx = 0
    const maxLen = Math.max(chordLine.length, lyricLine.length)

    for (let pos = 0; pos < maxLen; pos++) {
        // Insert chord if it starts at this position
        if (chordIdx < chords.length && chords[chordIdx].position === pos) {
            result += `[${chords[chordIdx].chord}]`
            chordIdx++
        }

        // Add lyric character at this position
        if (pos < lyricLine.length) {
            result += lyricLine[pos]
        }
    }

    return result
}

// TODO: this sometimes splits all slides up with no children (when adding [group])
// , existingSlides = {}
function createSlides(labeled: { type: string; text: string }[], noFormatting) {
    const slides: { [key: string]: Slide } = {}
    const layouts: SlideData[] = []

    let activeGroup: { type: string; id: string } | null = null
    const addedChildren: { [key: string]: string[] } = {}
    labeled.forEach(convertLabeledSlides)

    // add children
    Object.entries(addedChildren).forEach(([parentId, children]) => {
        slides[parentId].children = [...(slides[parentId].children || []), ...(children || [])]
    })

    return removeSlideDuplicates(slides, layouts)

    function convertLabeledSlides(a: { type: string; text: string }): void {
        let id = ""
        const formatText: boolean = noFormatting ? false : get(formatNewShow)
        const autoGroups: boolean = get(special).autoGroups !== false

        const slideText: string = fixText(a.text, formatText)
        // this only accounted for the parent slide, so if the same group was placed multiple times with different children that would be replaced & all "duplicate" children would be removed!
        // if (stored[a.type]) id = stored[a.type].find((b) => b.text === text)?.id

        const hasTextGroup: boolean = (a.text.trim()[0] === "[" && a.text.includes("]")) || a.text.trim()[a.text.length - 1] === ":"

        if (id) {
            if (activeGroup && !hasTextGroup) return

            layouts.push({ id })
            return
        }

        id = uid()

        if (hasTextGroup) activeGroup = { type: a.type, id }

        // remember this
        // if (!stored[a.type]) stored[a.type] = []
        // stored[a.type].push({ id, text })

        let group = activeGroup && !hasTextGroup ? null : a.type
        if (!autoGroups && !hasTextGroup && group) group = "verse"
        const color: string | null = null

        // split slide notes from text ("---")
        const slideTextAndNotes = slideText.split("---")

        while (new Set(slideTextAndNotes[0].split("")).size === 1 && slideTextAndNotes[0][0] === "-") slideTextAndNotes.shift()
        let allLines: string[] = [slideTextAndNotes.shift() || ""]
        if (allLines[0].endsWith("\n")) allLines[0] = allLines[0].slice(0, -1)

        while (slideTextAndNotes[0] === "") slideTextAndNotes.shift()
        const slideNotes = slideTextAndNotes.join("\n").slice(1)

        const slideLines = allLines[0].split("\n").filter(Boolean)

        // split lines into a set amount of lines
        if (Number(get(splitLines)) && slideLines.length > get(splitLines)) {
            allLines = []
            while (slideLines.length) allLines.push(slideLines.splice(0, get(splitLines)).join("\n"))
        }

        const children: string[] = []

        allLines.forEach(createSlide)

        // set as child
        if (group === null) {
            if (!activeGroup) return
            if (!addedChildren[activeGroup.id]) addedChildren[activeGroup.id] = []
            addedChildren[activeGroup.id].push(...[id, ...children])
        } else {
            if (children.length) slides[id].children = children

            layouts.push({ id })
        }

        function createSlide(lines: string, slideIndex: number) {
            let items: Item[] = linesToItems(lines)
            if (!items.length) return

            // get active show
            if (_show().get()) {
                const activeItems = clone(_show().slides().items().get()[0])

                // replace values
                items = items
                    // .filter((a) => !a.type || a.type === "text" || a.lines)
                    .map(item => {
                        item.lines?.forEach((_, index) => {
                            item.lines![index].text[0].style = activeItems?.[0]?.lines?.[0]?.text?.[0]?.style || ""
                        })
                        return item
                    })
            }

            // remove empty items
            const textLength = items.reduce((value, item) => (value += getItemText(item).length), 0)
            if (!textLength) items = []

            // extract chords (chordpro)
            items = items.map(item => {
                item.lines?.forEach(line => {
                    const chords: Chords[] = []
                    let letterIndex = 0
                    let isChord = false

                    line?.text?.forEach(text => {
                        let newValue = ""
                        text.value?.split("").forEach(char => {
                            if ((char === "[" || char === "]") && !text.value.slice(0, -2).includes(":")) {
                                isChord = char === "["
                                if (isChord) chords.push({ id: uid(5), pos: letterIndex, key: "" })
                                return
                            }

                            if (isChord) {
                                chords[chords.length - 1].key += char
                                return
                            }

                            newValue += char
                            letterIndex++
                        })

                        text.value = newValue.replaceAll("\r", "")
                    })

                    if (chords.length) line.chords = chords
                })

                return item
            })

            if (slideIndex > 0) {
                // don't add empty slides as children (but allow e.g. "Break")
                if (!getSlideText({ items } as any).length) return

                const childId: string = uid()
                children.push(childId)
                slides[childId] = { group: null, color: null, settings: {}, notes: "", items }
                return
            }

            // a.text.split("\n").forEach((text: string) => {})
            const slide: Slide = { group, color, settings: {}, notes: slideNotes, items }
            if (group) slide.globalGroup = group
            slides[id] = slide
        }
    }
}

function removeSlideDuplicates(slides: { [key: string]: Slide }, layouts: SlideData[]) {
    const slideTextCache: { [key: string]: string } = {}
    const replaceSlides: { [key: string]: string } = {}

    Object.entries(slides).forEach(([slideId, slide]) => {
        if (slide.group === null) return

        let text = getSlideText(slide)
        text += slide.children?.reduce((value, childId) => (value += getSlideText(slides[childId])), "") || ""

        const exists = Object.keys(slideTextCache).find(id => slideTextCache[id] === text)
        if (exists) replaceSlides[slideId] = exists
        else slideTextCache[slideId] = text
    })

    if (Object.keys(replaceSlides).length) {
        let layoutString = JSON.stringify(layouts)

        Object.entries(replaceSlides).forEach(([oldId, newId]) => {
            layoutString = layoutString.replaceAll(oldId, newId)
            delete slides[oldId]
        })

        layouts = JSON.parse(layoutString)
    }

    return { slides, layouts }
}

function linesToItems(lines: string) {
    let slideLines: string[] = lines.split("\n")

    // remove custom ChordPro styling
    slideLines = slideLines.filter(a => !a.startsWith("{") && !a.endsWith("}"))

    const items: Item[] = linesToTextboxes(slideLines)

    return items
}

function checkRepeats(labeled: { type: string; text: string }[]) {
    const newLabels: { type: string; text: string }[] = []
    labeled.forEach(a => {
        const match = a.text.match(/\nx[0-9]/)
        if (match !== null && match.index !== undefined) {
            const repeatNumber = a.text.slice(match.index + 2, match.index + 4).replace(/[A-Z]/gi, "")
            // remove
            a.text = a.text.slice(0, match.index + 1) + a.text.slice(match.index + match[0].length + 1, a.text.length)
            ;[...Array(Number(repeatNumber))].map(() => {
                newLabels.push(a)
            })
        } else newLabels.push(a)
    })
    return newLabels
}

function fixText(text: string, formatText: boolean): string {
    if (formatText) {
        // remove strings (1) shorter than 3, not (this)
        // .replaceAll(".", "")
        text = text.replace(/\([^)]{1,2}\) /g, "")
    }

    // remove group from text
    if (text[0] === "[" && text.includes("]")) text = text.slice(text.indexOf("]") + 1)
    if (text.indexOf(":") === text.split("\n")[0].length - 1) text = text.slice(text.indexOf(":") + 1)

    if (formatText) {
        // repeat text
        let firstRepeater = text.indexOf(":/:")
        let secondRepeater = text.indexOf(":/:", firstRepeater + 1)
        while (firstRepeater >= 0 && secondRepeater >= 0) {
            const repeated = text.slice(firstRepeater + 3, secondRepeater)
            text = text.slice(0, firstRepeater) + repeated + repeated + text.slice(secondRepeater + 3)

            firstRepeater = text.indexOf(":/:")
            secondRepeater = text.indexOf(":/:", firstRepeater + 1)
        }

        let newText = ""
        const commaDividerMinLength = 22 // shouldn't be much less
        text.split("\n").forEach((t: string) => {
            let newLineText = ""

            // commas inside line
            const commas = t.split(",").filter(Boolean)
            commas.forEach((a, i) => {
                newLineText += a

                if (i >= commas.length - 1) newLineText += "\n"
                // else if (!formatText) newLineText += ","
                else if (a.length < commaDividerMinLength || (commas[i + 1] && commas[i + 1].length < commaDividerMinLength)) newLineText += ","
                else newLineText += "\n"
            })

            newText += newLineText
        })

        text = newText
    }

    let lines: string[] = text.split("\n")

    if (formatText) {
        lines = lines.map(line => {
            line = line.trim()
            // make first char uppercase
            line = (line[0]?.toUpperCase() || "") + line.slice(1, line.length)
            // replace at the end of the line
            line = line.replace(/[.,!]*$/g, "")

            return line.trim()
        })
    }

    const label: string = getLabelId(lines[0])

    // remove first line if it's a label
    if (findGroupMatch(label)) lines = lines.slice(1, lines.length)

    text = lines.filter(a => a).join("\n")

    return text
}

//

const similarityNum = 0.7

function findPatterns(sections: string[]) {
    const similarCount: { matches: number[]; count: 0 }[] = []
    // total count of totally different slides
    let totalMatches = 0
    sections.forEach(countMatchingSections)

    // let totalMatches = similarCount.filter((a) => a > 0).length
    let matches = 0
    const stored: { type: string; text: string }[] = []
    const indexes = similarCount.map(getIndexes)

    return { sections, indexes }

    function countMatchingSections(section: string, i: number) {
        similarCount[i] = { matches: [], count: 0 }

        const alreadyCounted = similarCount.find(a => a.matches.includes(i))
        if (alreadyCounted) {
            similarCount[i] = alreadyCounted
            return
        }

        sections.forEach(count)
        if (similarCount[i].count > 0) totalMatches++

        function count(b: string, j: number) {
            if (i === j || similarityNum > similarity(section, b)) return
            similarCount[i].count++
            similarCount[i].matches.push(j)
        }
    }

    function getIndexes(similar: { matches: number[]; count: 0 }, i: number): string {
        // let lines = sections[i].split("\n")
        const splitted: string[] = sections[i].split("\n").filter(a => a.length)
        const length: number = sections[i].replaceAll("\n", "").length
        const find = stored.find(a => similarity(a.text, sections[i]) > similarityNum)

        // TODO: repeat x6
        // TODO: labels in text
        // TODO: frihet, the blessing
        // verses repeat..., bridge repeat

        // if (lines.length < 2) group =  "break"
        if (find) return find.type
        if (!length) return "break"

        // TODO: group....
        const name = getLabelId(splitted[0])
        if (findGroupMatch(name)) return findGroupMatch(name) || name

        // let textGroup: string = splitted[0].trim()[0] === "[" && splitted[0].includes("]") ? splitted[0].slice(splitted[0].indexOf("[") + 1, splitted[0].indexOf("]")) : ""

        // TODO: remove numbers....
        if ((splitted[0].match(/\[[^\]]*]/g)?.[0] || "").length === splitted[0].length || splitted[0].trim()[splitted[0].length - 1] === ":") {
            return splitted[0]
                .replace(/[\[\]'":]+/g, "") // []'":
                .replace(/x[0-9]/g, "") // x0-9
                .replace(/[0-9]/g, "") // 0-9
                .trim()
        }

        // if (length < 10 && !sections[i].includes("\n")) return sections[i].trim()
        if (length < 30 || linesSimilarity(sections[i])) return "tag"
        if (splitted[0].length < 8 && splitted[1].length > 20) {
            sections[i] = splitted.slice(1, splitted.length).join("\n")
            let group = splitted[0]
            if (get(groupNumbers)) group = group.replace(/\d+/g, "").trim()
            return get(groups)[group.toLowerCase()] ? group.toLowerCase() : splitted[0]
        }
        if (similar.count > 0) {
            const globalGroups = ["pre_chorus", "chorus", "bridge", "bridge", "bridge"]
            matches++
            let group = globalGroups[matches]
            if (totalMatches > 2) group = globalGroups[matches - 1] || "other"
            stored.push({ type: group, text: sections[i] })
            return group
        }

        return "verse"
    }
}

function linesSimilarity(text: string): boolean {
    const lines = text.split("\n")
    if (lines.length < 3) return false
    let isSimilar = false
    lines.reduce((a: string, b: string) => {
        if (similarity(a, b) > 0.95) isSimilar = true
        return ""
    })
    return isSimilar
}

// https://stackoverflow.com/questions/10473745/compare-strings-javascript-return-of-likely
export function similarity(s1: string, s2: string) {
    let longer = s1
    let shorter = s2
    if (s1.length < s2.length) {
        longer = s2
        shorter = s1
    }
    const longerLength: number = longer.length
    if (longerLength === 0) {
        return 1.0
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString())
}

function editDistance(s1: string, s2: string) {
    s1 = s1.toLowerCase()
    s2 = s2.toLowerCase()

    const costs: number[] = []
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) costs[j] = j
            else {
                if (j > 0) {
                    let newValue = costs[j - 1]
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
                    costs[j - 1] = lastValue
                    lastValue = newValue
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue
    }
    return costs[s2.length]
}

export function findGroupMatch(group: string): string {
    if (get(groups)[group]) return group

    let groupMatch = ""
    Object.entries(get(dictionary).groups || {}).forEach(([id, value]) => {
        if (value.toLowerCase() === group) groupMatch = id
    })
    if (groupMatch) return groupMatch

    return ""
}
