import { drawerTabsData, activePopup, groups, dictionary, activeProject } from "./../stores"
import { get } from "svelte/store"
import { ShowObj } from "./../classes/Show"
import { uid } from "uid"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"

interface Song {
  title: string
  modified: string
  verseOrder: string
  authors: {
    type: string
    name: string
  }[]
  lyrics: {
    name: string
    lines: string[]
  }[]
}

export function convertOpenLP(data: any) {
  data?.forEach(({ content }: any) => {
    let song = XMLtoObject(content)

    let category = get(drawerTabsData).shows.activeSubTab
    if (category === "all" || category === "unlabeled") category = null

    let layoutID = uid()
    let show = new ShowObj(false, category || null, layoutID)
    show.name = checkName(song.title)
    if (song.authors) {
      show.meta = {
        title: show.name,
        author: song.authors.find((a) => a.type === "words")?.name || "",
        artist: song.authors.find((a) => a.type === "music")?.name || "",
      }
    }
    show.timestamps = {
      created: new Date().getTime(),
      modified: new Date(song.modified).getTime(),
      used: null,
    }

    let { slides, layout }: any = createSlides(song)

    show.slides = slides
    show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layout } }

    let location: any = { page: "show" }
    if (data.length === 1) location.project = get(activeProject)
    history({ id: "newShow", newData: { show }, location })
  })
  activePopup.set(null)
}

const OLPgroups: any = { V: "verse", C: "chorus", B: "bridge", T: "tag", O: "outro" }
function createSlides({ verseOrder, lyrics }: Song) {
  let slides: any = {}
  let layout: any[] = []
  let sequence: string[] = verseOrder.split(" ")
  let sequences: any = {}
  lyrics.forEach((verse) => {
    if (verse.lines) {
      let id: string = uid()
      if (verse.name) sequences[verse.name] = id
      layout.push({ id })
      let items = [
        {
          style: "left:50px;top:120px;width:1820px;height:840px;",
          lines: verse.lines.map((a: any) => ({ align: "", text: [{ style: "", value: a }] })),
        },
      ]
      slides[id] = {
        group: "",
        color: null,
        settings: {},
        notes: "",
        items,
      }
      let globalGroup = OLPgroups[verse.name.replace(/[0-9]/g, "").toUpperCase()]
      if (get(groups)[globalGroup]) slides[id].globalGroup = globalGroup
    }
  })
  if (sequence.length) {
    layout = []
    sequence.forEach((group) => {
      if (sequences[group]) layout.push({ id: sequences[group] })
    })
  }

  return { slides, layout }
}

function XMLtoObject(xml: string) {
  let parser = new DOMParser()
  let xmlDoc = parser.parseFromString(xml, "text/xml").children[0]

  let properties = getChild(xmlDoc, "properties")
  let lyrics = getChild(xmlDoc, "lyrics")

  let object: Song = {
    title: getChild(getChild(properties, "titles"), "title").textContent!,
    modified: xmlDoc.getAttribute("modifiedDate")!,
    verseOrder: getChild(properties, "verseOrder").textContent!,
    authors: [...getChild(properties, "authors").children].map((a: any) => ({ type: a.getAttribute("type"), name: a.textContent })),
    lyrics: [...lyrics.getElementsByTagName("verse")].map((verse) => ({
      name: verse.getAttribute("name")!,
      lines: getChild(verse, "lines")?.innerHTML.toString()?.split('<br xmlns="http://openlyrics.info/namespace/2009/song"/>'),
    })),
  }

  return object
}

const getChild = (parent: any, name: string) => parent.getElementsByTagName(name)[0]
