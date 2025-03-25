import { get } from "svelte/store"
import { uid } from "uid"
import type { Chords, Item, Show, Slide, SlideData } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { getItemText, getSlideText } from "../components/edit/scripts/textStyle"
import { clone } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { checkName, getLabelId } from "../components/helpers/show"
import { _show } from "../components/helpers/shows"
import { linesToTextboxes } from "../components/show/formatTextEditor"
import { activePopup, activeProject, alertMessage, dictionary, drawerTabsData, formatNewShow, groups, special, splitLines } from "../stores"
import { setTempShows } from "./importHelpers"

export function getQuickExample() {
    let tip = get(dictionary).create_show?.quick_lyrics_example_tip || ""
    let line = get(dictionary).create_show?.quick_lyrics_example_text || "Line"
    let verse = get(dictionary).groups?.verse || "Verse"
    let chorus = get(dictionary).groups?.chorus || "Chorus"

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
    let tempShows: { id: string; show: Show }[] = []

    setTimeout(() => {
        files?.forEach(({ content, name }) => {
            const show = convertText({ name, category: activeCategory, text: content, noFormatting: true, returnData: true })
            tempShows.push({ show, id: uid() })
        })

        setTempShows(tempShows)
    }, 50)
}

// convert a plain text input into a show
// , onlySlides: boolean = false, { existingSlides } = { existingSlides: {} }
export function convertText({ name = "", category = null, text, noFormatting = false, returnData = false }: any) {
    // remove empty spaces (as groups [] should be used for empty slides)
    // in "Text edit" spaces can be used to create empty "child" slides
    text = text.replaceAll("\r", "").replaceAll("\n \n", "\n\n")
    // text = text.replaceAll("\r", "").replaceAll("\n\n \n\n", "__BREAK__").replaceAll("\n \n", "\n\n").replaceAll("__BREAK__", "\n\n \n\n")
    let sections = (text as string).split("\n\n").filter(Boolean)

    // get ccli
    let ccli: string = ""
    if (sections[sections.length - 1].includes("www.ccli.com")) {
        ccli = sections.pop()!
    }

    let labeled: { type: string; text: string }[] = []

    // find chorus phrase
    let patterns = findPatterns(sections)
    sections = patterns.sections
    labeled = patterns.indexes.map((a, i) => ({ type: a, text: sections[i] }))
    labeled = checkRepeats(labeled)

    if (!name) name = trimNameFromString(labeled[0].text)

    let layoutID: string = uid()
    let show: Show = new ShowObj(false, category, layoutID)
    // , existingSlides
    let { slides, layouts } = createSlides(labeled, noFormatting)

    // if (onlySlides) return { slides, layouts }

    show.name = checkName(name)
    show.slides = slides
    show.layouts[layoutID].slides = layouts

    if (ccli) {
        let meta: string[] = ccli.split("\n")
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
                copyright: meta[2],
            }
        } else {
            show.meta = {
                title: show.name,
                CCLI: meta[0].substring(meta[0].indexOf("#") + 2),
                artist: meta[1],
                author: meta[2],
                composer: meta[3],
                publisher: meta[1],
                copyright: meta[4],
            }
        }
    }

    if (returnData) return show

    history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } })

    return show
}

export function trimNameFromString(text: string) {
    if (!text?.length) return ""

    let txt = text.split("\n")
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

// TODO: this sometimes splits all slides up with no children (when adding [group])
// , existingSlides = {}
function createSlides(labeled: { type: string; text: string }[], noFormatting) {
    let slides: { [key: string]: Slide } = {}
    let layouts: SlideData[] = []

    let activeGroup: { type: string; id: string } | null = null
    let addedChildren: { [key: string]: string[] } = {}
    labeled.forEach(convertLabeledSlides)

    // add children
    Object.entries(addedChildren).forEach(([parentId, children]) => {
        slides[parentId].children = [...(slides[parentId].children || []), ...(children || [])]
    })

    return removeSlideDuplicates(slides, layouts)

    function convertLabeledSlides(a: { type: string; text: string }): void {
        let id: string = ""
        let formatText: boolean = noFormatting ? false : get(formatNewShow)
        let autoGroups: boolean = get(special).autoGroups !== false

        let text: string = fixText(a.text, formatText)
        // this only accounted for the parent slide, so if the same group was placed multiple times with different children that would be replaced & all "duplicate" children would be removed!
        // if (stored[a.type]) id = stored[a.type].find((b) => b.text === text)?.id

        let hasTextGroup: boolean = (a.text.trim()[0] === "[" && a.text.includes("]")) || a.text.trim()[a.text.length - 1] === ":"

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
        let color: string | null = null

        let allLines: string[] = [text]
        let lines = text.split("\n").filter(Boolean)

        // split lines into a set amount of lines
        if (Number(get(splitLines)) && lines.length > get(splitLines)) {
            allLines = []
            while (lines.length) allLines.push(lines.splice(0, get(splitLines)).join("\n"))
        }

        let children: string[] = []

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
                let activeItems = clone(_show().slides().items().get()[0])

                // replace values
                items = items
                    // .filter((a) => !a.type || a.type === "text" || a.lines)
                    .map((item) => {
                        item.lines?.forEach((_, index) => {
                            item.lines![index].text[0].style = activeItems?.[0]?.lines?.[0]?.text?.[0]?.style || ""
                        })
                        return item
                    })
            }

            // remove empty items
            let textLength = items.reduce((value, item) => (value += getItemText(item).length), 0)
            if (!textLength) items = []

            // extract chords (chordpro)
            items = items.map((item) => {
                item.lines?.forEach((line) => {
                    let chords: Chords[] = []
                    let letterIndex: number = 0
                    let isChord: boolean = false

                    line?.text?.forEach((text) => {
                        let newValue = ""
                        text.value?.split("").forEach((char) => {
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

                let childId: string = uid()
                children.push(childId)
                slides[childId] = { group: null, color: null, settings: {}, notes: "", items }
                return
            }

            // a.text.split("\n").forEach((text: string) => {})
            let slide: Slide = { group, color, settings: {}, notes: "", items }
            if (group) slide.globalGroup = group
            slides[id] = slide
        }
    }
}

function removeSlideDuplicates(slides: { [key: string]: Slide }, layouts: SlideData[]) {
    let slideTextCache: { [key: string]: string } = {}
    let replaceSlides: { [key: string]: string } = {}

    Object.entries(slides).forEach(([slideId, slide]) => {
        if (slide.group === null) return

        let text = getSlideText(slide)
        text += slide.children?.reduce((value, childId) => (value += getSlideText(slides[childId])), "") || ""

        let exists = Object.keys(slideTextCache).find((id) => slideTextCache[id] === text)
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
    slideLines = slideLines.filter((a) => !a.startsWith("{") && !a.endsWith("}"))

    let items: Item[] = linesToTextboxes(slideLines)

    return items
}

function checkRepeats(labeled: { type: string; text: string }[]) {
    let newLabels: { type: string; text: string }[] = []
    labeled.forEach((a) => {
        let match = a.text.match(/\nx[0-9]/)
        if (match !== null && match.index !== undefined) {
            let repeatNumber = a.text.slice(match.index + 2, match.index + 4).replace(/[A-Z]/gi, "")
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
            let repeated = text.slice(firstRepeater + 3, secondRepeater)
            text = text.slice(0, firstRepeater) + repeated + repeated + text.slice(secondRepeater + 3)

            firstRepeater = text.indexOf(":/:")
            secondRepeater = text.indexOf(":/:", firstRepeater + 1)
        }

        let newText: string = ""
        const commaDividerMinLength = 22 // shouldn't be much less
        text.split("\n").forEach((t: string) => {
            let newLineText: string = ""

            // commas inside line
            let commas = t.split(",").filter(Boolean)
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
        lines = lines.map((line) => {
            line = line.trim()
            // make first char uppercase
            line = (line[0]?.toUpperCase() || "") + line.slice(1, line.length)
            // replace at the end of the line
            line = line.replace(/[.,!]*$/g, "")

            return line.trim()
        })
    }

    let label: string = getLabelId(lines[0])

    // remove first line if it's a label
    if (findGroupMatch(label)) lines = lines.slice(1, lines.length)

    text = lines.filter((a) => a).join("\n")

    return text
}

//

let similarityNum: number = 0.7

function findPatterns(sections: string[]) {
    let similarCount: { matches: number[]; count: 0 }[] = []
    // total count of totally different slides
    let totalMatches: number = 0
    sections.forEach(countMatchingSections)

    // let totalMatches = similarCount.filter((a) => a > 0).length
    let matches: number = 0
    let stored: { type: string; text: string }[] = []
    let indexes = similarCount.map(getIndexes)

    return { sections, indexes }

    function countMatchingSections(a: string, i: number) {
        similarCount[i] = { matches: [], count: 0 }

        let alreadyCounted = similarCount.find((a) => a.matches.includes(i))
        if (alreadyCounted) {
            similarCount[i] = alreadyCounted
            return
        }

        sections.forEach(count)
        if (similarCount[i].count > 0) totalMatches++

        function count(b: string, j: number) {
            if (i === j || similarityNum > similarity(a, b)) return
            similarCount[i].count++
            similarCount[i].matches.push(j)
        }
    }

    function getIndexes(a: { matches: number[]; count: 0 }, i: number): string {
        // let lines = sections[i].split("\n")
        let splitted: string[] = sections[i].split("\n").filter((a) => a.length)
        let length: number = sections[i].replaceAll("\n", "").length
        let find = stored.find((a) => similarity(a.text, sections[i]) > similarityNum)

        // TODO: repeat x6
        // TODO: labels in text
        // TODO: frihet, the blessing
        // verses repeat..., bridge repeat

        // if (lines.length < 2) group =  "break"
        if (find) return find.type
        if (!length) return "break"

        // TODO: group....
        let name = getLabelId(splitted[0])
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
            let group = splitted[0].replace(/\d+/g, "").trim()
            return get(groups)[group.toLowerCase()] ? group.toLowerCase() : splitted[0]
        }
        if (a.count > 0) {
            let groups = ["pre_chorus", "chorus", "bridge", "bridge", "bridge"]
            matches++
            let group = groups[matches]
            if (totalMatches > 2) group = groups[matches - 1] || "other"
            stored.push({ type: group, text: sections[i] })
            return group
        }

        return "verse"
    }
}

function linesSimilarity(text: string): boolean {
    let lines = text.split("\n")
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
    var longer = s1
    var shorter = s2
    if (s1.length < s2.length) {
        longer = s2
        shorter = s1
    }
    var longerLength: number = longer.length
    if (longerLength == 0) {
        return 1.0
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString())
}

function editDistance(s1: string, s2: string) {
    s1 = s1.toLowerCase()
    s2 = s2.toLowerCase()

    var costs = new Array()
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j
            else {
                if (j > 0) {
                    var newValue = costs[j - 1]
                    if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
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

    let groupMatch: string = ""
    Object.entries(get(dictionary).groups || {}).forEach(([id, value]) => {
        if (value.toLowerCase() === group) groupMatch = id
    })
    if (groupMatch) return groupMatch

    return ""
}
