import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { clone, removeEmpty } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { checkName, getLabelId } from "../components/helpers/show"
import { _show } from "../components/helpers/shows"
import { activeProject, formatNewShow, groups, splitLines } from "../stores"

// convert .txt files to shows
export function convertTexts(files: any[]) {
  files.forEach(({ name, content }) => convertText({ name, text: content }))
}

// convert a plain text input into a show
export function convertText({ name = "", category = null, text }: any) {
  text = text.replaceAll("\r", "")
  let sections: string[] = removeEmpty(text.split("\n\n"))

  let labeled: any[] = []

  // find chorus phrase
  let patterns = findPatterns(sections)
  sections = patterns.sections
  labeled = patterns.indexes.map((a, i) => ({ type: a, text: sections[i] }))
  labeled = checkRepeats(labeled)

  if (!name) name = labeled[0].text.split("\n")[0]

  let layoutID: string = uid()
  let show: Show = new ShowObj(false, category, layoutID)
  let { slides, layouts } = createSlides(labeled)

  show.name = checkName(name)
  show.slides = slides
  show.layouts[layoutID].slides = layouts

  history({ id: "newShow", newData: { show }, location: { page: "show", project: get(activeProject) } })
}

function createSlides(labeled: any) {
  let slides: any = {}
  let layouts: any[] = []
  let stored: any = {}

  labeled.forEach(convertLabeledSlides)

  return { slides, layouts }

  function convertLabeledSlides(a: any): void {
    let id: any
    let text: string = fixText(a.text)
    if (stored[a.type]) id = stored[a.type].find((b: any) => b.text === text)?.id

    if (id) {
      layouts.push({ id })
      return
    }

    id = uid()

    // remember this
    if (!stored[a.type]) stored[a.type] = []
    stored[a.type].push({ id, text })

    let group: string = a.type
    let color: any = null

    let allLines: string[] = [text]
    let lines: string[] = removeEmpty(text.split("\n"))

    // split lines into a set amount of lines
    if (lines.length > get(splitLines)) {
      allLines = []
      while (lines.length) allLines.push(lines.splice(0, get(splitLines)).join("\n"))
    }

    let children: string[] = []

    allLines.forEach(createSlide)

    if (children.length) slides[id].children = children

    layouts.push({ id })

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
              item.lines[index].text[0].style = activeItems[0]?.lines[index]?.text[0]?.style || ""
            })
            return item
          })
      }

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

function fixText(text: string): string {
  let formatText: boolean = get(formatNewShow)
  if (formatText) text = text.replaceAll(".", "").replace(/ *\([^)]*\) */g, "")

  let newText: string = ""
  text.split("\n").forEach((t: any) => {
    let newLineText: string = ""
    if (formatText) {
      // make first char uppercase
      t = (t[0]?.toUpperCase() || "") + t.slice(1, t.length)
      // replace at the end of the line
      t = t.replace(/[.,!]*$/g, "").trim()
    }

    // commas inside line
    let commas: string[] = removeEmpty(t.split(","))
    commas.forEach((a: any, i: number) => {
      newLineText += a

      if (i >= commas.length - 1) newLineText += "\n"
      else if (!formatText) newLineText += ","
      else if (a.length < 10 || (commas[i + 1] && commas[i + 1].length < 10)) newLineText += ","
      else newLineText += "\n"
    })

    newText += newLineText
  })

  text = newText

  let lines: string[] = text.split("\n")
  let label: string = getLabelId(lines[0])

  // remove first line if it's a label
  if (get(groups)[label]) lines = lines.slice(1, lines.length)

  text = lines.join("\n")

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
  console.log(indexes)

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
    let splitted: string[] = sections[i].split("\n")
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
    console.log(name)
    if (get(groups)[name]) return name
    // TODO: remove numbers....
    console.log(splitted[0].match(/\[[^\]]*]/g))
    if ((splitted[0].match(/\[[^\]]*]/g)?.[0] || "").length === splitted[0].length)
      return splitted[0]
        .replace(/[\[\]']+/g, "")
        .replace(/x[0-9]/g, "")
        .replace(/[0-9]/g, "")
    // if (length < 10 && !sections[i].includes("\n")) return sections[i].trim()
    if (length < 30 || linesSimilarity(sections[i])) return "tag"
    if (splitted[0].length < 15 && splitted[1].length > 20) {
      // console.log(sections[i], splitted.slice(1, splitted.length))
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
function similarity(s1: string, s2: string) {
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
