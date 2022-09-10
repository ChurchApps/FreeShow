import { get } from "svelte/store"
import { uid } from "uid"
import { changeLayout } from "../../show/slides"
import { activeDrawerTab, activeProject, activeShow, audioExtensions, drawerTabsData, imageExtensions, media, projects, showsCache, videoExtensions } from "../../stores"
import { clone } from "./array"
import { history, historyAwait } from "./history"
import { getExtension, getFileName, removeExtension } from "./media"
import { addToPos, getIndexes, mover } from "./mover"
import { _show } from "./shows"

function getId(drag: any): string {
  let id: string = ""
  console.log(drag)
  if (drag.id === "slide" || drag.id === "group") return "slide"
  const extension: string = getExtension(drag.data[0].name)
  if (drag.id === "files" && get(audioExtensions).includes(extension)) return "audio"
  if ((drag.id === "show" && ["media", "image", "video"].includes(drag.data[0].type)) || drag.id === "media" || drag.id === "files" || drag.id === "camera") return "media"
  // if (drag.id === "audio") return "audio"
  // if (drag.id === "global_group") return "global_group"
  return drag.id || id
}

export const dropActions: any = {
  slides: ({ drag, drop }: any, history: any) => dropActions.slide({ drag, drop }, history),
  slide: ({ drag, drop }: any, history: any) => {
    history.location = { page: "show", show: get(activeShow), layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout }

    let id: string = getId(drag)
    if (slideDrop[id]) {
      history = slideDrop[id]({ drag, drop }, history)
      return history
    }

    console.log("Missing slide drop action:", drag.id)
    return history
  },
  projects: ({ drag, drop }: any, history: any) => {
    if (drag.id !== "folder" && drag.id !== "project") return
    if (drop.data.type && drop.data.type !== "folder") return

    history.location.page = "show"
    // TODO: move multiple
    let parents = drop.data.path?.split("/") || [""]
    drag.data.forEach(checkData)
    function checkData(data: any) {
      if (data.type === drop.data.type) {
        // itself
        if (data.id === drop.data.id) return
        // child of itself
        if (parents[0] && data.path !== drop.data.path && parents.includes(data.id)) return
      }
      // if ((data.id !== drop.data.id && (parents[0] === "" || data.path === drop.data.path || !parents.includes(data.id))) || data.type !== drop.data.type) {

      if (data.type === "folder") {
        history.id = "updateProjectFolder"
        history.location.folder = data.id
        return
      }

      history.id = "updateProject"
      history.location.project = data.id
    }

    history.newData = { key: "parent", value: drop.data.id || "/" }

    return history
  },
  project: ({ drag, drop }: any, history: any) => {
    history.id = "addShowToProject"
    history.location.page = "show"
    history.location.project = get(activeProject)

    let projectShows = get(projects)[history.location.project].shows

    if (drop.index === undefined) drop.index = projectShows.length
    if (drag.id === "files" && drop.trigger?.includes("end")) drop.index++

    let data: any[] = drag.data
    if (drag.id === "media" || drag.id === "files") {
      data = data
        .map((a: any) => {
          const extension: string = getExtension(a.path || a.name)
          if (drag.id === "files" && !files[drop.id].includes(extension)) return null

          let type: string = "image"
          if (get(videoExtensions).includes(extension)) type = "video"
          else if (get(audioExtensions).includes(extension)) type = "audio"

          let name: string = a.name || getFileName(a.path)
          return { name: removeExtension(name), id: a.path, type }
        })
        .filter((a: any) => a)
    } else if (drag.id === "audio") {
      data = data.map((a: any) => ({ id: a.path, name: removeExtension(a.name), type: "audio" }))
    } else if (drag.id === "player") {
      data = data.map((a: any) => ({ id: a, type: "player" }))
    }

    history.oldData = JSON.stringify({ shows: projectShows })
    if (drag.id === "show") history.newData = { shows: mover(projectShows, getIndexes(data), drop.index) }
    else history.newData = { shows: addToPos(projectShows, data, drop.index) }

    return history
  },
  all_slides: ({ drag, drop }: any, history: any) => {
    history.location = { page: "show", show: get(activeShow), layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout }

    if (drag.id === "template") {
      history.id = "template"

      // TODO: add slide
      // if (trigger) location.layoutSlide = index
      if (drop.center) history.location.layoutSlide = drop.index
      history.newData = { template: drag.data[0], createItems: true }
    }

    return history
  },
  navigation: ({ drag, drop }: any, h: any) => {
    if (drop.data !== "all" && get(activeDrawerTab) && (drag.id === "show" || drag.id === "show_drawer")) {
      h.id = "updateShow"
      h.newData = { key: "category", values: [drop.data === "unlabeled" ? null : drop.data] }
      h.location = { page: drag.id === "show" ? "show" : "drawer", shows: drag.data }
      historyAwait(
        drag.data.map((a: any) => a.id),
        h
      )
      return h
    }

    if (drop.data === "favourites" && drag.id === "media") {
      drag.data.forEach((card: any) => {
        let path: string = card.path || card.id
        media.update((a: any) => {
          if (!a[path]) a[path] = { filter: "" }
          a[path].favourite = true
          return a
        })
      })

      // return history
    }

    if (drop.data !== "all" && (drag.id === "overlay" || drag.id === "template")) {
      drag.data.forEach((id: any) => {
        history({
          id: drag.id === "overlay" ? "updateOverlay" : "updateTemplate",
          newData: { key: "category", data: drop.data === "unlabeled" ? null : drop.data },
          location: { page: "drawer", id },
        })
      })

      // return history
    }
  },
  templates: ({ drag, drop }: any) => {
    if (drag.id !== "slide") return

    drag.data.forEach(({ index }: any) => {
      let ref: any = _show().layouts("active").ref()[0][index]
      let slides: any[] = _show().get().slides
      let slide: any = ref.type === "child" ? slides[ref.parent.id] : slides[ref.id]
      let activeTab: string | null = get(drawerTabsData).templates.activeSubTab
      let data: any = {
        name: slide.group || "",
        color: slide.color || "",
        category: activeTab === "all" || activeTab === "unlabeled" ? null : activeTab,
        items: slide.items,
      }
      history({ id: drop.id === "overlays" ? "newOverlay" : "newTemplate", newData: { data }, location: { page: "show" } })
    })
  },
  overlays: ({ drag, drop }: any) => dropActions.templates({ drag, drop }),
}

const files: any = {
  project: ["frs", ...get(imageExtensions), ...get(videoExtensions), ...get(audioExtensions)],
  slides: ["frs", ...get(imageExtensions), ...get(videoExtensions), ...get(audioExtensions)],
  slide: ["frs", ...get(imageExtensions), ...get(videoExtensions), ...get(audioExtensions)],
}

const slideDrop: any = {
  media: ({ drag, drop }: any, history: any) => {
    let data: any[] = drag.data
    // TODO: move multiple add to possible slides

    // check files
    if (drag.id === "files") {
      data = []
      drag.data.forEach((a: any) => {
        const extension: string = getExtension(a.name)
        if (files[drop.id].includes(extension)) {
          data.push({
            path: a.path,
            name: removeExtension(a.name),
            type: get(audioExtensions).includes(extension) ? "audio" : get(videoExtensions).includes(extension) ? "video" : "image",
          })
        }
      })
    } else if (drag.id === "camera") data[0].type = "camera"
    else if (!data[0].name) data[0].name = data[0].path

    if (drop.center) {
      history.id = "showMedia"

      if (drop.trigger?.includes("end")) drop.index!--
      history.location.layoutSlide = drop.index
      history.newData = data[0]

      return history
    }

    history.id = "newSlide"
    history.location.layoutSlide = drop.index
    let slides: any[] = drag.data.map((a: any) => ({ group: removeExtension(a.name || ""), color: null, settings: {}, notes: "", items: [] }))

    history.newData = { index: drop.index, slides, backgrounds: data }

    return history
  },
  audio: ({ drag, drop }: any, h: any) => {
    h.id = "showAudio"

    if (drop.trigger?.includes("end")) drop.index!--
    h.location.layoutSlide = drop.index

    drag.data.forEach((audio: any) => {
      // TODO: drop both audio & video files...
      h.newData = { name: audio.name || audio.path, path: audio.path, type: "audio" }
      history(h)
    })
  },
  slide: ({ drag, drop }: any, history: any) => {
    history.id = "slide"
    let ref: any[] = _show().layouts("active").ref()[0]

    let slides = _show().get().slides
    let oldLayout = _show().layouts("active").get()[0].slides
    history.oldData = clone({ layout: oldLayout, slides })

    // end of layout
    if (drop.index === undefined) drop.index = ref.length

    let newIndex: number = drop.index
    let moved: any[] = []
    let sortedLayout: any[] = []

    if (drag.id === "slide") {
      let selected: number[] = getIndexes(drag.data)

      selected.forEach(selectChildren)
      function selectChildren(index: number) {
        if (ref[index].type !== "parent") return
        let children: string[] = ref[index].children
        children?.map((_id: string, childIndex: number) => selected.push(index + childIndex + 1))
        selected = [...new Set(selected)]
      }

      sortedLayout = mover(ref, selected, drop.index)

      ref = ref.filter((a: any, i: number) => {
        if (!selected.includes(i)) return true
        if (i < drop.index!) newIndex--
        moved.push(a)
        return false
      })
    } else if (drag.id === "group") {
      if (drop.center) {
        if (drop.trigger?.includes("end")) newIndex--
        ref.splice(drop.index, 1)
      }

      moved = drag.data.map(({ index, id }: any) => ref[index] || { type: "parent", id })
      sortedLayout = addToPos(ref, moved, newIndex)
    }

    // sort layout ref
    let newLayoutRef: any[] = addToPos(ref, moved, newIndex)

    // check if first slide child
    if (newLayoutRef[0].type === "child") newLayoutRef[0].newType = "parent"

    history.newData = changeLayout(sortedLayout, slides, clone(newLayoutRef), moved, newIndex)
    return history
  },
  global_group: ({ drag, drop }: any, history: any) => {
    let ref: any[] = _show().layouts("active").ref()[0]

    if (drop.center) {
      history.id = "changeSlide"

      if (drop.trigger?.includes("end")) drop.index--

      history.location.slide = ref[drop.index!].id
      delete history.location.layout
      history.newData = { key: "globalGroup", value: drag.data[0].globalGroup }

      return history
    }

    history.id = "slide"

    let layoutId: string = _show().get("settings.activeLayout")

    let slides: any = get(showsCache)[get(activeShow)!.id].slides
    let layout: any[] = _show().layouts([layoutId]).slides().get()[0]

    if (drop.index === undefined) drop.index = layout.length
    let newIndex: number = drop.index

    drag.data.forEach((slide: any) => {
      let id = uid()
      slides[id] = slide

      let parent = ref[newIndex - 1]
      if (parent.type === "child") parent = parent.parent

      layout = addToPos(layout, [{ id }], parent.index + 1)
    })

    history.newData = { slides, layout }
    history.location.layout = layoutId
    return history
  },
  overlay: ({ drag, drop }: any, history: any) => {
    history.id = "changeLayout"
    history.location.layoutSlide = drop.index
    let ref: any = _show().layouts("active").ref()[0][drop.index!]
    let value: any[] = [...new Set([...(ref?.data?.overlays || []), ...drag.data])]
    history.newData = { key: "overlays", value }
    return history
  },
}
