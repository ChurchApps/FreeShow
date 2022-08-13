import { drawerTabsData, activePopup, groups, dictionary, alertMessage } from "./../stores"
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

const keys = [
  "Abbreviation",
  "Guid",
  "Songs",
  "Text",
  "Verses",
  "Tag",
  "ID",
  "Sequence",
  "VerseOrderIndex",
  "Composer",
  "Author",
  "Copyright",
  "CCLI",
  "Theme",
  "AudioFile",
  "Memo1",
  "Memo2",
  "Memo3",
]
export function convertVideopsalm(data: any) {
  alertMessage.set("popup.importing")
  setTimeout(() => {
    data.forEach(({ content }: any) => {
      // add quotes to the invalid JSON formatting
      if (content.length) {
        content = content
          .replaceAll("{\n", "{")
          .replaceAll("\n", "<br>")
          .split(":")
          .map((a: string) => {
            let index = a.length - 1
            while (a[index]?.match(/[a-z]/i) !== null && index > -1) index--
            let word: string = a.slice(index + 1, a.length)
            let notKey = index < 0 || index >= a.length - 1 || !keys.includes(word)
            if (word === "ID" && !notKey && !a.includes("{ID") && !a.includes(",ID")) notKey = true
            return notKey ? a : a.slice(0, index + 1) + '"' + word + '"'
          })
          .join(":")
          .replaceAll(',<br>"', ',"')

        try {
          content = JSON.parse(content || {}) as VideoPsalm
        } catch (e: any) {
          console.error(e)
          let pos = Number(e.toString().replace(/\D+/g, "") || 50)
          console.log(pos, content.slice(pos - 50, pos + 50))
        }
      }

      let album: string = content?.Text
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
  }, 10)
}

const VPgroups: any = { V: "verse", C: "chorus", B: "bridge", T: "tag", O: "outro" }
function createSlides({ Verses, Sequence, VerseOrderIndex }: Song) {
  console.log(VerseOrderIndex)

  let slides: any = {}
  let layout: any[] = []
  let sequence: string[] = Sequence?.split(" ") || []
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
      let globalGroup = sequence[i] ? VPgroups[sequence[i].replace(/[0-9]/g, "")] : "verse"
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
