import { drawerTabsData, activePopup, groups, dictionary } from "./../stores"
import { get } from "svelte/store"
import { ShowObj } from "./../classes/Show"
import { uid } from "uid"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"

interface VideoPsalm {
  Guid: string
  Text: string
  Songs: Song[]
}
interface Song {
  Guid: string
  Text: string
  Verses: {
    Tag: number
    ID: number
    Text: string
  }[]
  Sequence: string
  VerseOrderIndex: number
  Composer: string
  Author: string
  Copyright: string
  CCLI: string
  Theme: string
  AudioFile: string
  Memo1: string
  Memo2: string
  Memo3: string
}

export function convertVideopsalm(data: any) {
  data.forEach(({ content }: any) => {
    let album: string = content?.Text
    // add quotes to the invalid JSON formatting
    if (content.length) {
      content = content
        .split(":")
        .map((a: string) => {
          let index = a.length - 1
          while (a[index]?.match(/[a-z]/i) !== null && index > -1) index--
          return index < 0 || index >= a.length - 1 ? a : a.slice(0, index + 1) + '"' + a.slice(index + 1, a.length) + '"'
        })
        .join(":")
        .replaceAll("\n", "<br>")
        .replaceAll("{<br>", "{")
        .replaceAll(",<br>", ",")
      content = JSON.parse(content || {}) as VideoPsalm
    }
    content.Songs?.forEach((song: Song) => {
      let category = get(drawerTabsData).shows.activeSubTab
      if (category === "all" || category === "unlabeled") category = null

      let layoutID = uid()
      let show = new ShowObj(false, category || null, layoutID)
      show.name = checkName(song.Text) || ""
      show.meta = {
        title: show.name,
        artist: album || "",
        author: song.Author || "",
        composer: song.Composer || "",
        copyright: song.Copyright || "",
        CCLI: song.CCLI || "",
      }

      let { slides, layout }: any = createSlides(song)
      show.slides = slides
      show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layout } }

      history({ id: "newShow", newData: { show }, location: { page: "show" } })
    })
  })
  activePopup.set(null)
}

const VPgroups: any = { V: "verse", C: "chorus", B: "bridge", T: "tag", O: "outro" }
function createSlides({ Verses, Sequence, VerseOrderIndex }: Song) {
  console.log(VerseOrderIndex)

  let slides: any = {}
  let layout: any[] = []
  let sequence: string[] = Sequence.split(" ")
  let sequences: any = {}
  Verses.forEach((verse, i) => {
    if (verse.Text) {
      let id: string = uid()
      if (sequence[i]) sequences[sequence[i]] = id
      layout.push({ id })
      let items = [
        {
          style: "left:50px;top:120px;width:1820px;height:840px;",
          lines: verse.Text.split("<br>").map((a: any) => ({ align: "", text: [{ style: "", value: a }] })),
        },
      ]
      // TODO: chords \[.*?\]
      slides[id] = {
        group: "",
        color: null,
        settings: {},
        notes: "",
        items,
      }
      let globalGroup = VPgroups[sequence[i].replace(/[0-9]/g, "")]
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
