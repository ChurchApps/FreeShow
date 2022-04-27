import { drawerTabsData, activePopup, groups, alertMessage } from "./../stores"
import { get } from "svelte/store"
import { ShowObj } from "./../classes/Show"
import { uid } from "uid"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"

interface Song {
  administrator: string
  author: string
  copyright: string
  description: string
  layout_revision: number
  presentation_id: number
  reference_number: string
  revision: number
  rowid: number
  song_item_uid: string
  song_rev_uid: string
  song_uid: string
  tags: string
  title: string
  vendor_id: number
}
interface Words {
  rowid: number
  slide_layout_revisions: null
  slide_revisions: null
  slide_uids: string
  song_id: number
  words: string
}

export function convertEasyWorship(data: any) {
  let songs = data.find((a: any) => a.content.song)?.content.song
  let songsWords = data.find((a: any) => a.content.word)?.content.word
  if (!songsWords) {
    alertMessage.set("Missing SongsWords.db file.")
    return
  }
  songsWords?.forEach((words: Words, i: number) => {
    // alertMessage.set("Importing: " + song.title + "...")
    let song: Song | null = songs?.[i] || null
    let category = get(drawerTabsData).shows.activeSubTab
    if (category === "all" || category === "unlabeled") category = null

    let layoutID = uid()
    let show = new ShowObj(false, category || null, layoutID)
    if (song) {
      show.meta = {
        title: song?.title || "",
        author: song.author || "",
        copyright: song.copyright || "",
      }
    }

    let { slides, layout }: any = createSlides(words)

    show.slides = slides
    show.layouts = { [layoutID]: { name: "", notes: song?.description || "", slides: layout } }
    show.name = checkName(song?.title || (Object.values(slides) as any)[0].items[0].lines?.[0].text?.[0].value)

    history({ id: "newShow", newData: { show }, location: { page: "show" } })
  })
  activePopup.set(null)
  // console.log(songs)
  // console.log(songsWords)
}

function createSlides({ words }: Words) {
  let slides: any = {}
  let layout: any[] = []

  // format
  let newSlides: any[] = []
  let lines: any[] = []

  // .replaceAll('"', '\\"')
  words = words.replaceAll("\\", "").replaceAll("\r\n", "")
  words = words.slice(words.indexOf("pardli0fi0ri0sb0slsa0") + 21, words.lastIndexOf("}"))
  if (words.charAt(words.length - 2) === "}") words = words.slice(0, words.length - 1)

  words?.split("li0fi0ri0sb0slsa0 ").forEach((text: any) => {
    if (text.includes("plainf1fntnamaut")) {
      let sliced: string = text.slice(text.indexOf("t ") + 2, text.lastIndexOf("par"))
      lines.push(sliced.trim())
    } else {
      newSlides.push(lines)
      lines = []
    }
  })
  if (lines.length) newSlides.push(lines)

  newSlides?.forEach((lines: any) => {
    if (lines.length) {
      let id: string = uid()
      let group = lines.splice(0, 1)[0].replace(/[0-9]/g, "").toLowerCase().trim()

      layout.push({ id })
      let items = [
        {
          style: "left:50px;top:120px;width:1820px;height:840px;",
          lines: lines.map((a: any) => ({ align: "", text: [{ style: "", value: a }] })),
        },
      ]
      slides[id] = {
        group: "",
        color: null,
        settings: {},
        notes: "",
        items,
      }
      if (get(groups)[group]) slides[id].globalGroup = group
    }
  })
  // TODO: check for duplicates and create merges

  return { slides, layout }
}
