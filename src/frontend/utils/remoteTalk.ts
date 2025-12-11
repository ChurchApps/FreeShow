import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../types/Show"
import type { ClientMessage } from "../../types/Socket"
import { AudioPlayer } from "../audio/audioPlayer"
import { loadJsonBible } from "../components/drawer/bible/scripture"
import { clone, keysToID, removeDeleted } from "../components/helpers/array"
import { getBase64Path, getThumbnailPath, mediaSize } from "../components/helpers/media"
import { getAllNormalOutputs, getFirstActiveOutput, setOutput } from "../components/helpers/output"
import { loadShows } from "../components/helpers/setShow"
import { getLayoutRef } from "../components/helpers/show"
import { updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { clearAll } from "../components/output/clear"
import { REMOTE } from "./../../types/Channels"
import { actions, actionTags, activePage, activeProject, activeShow, activeTimers, audioChannelsData, categories, connections, dictionary, driveData, folders, language, openedFolders, outLocked, outputs, overlayCategories, overlays, projects, remotePassword, runningActions, scriptures, shows, showsCache, styles, templateCategories, templates, timers, triggers, variableTags, variables, volume } from "./../stores"
import { lastClickTime } from "./common"
import { translateText } from "./language"
import { send } from "./request"
import { sendData, setConnectedState } from "./sendData"

// REMOTE

let currentOut = ""
let loadingShow = ""
export const receiveREMOTE: any = {
  PASSWORD: (msg: any) => {
    msg.data = {
      dictionary: get(dictionary),
      password: !!get(remotePassword).length
    }
    if (msg.data.password) return msg

    setConnectedState("REMOTE", msg.id, "entered", true)

    // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
    msg = { id: msg.id, channel: "SHOWS", data: get(shows) }
    initializeRemote(msg.id)

    return msg
  },
  GET_MIXER: (msg: any) => {
    msg.data = getMixerPayload()
    return msg
  },
  SET_VOLUME: (msg: any) => {
    const newVolume = clamp01(msg.data?.volume ?? msg.data ?? 1)
    volume.set(newVolume)
    AudioPlayer.updateVolume()

    msg.channel = "GET_MIXER"
    msg.data = getMixerPayload()
    return msg
  },
  SET_OUTPUT_VOLUME: (msg: any) => {
    const { id, volume: newVolumeRaw } = msg.data || {}
    if (!id) return

    const newVolume = clamp01(newVolumeRaw ?? 1)
    updateAudioChannel(id, (a) => ({ ...a, volume: newVolume }))

    msg.channel = "GET_MIXER"
    msg.data = getMixerPayload()
    return msg
  },
  TOGGLE_MUTE: (msg: any) => {
    const muted = !!(msg.data?.muted ?? msg.data)
    updateAudioChannel("main", (a) => ({ ...a, isMuted: muted }))
    AudioPlayer.updateVolume()

    msg.channel = "GET_MIXER"
    msg.data = getMixerPayload()
    return msg
  },
  TOGGLE_OUTPUT_MUTE: (msg: any) => {
    const { id, muted } = msg.data || {}
    if (!id) return

    updateAudioChannel(id, (a) => ({ ...a, isMuted: !!muted }))

    msg.channel = "GET_MIXER"
    msg.data = getMixerPayload()
    return msg
  },
  ACCESS: (msg: any) => {
    if (get(remotePassword).length && msg.data !== get(remotePassword)) return { id: msg.id, channel: "ERROR", data: "wrongPass" }

    send(REMOTE, ["LANGUAGE"], { lang: get(language), strings: get(dictionary) })

    setConnectedState("REMOTE", msg.id, "entered", true)

    // msg = { id: msg.id, channel: "SHOWS_CACHE", data: filterObjectArray(get(showsCache), ["name", "private", "category", "timestamps"]) }
    msg = { id: msg.id, channel: "SHOWS", data: get(shows) }
    initializeRemote(msg.id)

    return msg
  },
  // SHOWS: (msg: any) => {
  //   msg.data = filterObjectArray(get(shows), ["name"])
  //   return msg
  // },
  SHOW: async (msg: any) => {
    // msg.data = filterObjectArray(get(shows)[msg.data], [""])
    const showID: string = msg.data

    if (msg.id) {
      setConnectedState("REMOTE", msg.id, "active", showID)
    }

    loadingShow = showID
    await loadShows([showID])

    // send before any backgrounds has loaded
    msg.data = clone({ ...(await convertBackgrounds(get(showsCache)[showID], true)), id: showID })
    if (loadingShow !== showID) return
    window.api.send(REMOTE, msg)

    msg.data = clone({ ...(await convertBackgrounds(get(showsCache)[showID])), id: showID })
    // send(REMOTE, ["MEDIA"], { media: msg.data.media })

    if (loadingShow !== showID) return

    openShow(showID)
    return msg
  },
  OUT: async (msg: any) => {
    if (get(outLocked)) return
    // set id because convertBackgrounds might use a long time
    const currentId = uid(5)
    currentOut = currentId

    const currentOutput = getFirstActiveOutput()
    const out = currentOutput?.out?.slide || null
    let id = ""

    if (msg.data === "clear") {
      clearAll()
      return
    } else if (msg.data?.id) {
      id = msg.data.id
      await loadShows([id])

      const layout = getLayoutRef(id)
      if (msg.data.index < layout.length && msg.data.index >= 0) {
        if (!msg.data.layout) msg.data.layout = _show(id).get("settings.activeLayout")
        updateOut(msg.data.id, msg.data.index, _show(msg.data.id).layouts([msg.data.layout]).ref()[0])
        setOutput("slide", msg.data)
      }

      return
    } else if (msg.data !== null && msg.data !== undefined && out) {
      id = out.id

      const layout = getLayoutRef(id)
      if (msg.data < layout.length && msg.data >= 0) {
        const newOutSlide: any = { ...out, index: msg.data }
        setOutput("slide", newOutSlide)
      }
      msg.data = null
    } else if (out?.id === "temp") {
      msg.data = out
    } else {
      const styleRes = currentOutput?.style ? get(styles)[currentOutput?.style]?.aspectRatio || get(styles)[currentOutput?.style]?.resolution : null
      msg.data = { slide: out ? out.index : null, layout: out?.layout || null, styleRes }
      // && out.id !== oldOutSlide
      if (out && out.id !== "temp") {
        id = out.id
        oldOutSlide = id
        msg.data.show = await convertBackgrounds(get(showsCache)[id], false, true)
        msg.data.show.id = id
      }

      if (currentOut !== currentId) return
    }
    if (id?.length && msg.id) {
      setConnectedState("REMOTE", msg.id, "active", id)
    }

    return msg
  },
  OUT_DATA: (msg: any) => {
    const currentOutput = getFirstActiveOutput()
    const out = currentOutput?.out || {}
    msg.data = out

    return msg
  },
  PROJECTS: (msg: any) => {
    msg.data = removeDeleted(keysToID(clone(get(projects))))

    // get names
    msg.data.forEach((project) => {
      project.shows.forEach((show) => {
        if (show.type === "overlay") show.name = get(overlays)[show.id]?.name || translateText("main.unnamed")
      })

      return project
    })

    return msg
  },
  GET_SCRIPTURE: async (msg: ClientMessage) => {
    const { id, bookKey, chapterKey, bookIndex, chapterIndex } = msg.data || {}
    if (!id) return

    const jsonBible = await loadJsonBible(id)
    if (!jsonBible) return

    const scriptureData: any = get(scriptures)[id]
    const isApi = scriptureData?.api === true

    if (!isApi) {
      msg.data.bible = jsonBible.data
      return msg
    }

    if (bookKey && !chapterKey) {
      try {
        const bookData = await jsonBible.getBook(bookKey)
        const mapped = (bookData.data.chapters || []).map((c) => ({
          number: c.number,
          keyName: c.number
        }))
        msg.data.bibleUpdate = { kind: "chapters", id, bookIndex, chapters: mapped }
      } catch (error) {
        console.warn(`Failed to load book ${bookKey}:`, error)
        msg.data.bibleUpdate = { kind: "chapters", id, bookIndex, chapters: [] }
      }
      return msg
    }

    if (bookKey && chapterKey) {
      try {
        const bookData = await jsonBible.getBook(bookKey)
        const chapterData = await bookData.getChapter(chapterKey)
        const versesData = chapterData.data.verses
        const mappedVerses = versesData.map((v) => ({
          number: v.number,
          text: v.text,
          keyName: v.number
        }))
        msg.data.bibleUpdate = { kind: "verses", id, bookIndex, chapterIndex, verses: mappedVerses }
      } catch (error) {
        console.warn(`Failed to load ${bookKey} ${chapterKey}:`, error)
        msg.data.bibleUpdate = { kind: "verses", id, bookIndex, chapterIndex, verses: [] }
      }
      return msg
    }

    const books = jsonBible.data.books
    const mappedBooks = (books || []).map((b) => ({
      name: b.name,
      number: b.number,
      keyName: b.id,
      chapters: []
    }))
    msg.data.bible = { books: mappedBooks }
    return msg
  },
  SEARCH_SCRIPTURE: async (msg: ClientMessage) => {
    const { id, searchTerm, searchType, bookFilter } = msg.data || {}
    if (!id || !searchTerm) return

    const jsonBible = await loadJsonBible(id)
    if (!jsonBible) return

    const scriptureData: any = get(scriptures)[id]
    const isApi = scriptureData?.api === true

    // For local bibles, return null to use cached search
    if (!isApi) {
      msg.data.searchResults = null
      return msg
    }

    try {
      if (searchType === "reference") {
        // Use bookSearch for reference parsing (e.g., "John 3:16")
        const result = jsonBible.bookSearch(searchTerm)
        if (result) {
          // Get book name if we have book number
          let bookName: string | null = null
          if (result.book) {
            const bookObj = jsonBible.data.books.find((b: any) => b.number === result.book || b.id === result.book)
            bookName = bookObj?.name || null
          }
          msg.data.searchResults = {
            type: "reference",
            autocompleted: result.autocompleted || undefined,
            book: result.book || null,
            bookName: bookName,
            chapter: result.chapter || null,
            verses: result.verses || []
          }
        } else {
          msg.data.searchResults = { type: "reference", found: false }
        }
      } else {
        // Use textSearch for content search (minimum 3 characters)
        if (searchTerm.length < 3) {
          msg.data.searchResults = { type: "text", results: [], bookFilter }
          return msg
        }
        const results = await jsonBible.textSearch(searchTerm)
        let filteredResults = (results || []).map((ref: any) => ({
          book: ref.book,
          chapter: ref.chapter,
          verseNumber: typeof ref.verse === "object" ? ref.verse.number : ref.verse,
          reference: `${ref.book}.${ref.chapter}.${typeof ref.verse === "object" ? ref.verse.number : ref.verse}`,
          referenceFull: ref.reference || "",
          verseText: typeof ref.verse === "object" ? ref.verse.text : ref.text || ""
        }))

        // Apply book filter if provided
        if (bookFilter) {
          filteredResults = filteredResults.filter((ref: any) => ref.book === bookFilter)
        }

        msg.data.searchResults = {
          type: "text",
          results: filteredResults.slice(0, 50),
          bookFilter
        }
      }
    } catch (err) {
      console.error("Scripture search error:", err)
      msg.data.searchResults = { type: searchType, error: true }
    }

    return msg
  },
  GET_OVERLAYS: (msg: any) => {
    msg.data = { overlays: get(overlays), categories: get(overlayCategories) }
    return msg
  },
  GET_TEMPLATES: (msg: any) => {
    msg.data = { templates: get(templates), categories: get(templateCategories) }
    return msg
  },
  GET_FUNCTIONS: (msg: any) => {
    msg.data = {
      actions: get(actions),
      actionTags: get(actionTags),
      variables: get(variables),
      variableTags: get(variableTags),
      timers: get(timers),
      triggers: get(triggers),
      activeTimers: get(activeTimers),
      runningActions: get(runningActions)
    }
    return msg
  }
}

let oldOutSlide = ""

export async function initializeRemote(id: string) {
  // Send access confirmation to remote client
  window.api.send(REMOTE, { id, channel: "ACCESS", data: null })

  // Send initial data to remote client
  sendData(REMOTE, { channel: "PROJECTS", data: removeDeleted(keysToID(get(projects))) })
  send(REMOTE, ["FOLDERS"], { folders: get(folders), opened: get(openedFolders) })
  send(REMOTE, ["PROJECT"], get(activeProject))

  // Get current output state
  const currentOutput = getFirstActiveOutput()
  const styleRes = currentOutput?.style ? get(styles)[currentOutput?.style]?.aspectRatio || get(styles)[currentOutput?.style]?.resolution : null

  const outSlide = currentOutput?.out?.slide
  const out: any = {
    slide: outSlide ? outSlide.index : null,
    layout: outSlide?.layout || null,
    styleRes
  }

  if (out.slide !== null && outSlide?.id && outSlide?.id !== "temp") {
    oldOutSlide = outSlide.id
    // Output & thumbnail
    out.show = await convertBackgrounds(get(showsCache)[oldOutSlide] || {})
    out.show.id = oldOutSlide

    // Send slide thumbnails asynchronously
    setTimeout(async () => {
      window.api.send(REMOTE, await receiveREMOTE.SHOW({ channel: "SHOW", id, data: oldOutSlide }))
    })
  }

  // Send targeted initial state to this connection
  // Use sendData so the proper OUT payload is constructed (handles scripture 'temp' etc.)
  sendData(REMOTE, { id, channel: "OUT" })
  sendData(REMOTE, { id, channel: "OUT_DATA" })

  // Send additional data
  send(REMOTE, ["SCRIPTURE"], get(scriptures))
  send(REMOTE, ["CATEGORIES"], get(categories))
}

export async function convertBackgrounds(show: Show, noLoad = false, init = false) {
  if (!show?.media) return {}

  show = clone(show)
  const mediaIds: string[] = []
  show.layouts[show.settings?.activeLayout]?.slides.forEach((a) => {
    if (a.background) mediaIds.push(a.background)
    Object.values(a.children || {}).forEach((child) => {
      if (child.background) mediaIds.push(child.background)
    })
  })

  await Promise.all(
    mediaIds.map(async (id) => {
      let path = show.media[id]?.path || show.media[id]?.id || ""
      const cloudId = get(driveData).mediaId
      if (cloudId && cloudId !== "default") path = show.media[id]?.cloud?.[cloudId] || path
      if (!path) return

      if (noLoad) {
        show.media[id].path = getThumbnailPath(path, mediaSize.slideSize)
        return
      }

      const remoteConnections = Object.keys(get(connections).REMOTE || {})?.length || 0
      if (!init && remoteConnections === 0) return

      const base64Path: string = await getBase64Path(path, mediaSize.slideSize)
      if (base64Path) show.media[id].path = base64Path
    })
  )

  return show
}

export function getMixerPayload() {
  const audioData = get(audioChannelsData) || {}
  const outputsStore = get(outputs) || {}

  const mixerOutputs = getAllNormalOutputs().reduce((acc: any, out) => {
    const channel = audioData[out.id] || {}
    acc[out.id] = {
      name: outputsStore[out.id]?.name || out.id,
      volume: channel.volume ?? 1,
      isMuted: !!channel.isMuted
    }
    return acc
  }, {})

  return {
    main: {
      volume: get(volume) ?? 1,
      isMuted: !!audioData.main?.isMuted
    },
    outputs: mixerOutputs
  }
}

function updateAudioChannel(id: string, updater: (a: any) => any) {
  audioChannelsData.update((a) => {
    const prev = a[id] || {}
    a[id] = updater(prev) || prev
    return a
  })
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number(value ?? 0)))

// const toBase64 = file => new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.readAsDataURL(file);
//     reader.onload = () => resolve(reader.result);
//     reader.onerror = error => reject(error);
// });

function openShow(id: string) {
  if (get(activePage) !== "show") return
  if (!get(shows)[id]) return
  // don't open if last interaction was less than 20 seconds ago
  if (Date.now() - lastClickTime < 20000) return

  activeShow.set({ id })
}
