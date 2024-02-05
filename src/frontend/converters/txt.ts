import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { getItemText } from "../components/edit/scripts/textStyle"
import { clone, removeEmpty } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { checkName, getLabelId } from "../components/helpers/show"
import { _show } from "../components/helpers/shows"
import { activeProject, dictionary, formatNewShow, groups, splitLines } from "../stores"

export function getQuickExample() {
    let line = get(dictionary).create_show?.quick_lyrics_example_text || "Line"
    let verse = get(dictionary).groups?.verse || "Verse"
    let chorus = get(dictionary).groups?.chorus || "Chorus"

    // [Verse]\nLine 1\nLine 2\n\nLine 3\nLine 4\n\n[Chorus]\nLine 1\nLine 2\nx2
    return `[${verse}]\n${line} 1\n${line} 2\n\n${line} 3\n${line} 4\n\n[${chorus}]\n${line} 1\n${line} 2\nx2`
}

// convert .txt files to shows
export function convertTexts(files: any[]) {
    files.forEach(({ name, content }) => convertText({ name, text: content, noFormatting: true }))

    // WIP setTempShows(tempShows)
}

// convert a plain text input into a show
export function convertText({ name = "", category = null, text, noFormatting = false }: any, onlySlides: boolean = false, { existingSlides } = { existingSlides: {} }) {
    text = text.replaceAll("\r", "").replaceAll("\n \n", "\n\n")
    let sections: string[] = removeEmpty(text.split("\n\n"))

    // get ccli
    let ccli: string = ""
    if (sections[sections.length - 1].includes("www.ccli.com")) {
        ccli = sections.pop()!
    }

    let labeled: any[] = []

    // find chorus phrase
    let patterns = findPatterns(sections)
    sections = patterns.sections
    labeled = patterns.indexes.map((a, i) => ({ type: a, text: sections[i] }))
    labeled = checkRepeats(labeled)

    if (!name) {
        let firstSlideText = labeled[0].text.split("\n")
        name = firstSlideText[0]
        if (firstSlideText.length > 1 && (name.includes("[") || name.includes(":"))) name = firstSlideText[1]
    }

    let layoutID: string = uid()
    let show: Show = new ShowObj(false, category, layoutID)
    let { slides, layouts } = createSlides(labeled, existingSlides, noFormatting)

    if (onlySlides) return { slides, layouts }

    show.name = checkName(name)
    show.slides = slides
    show.layouts[layoutID].slides = layouts

    if (ccli) {
        let meta: string[] = ccli.split("\n")
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

    history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, location: { page: "show", id: "show" } })

    return show
}

// TODO: this sometimes splits all slides up with no children (when adding [group])
function createSlides(labeled: any, existingSlides: any = {}, noFormatting) {
    let slides: any = existingSlides
    let layouts: any[] = []
    let stored: any = initializeStoredSlides()
    function initializeStoredSlides() {
        return {}
        // WIP add existing to stored to prevent duplicates
    }

    let activeGroup: any = null
    let addedChildren: any = {}
    labeled.forEach(convertLabeledSlides)

    // add children
    Object.entries(addedChildren).forEach(([parentId, children]: any) => {
        slides[parentId].children = [...(slides[parentId].children || []), ...(children || [])]
    })

    return { slides, layouts }

    function convertLabeledSlides(a: any): void {
        let id: any
        let formatText: boolean = noFormatting ? false : get(formatNewShow)

        let text: string = fixText(a.text, formatText)
        if (stored[a.type]) id = stored[a.type].find((b: any) => b.text === text)?.id

        let hasTextGroup: boolean = (a.text.trim()[0] === "[" && a.text.includes("]")) || a.text.trim()[a.text.length - 1] === ":"

        if (id) {
            if (activeGroup && !hasTextGroup) return

            layouts.push({ id })
            return
        }

        id = uid()

        if (hasTextGroup) activeGroup = { type: a.type, id }

        // remember this
        if (!stored[a.type]) stored[a.type] = []
        stored[a.type].push({ id, text })

        let group: string = activeGroup && !hasTextGroup ? null : a.type
        if (!formatText && !hasTextGroup && group) group = "verse"
        let color: any = null

        let allLines: string[] = [text]
        let lines: string[] = removeEmpty(text.split("\n"))

        // split lines into a set amount of lines
        if (formatText && Number(get(splitLines)) && lines.length > get(splitLines)) {
            allLines = []
            while (lines.length) allLines.push(lines.splice(0, get(splitLines)).join("\n"))
        }

        let children: string[] = []

        allLines.forEach(createSlide)

        // set as child
        if (group === null) {
            if (!addedChildren[activeGroup.id]) addedChildren[activeGroup.id] = []
            addedChildren[activeGroup.id].push(...[id, ...children])
        } else {
            if (children.length) slides[id].children = children

            layouts.push({ id })
        }

        function createSlide(lines: any, slideIndex: number) {
            lines = lines.split("\n").map((a: string) => ({ align: "", text: [{ style: "", value: a }] }))
            let defaultItemStyle: string = "top:120px;left:50px;height:840px;width:1820px;"
            let items: any[] = [{ style: defaultItemStyle, lines }] // auto: true

            // get active show
            if (_show().get()) {
                let activeItems = clone(_show().slides().items().get()[0])

                // replace values
                items = items
                    // .filter((a: any) => !a.type || a.type === "text" || a.lines)
                    .map((item: any) => {
                        item.lines?.forEach((_: any, index: number) => {
                            item.lines[index].text[0].style = activeItems?.[0]?.lines?.[0]?.text?.[0]?.style || ""
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
                    let chords: any[] = []
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
                let childId: string = uid()
                children.push(childId)
                slides[childId] = { group: null, color: null, settings: {}, notes: "", items }
                return
            }

            // a.text.split("\n").forEach((text: string) => {})
            slides[id] = { group, color, globalGroup: group, settings: {}, notes: "", items }
        }
    }
}

function checkRepeats(labeled: any[]) {
    let newLabels: any[] = []
    labeled.forEach((a: any) => {
        let match = a.text.match(/\nx[0-9]/)
        if (match !== null) {
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
        text = text.replaceAll(".", "").replace(/ *\([^)]*\) */g, "")
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
    }

    let newText: string = ""
    const commaDividerMinLength = 22 // shouldn't be much less
    text.split("\n").forEach((t: any) => {
        let newLineText: string = ""

        // commas inside line
        let commas: string[] = removeEmpty(t.split(","))
        commas.forEach((a: any, i: number) => {
            newLineText += a

            if (i >= commas.length - 1) newLineText += "\n"
            else if (!formatText) newLineText += ","
            else if (a.length < commaDividerMinLength || (commas[i + 1] && commas[i + 1].length < commaDividerMinLength)) newLineText += ","
            else newLineText += "\n"
        })

        newText += newLineText
    })

    text = newText

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
    let similarCount: any[] = []
    // total count of totally different slides
    let totalMatches: number = 0
    sections.forEach(countMatchingSections)

    // let totalMatches = similarCount.filter((a) => a > 0).length
    let matches: number = 0
    let stored: any[] = []
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

    function getIndexes(a: any, i: number) {
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
    var longerLength: any = longer.length
    if (longerLength == 0) {
        return 1.0
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength)
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
    Object.entries(get(dictionary).groups || {}).forEach(([id, value]: any) => {
        if (value.toLowerCase() === group) groupMatch = id
    })
    if (groupMatch) return groupMatch

    return ""
}
