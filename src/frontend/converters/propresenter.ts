import { drawerTabsData, activePopup, groups as globalGroups } from "./../stores"
import { get } from "svelte/store"
import { ShowObj } from "./../classes/Show"
import { uid } from "uid"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
// import { Buffer } from "buffer"

interface Song {
  metadata: MetaData
  timeline: Timeline
  groups: {
    [key: string]: Group
  }
  arrangements: {
    [key: string]: Arrangement
  }
}

interface MetaData {
  CCLIArtistCredits: string
  CCLIAuthor: string
  CCLICopyrightYear: string
  CCLIDisplay: boolean
  CCLIPublisher: string
  CCLISongNumber: number
  CCLISongTitle: string
  backgroundColor: string
  buildNumber: string
  category: string
  chordChartPath: string
  docType: number
  drawingBackgroundColor: boolean
  height: number
  lastDateUsed: string
  notes: string
  os: number
  resourcesDirectory: string
  selectedArrangementID: string
  usedCount: number
  uuid: string
  versionNumber: number
  width: number
}

interface Timeline {
  duration: number
  loop: boolean
  playBackRate: number
  // selectedMediaTrackIndex: number
  timeOffset: number
  timeCues: any
  mediaTracks: any
}

interface Group {
  color: string
  name: string
  slides: {
    [key: string]: Slide
  }
}
interface Slide {
  backgroundColor: string
  // chordChartPath: string
  drawingBackgroundColor: boolean
  enabled: boolean
  // highlightColor: string
  // hotKey: string
  label: string
  notes: string
  // socialItemCount: number
  cues: any
  mediaCue: MediaCue
  displayElements: Element[]
}
interface MediaCue {
  actionType: number
  alignment: number
  behavior: number
  dateAdded: string
  delayTime: number
  displayName: string
  enabled: boolean
  nextCueUUID: string
  // rvXMLIvarName: string
  tags: string
  timeStamp: number
  video?: {
    [key: string]: VideoCue
  }
}
interface VideoCue {
  audioVolume: number
  bezelRadius: number
  displayDelay: number
  displayName: string
  drawingFill: boolean
  drawingShadow: boolean
  drawingStroke: boolean
  endPoint: number
  fieldType: number
  fillColor: string
  flippedHorizontally: boolean
  flippedVertically: boolean
  format: string
  frameRate: number
  fromTemplate: boolean
  imageOffset: string
  inPoint: number
  locked: boolean
  manufactureName: string
  manufactureURL: string
  naturalSize: string
  opacity: number
  outPoint: number
  persistent: boolean
  playRate: number
  playbackBehavior: number
  rotation: number
  rvXMLIvarName: string
  scaleBehavior: number
  scaleSize: string
  source: string
  timeScale: number
  typeID: number
}
interface Element {
  additionalLineFillHeight: number
  adjustsHeightToFit: boolean
  bezelRadius: number
  displayDelay: number
  displayName: string
  drawLineBackground: boolean
  drawingFill: boolean
  drawingShadow: boolean
  drawingStroke: boolean
  fillColor: string
  fromTemplate: boolean
  lineBackgroundType: number
  lineFillVerticalOffset: number
  locked: boolean
  opacity: number
  persistent: boolean
  revealType: number
  rotation: number
  source: string
  textSourceRemoveLineReturnsOption: boolean
  typeID: number
  useAllCaps: boolean
  verticalAlignment: number
  position: {
    top: number
    left: number
    rotation: number
    width: number
    height: number
  }
  shadow: any
  stroke: any
  RTFData: string
}

interface Arrangement {
  color: string
  name: string
  groupIDs: string[]
}

export function convertProPresenter(data: any) {
  data?.forEach(({ content, name }: any) => {
    let song = RVPresentationDocumentToObject(content)
    console.log(song)

    let category = get(drawerTabsData).shows.activeSubTab
    if (category === "all" || category === "unlabeled") category = null

    let layoutID = uid()
    let show = new ShowObj(false, category || null, layoutID)
    show.name = checkName(name)
    // if (song.authors) {
    //   show.meta = {
    //     title: show.name,
    //     author: song.authors.find((a) => a.type === "words")?.name || "",
    //     artist: song.authors.find((a) => a.type === "music")?.name || "",
    //   }
    // }
    // show.timestamps = {
    //   created: new Date().getTime(),
    //   modified: new Date(song.modified).getTime(),
    //   used: null,
    // }

    let { slides, layouts }: any = createSlides(song)

    show.slides = slides
    show.layouts = {}
    layouts.forEach((layout: any, i: number) => {
      show.layouts[i === 0 ? layoutID : layout.id] = { name: layout.name, notes: i === 0 ? song.metadata.notes || "" : "", slides: layout.slides }
    })

    history({ id: "newShow", newData: { show }, location: { page: "show" } })
  })
  activePopup.set(null)
}

function createSlides({ groups, arrangements }: Song) {
  let slides: any = {}
  let layouts: any[] = [{ id: null, name: "", slides: [] }]
  let sequences: any = {}
  Object.entries(groups).forEach(([groupId, group]) => {
    if (group.slides) {
      Object.values(group.slides).forEach((slide: Slide, i: number) => {
        let id: string = uid()
        let items: any[] = []
        // TODO: elements
        console.log(slide.displayElements)
        if (slide.displayElements[0]?.RTFData) {
          items = [
            {
              style: "left:50px;top:120px;width:1820px;height:840px;",
              lines: formatRTF(slide.displayElements[0].RTFData),
            },
          ]
        }
        slides[id] = {
          group: null,
          color: null,
          settings: {},
          notes: "",
          items,
        }
        if (i === 0) {
          slides[id].group = group.name
          slides[id].color = getColor(group.color)
          sequences[groupId] = id
          let l: any = { id }
          if (slide.enabled.toString() === "false") l.disabled = true
          layouts[0].slides.push(l)

          let globalGroup = group.name?.replace(/[0-9]/g, "").trim().toLowerCase()
          if (get(globalGroups)[globalGroup]) slides[id].globalGroup = globalGroup
        } else {
          let parentLayout = layouts[0].slides[layouts[0].slides.length - 1]
          let parentSlide = slides[parentLayout.id]
          if (!parentSlide.children) parentSlide.children = []
          parentSlide.children.push(id)
          if (slide.enabled.toString() === "false") {
            if (!parentLayout.children) parentLayout.children = {}
            parentLayout.children[id] = { disabled: true }
          }
        }
      })
    }
  })
  if (Object.keys(arrangements).length) {
    layouts = []
    Object.values(arrangements).forEach((arrangement) => {
      let slides: any[] = arrangement.groupIDs.map((groupID) => ({ id: sequences[groupID] }))
      layouts.push({ id: uid(), name: arrangement.name, slides })
    })
  }

  return { slides, layouts }
}

function RVPresentationDocumentToObject(xml: string) {
  let parser = new DOMParser()
  let xmlDoc = parser.parseFromString(xml, "text/xml").children[0]

  let timelineElem = xmlDoc.querySelector('[rvXMLIvarName="timeline"]')
  let groupsElem = xmlDoc.querySelector('[rvXMLIvarName="groups"]')
  let arrangementsElem = xmlDoc.querySelector('[rvXMLIvarName="arrangements"]')

  let metadata = setKeysFromAttributes(xmlDoc, [
    "CCLIArtistCredits",
    "CCLIAuthor",
    "CCLICopyrightYear",
    "CCLIDisplay",
    "CCLIPublisher",
    "CCLISongNumber",
    "CCLISongTitle",
    "backgroundColor",
    "buildNumber",
    "category",
    "chordChartPath",
    "docType",
    "drawingBackgroundColor",
    "height",
    "lastDateUsed",
    "notes",
    "os",
    "resourcesDirectory",
    "selectedArrangementID",
    "usedCount",
    "uuid",
    "versionNumber",
    "width",
  ])

  let timeline: Timeline = setKeysFromAttributes(timelineElem, ["duration", "loop", "playBackRate", "timeOffset", "timeCues", "mediaTracks"])

  let groups: { [key: string]: Group } = {}
  ;[...groupsElem!.children].forEach((groupElem) => {
    let uuid = groupElem.getAttribute("uuid")!
    let group: Group = setKeysFromAttributes(groupElem, ["color", "name"])
    console.log(groupElem.querySelector('[rvXMLIvarName="slides"]')?.children || [])

    group.slides = getSlides([...(groupElem.querySelector('[rvXMLIvarName="slides"]')?.children || [])])
    groups[uuid] = group
  })

  let arrangements: { [key: string]: Arrangement } = {}
  ;[...arrangementsElem!.children].forEach((elem) => {
    let uuid = elem.getAttribute("uuid")!
    let arrangement: Arrangement = setKeysFromAttributes(elem, ["color", "name"])
    console.log(elem.querySelector('[rvXMLIvarName="groupIDs"]')?.children || [])

    arrangement.groupIDs = [...(elem.querySelector('[rvXMLIvarName="groupIDs"]')?.children || [])].map((a) => a.textContent!)
    arrangements[uuid] = arrangement
  })

  console.log(timeline)
  console.log(groups)
  console.log(arrangements)

  let object: Song = {
    metadata,
    timeline,
    groups,
    arrangements,
  }

  return object
}

function getSlides(elems: any[]) {
  let slides: any = {}
  elems.forEach((elem) => {
    let uuid = elem.getAttribute("UUID")
    let slide: Slide = setKeysFromAttributes(elem, ["backgroundColor", "drawingBackgroundColor", "enabled", "label", "notes"])
    slide.cues = elem.querySelector('[rvXMLIvarName="cues"]')
    slide.mediaCue = elem.querySelector('[rvXMLIvarName="backgroundMediaCue"]')
    console.log(elem.querySelector('[rvXMLIvarName="displayElements"]')?.children || [])

    slide.displayElements = getDisplayElements([...(elem.querySelector('[rvXMLIvarName="displayElements"]')?.children || [])])
    slides[uuid] = slide
  })
  return slides
}

function getDisplayElements(elems: any[]) {
  let elements: any = []
  elems.forEach((elem) => {
    let element: Element = setKeysFromAttributes(elem, [
      "additionalLineFillHeight",
      "adjustsHeightToFit",
      "bezelRadius",
      "displayDelay",
      "displayName",
      "drawLineBackground",
      "drawingFill",
      "drawingShadow",
      "drawingStroke",
      "fillColor",
      "fromTemplate",
      "lineBackgroundType",
      "lineFillVerticalOffset",
      "locked",
      "opacity",
      "persistent",
      "revealType",
      "rotation",
      "source",
      "textSourceRemoveLineReturnsOption",
      "typeID",
      "useAllCaps",
      "verticalAlignment",
    ])
    let [top, left, rotation, width, height] = elem.querySelector('[rvXMLIvarName="position"]').textContent.replace(/[{}]/g, "").split(" ")
    element.position = { top, left, rotation, width, height }
    element.shadow = elem.querySelector('[rvXMLIvarName="shadow"]').textContent
    element.shadow = elem.querySelector('[rvXMLIvarName="stroke"]').textContent
    // element.RTFData = Buffer.from(elem.querySelector('[rvXMLIvarName="RTFData"]').textContent, "base64").toString()
    element.RTFData = atob(elem.querySelector('[rvXMLIvarName="RTFData"]').textContent)
    elements.push(element)
  })
  return elements
}

function formatRTF(data: any) {
  // better solution: https://stackoverflow.com/questions/29922771/convert-rtf-to-and-from-plain-text
  let lines: any[] = []
  data = data.split("\n\n")
  console.log(data)
  if (data[1]) {
    data = data[1].split("\n")
    lines = data.map((a: any) => ({ align: "", text: [{ style: "", value: decodeHex(a.slice(0, a.length - 1) || "") }] }))
  }
  return lines
}

function decodeHex(input: string) {
  var hex = input.split("\\'")
  console.log(hex)
  var str = ""
  hex.map((txt, i) => {
    let styles: any[] = []
    let styleIndex = txt.indexOf("\\")
    while (styleIndex >= 0) {
      let nextSpace = txt.indexOf(" ", styleIndex) + 1
      if (nextSpace < 1) nextSpace = txt.length
      styles.push(txt.slice(styleIndex, nextSpace))
      txt = txt.slice(0, styleIndex) + txt.slice(nextSpace, txt.length)
      styleIndex = txt.indexOf("\\")
    }
    console.log(styles)
    if (i === 0) str = txt
    else {
      str += String.fromCharCode(parseInt(txt.slice(0, 2), 16))
      str += txt.slice(2, txt.length)
    }
  })

  return str
}

function getColor(rgbaString: string) {
  let [r, g, b, a]: any = rgbaString.split(" ")
  // TODO: alpha
  console.log(a)
  return `#${toHex(r * 255)}${toHex(g * 255)}${toHex(b * 255)}`
}
const toHex = (c: number) => ("0" + Number(c.toFixed()).toString(16)).slice(-2)

const setKeysFromAttributes = (elem: any, names: string[]) => {
  let obj: any = {}
  names.map((name) => (obj[name] = elem.getAttribute(name)))
  return obj
}
