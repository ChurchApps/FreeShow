import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
import { activeProject, dictionary, groups } from "../stores"

export function convertText({ name = "", category = null, text }: any) {
  console.log(name, category, text)
  text = text.replaceAll("\r", "")
  let sections = text.split("\n\n").filter((a: any) => a.length)
  console.log(sections)

  let labeled: any[] = []

  // find chorus phrase
  let patterns = findPatterns(sections)
  sections = patterns.sections
  labeled = patterns.indexes.map((a, i) => ({ type: a, text: sections[i] }))

  if (!name) name = labeled[0].text.split("\n")[0]
  // get active
  let meta: any = {}
  // if (metaData.length) {
  //   let lines: string[] = metaData.split("\n")
  //   meta.title = lines.splice(0, 1)[0]
  //   if (meta.title.length) name = meta.title
  //   if (lines.length) meta.artist = lines.splice(0, 1)[0]
  //   if (lines.length) meta.other = lines.join("\n")
  // }

  let layoutID = uid()
  let show: Show = new ShowObj(false, category, layoutID)
  show.name = checkName(name)
  show.meta = meta
  let { slides, layouts } = createSlides(labeled)
  show.slides = slides
  show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layouts } }
  // let newData: any = {name, category, settings: {}, meta}
  history({ id: "newShow", newData: { show }, location: { page: "show", project: get(activeProject) } })
}

function createSlides(labeled: any) {
  let slides: any = {}
  let layouts: any[] = []
  let stored: any = {}
  repeat(labeled).forEach((a: any) => {
    let id: any
    let text: string = fixText(a.text)
    if (stored[a.type]) {
      id = stored[a.type].find((b: any) => b.text === text)?.id
    }

    if (!id) {
      id = uid()
      if (!stored[a.type]) stored[a.type] = []
      stored[a.type].push({ id, text })

      let group: string = a.type
      let color: any = null

      let allLines: string[] = [text]
      let lines = text.split("\n").filter((a) => a.length)

      let length: number = text.replaceAll("\n", "").length
      if ((length < 20 && lines.length >= 6) || (length >= 20 && lines.length >= 4)) {
        allLines = []
        let divided = Math.floor(lines.length / 2)
        if (lines.length < 7) divided = Math.ceil(lines.length / 2)
        // while (divided > 4) divided = Math.floor(divided / 2)
        while (lines.length) {
          allLines.push(lines.splice(0, divided).join("\n"))
          if (lines.length > 4) divided = Math.ceil(lines.length / 2)
          // allLines.push(lines.splice(0, Math.max(2, Math.floor(lines.length / 2))).join("\n"))
        }
      }

      let children: string[] = []

      allLines.forEach((lines: string, i: number) => {
        // TODO: auto size
        let style = "font-size: 80px;"
        let items: any[] = [{ style: "left:50px;top:120px;width:1820px;height:840px;", lines: lines.split("\n").map((a) => ({ align: "", text: [{ style, value: a }] })) }]

        let childID: any
        if (i > 0) {
          childID = uid(12)
          children.push(childID)
          slides[childID] = { group: null, color: null, settings: {}, notes: "", items }
        } else {
          // a.text.split("\n").forEach((text: string) => {})
          slides[id] = { group, color, globalGroup: group, settings: {}, notes: "", items }
        }
      })
      if (children.length) slides[id].children = children
    }

    layouts.push({ id })
  })
  return { slides, layouts }
}

function repeat(labeled: any[]) {
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
  text = text.replaceAll(".", "").replace(/ *\([^)]*\) */g, "")
  // let splittedCommas = text.replaceAll(",", "\n")
  let newText = ""
  text.split("\n").forEach((t: any) => {
    console.log(t)
    let newLineText = ""
    t.split(",").forEach((a: any, i: number) => {
      console.log(a)
      newLineText += a
      if (i < t.split(",").length - 1 && newLineText.length < 10 && (a.length < 10 || t.split(",")[i]?.length < 10)) newLineText += ","
      else newLineText += "\n"
    })
    newText += newLineText
  })
  text = newText

  let splitted = text.split("\n")
  let label = splitted[0]
    .toLowerCase()
    .replace(/x[0-9]/g, "")
    .replace(/[0-9]/g, "")
    .replace(/[[\]]/g, "")
    .trim()
    .replaceAll(" ", "_")
  console.log(label)

  if (get(groups)[label]) splitted = splitted.slice(1, splitted.length)
  text = splitted.join("\n")

  text = text
    .split("\n")
    .map((a) => {
      a = a.trim()
      a = (a[0]?.toUpperCase() || "") + a.slice(1, a.length)
      return a
    })
    .join("\n")
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
    let name = splitted[0]
      .toLowerCase()
      .replace(/x[0-9]/g, "")
      .replace(/[0-9]/g, "")
      .replace(/[[\]]/g, "")
      .trim()
      .replaceAll(" ", "_")
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
