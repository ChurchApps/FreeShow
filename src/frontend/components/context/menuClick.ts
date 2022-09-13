import { get } from "svelte/store"
import { uid } from "uid"
import { MAIN, OUTPUT } from "../../../types/Channels"
import { changeSlideGroups } from "../../show/slides"
import {
  activeDrawerTab,
  activeEdit,
  activePage,
  activePopup,
  activeRename,
  activeShow,
  alertMessage,
  currentOutputSettings,
  dictionary,
  drawerTabsData,
  eventEdit,
  events,
  forceClock,
  imageExtensions,
  media,
  outLocked,
  outputs,
  overlays,
  previousShow,
  projects,
  projectView,
  saved,
  scriptures,
  selected,
  settingsTab,
  shows,
  showsCache,
  stageShows,
} from "../../stores"
import { send } from "../../utils/request"
import { save } from "../../utils/save"
import { exportProject } from "../export/project"
import { copy, paste } from "../helpers/clipboard"
import { GetLayout, GetLayoutRef } from "../helpers/get"
import { history, redo, undo } from "../helpers/history"
import { getActiveOutputs, setOutput } from "../helpers/output"
import { loadShows } from "../helpers/setShow"
import { _show } from "../helpers/shows"
import { OPEN_FOLDER } from "./../../../types/Channels"
import { activeProject } from "./../../stores"

export function menuClick(id: string, enabled: boolean = true, menu: any = null, contextElem: any = null, actionItem: any = null, sel: any = {}) {
  if (actions[id]) return actions[id]({ sel, actionItem, enabled, contextElem, menu })
  console.log("MISSING CONTEXT: ", id)
}

const actions: any = {
  // file
  save: () => save(),
  import: () => activePopup.set("import"),
  export_more: () => activePopup.set("export"),
  settings: () => activePage.set("settings"),
  quit: () => {
    if (get(saved)) send(MAIN, ["CLOSE"])
    else activePopup.set("unsaved")
  },
  // view
  fullscreen: () => send(MAIN, ["FULLSCREEN"]),
  // edit
  undo: () => undo(),
  redo: () => redo(),
  copy: () => copy(),
  paste: () => paste(),
  // view
  // help
  docs: () => window.api.send(MAIN, { channel: "URL", data: "https://freeshow.app/docs" }),
  shortcuts: () => activePopup.set("shortcuts"),
  about: () => activePopup.set("about"),
  // main
  rename: (obj: any) => {
    if (obj.sel.id === "slide" || obj.sel.id === "group" || obj.sel.id === "overlay" || obj.sel.id === "template") activePopup.set("rename")
    else if (obj.sel.id === "show") activeRename.set("show_" + obj.sel.data[0].id + "#" + obj.sel.data[0].index)
    else if (obj.sel.id === "show_drawer") activeRename.set("show_drawer_" + obj.sel.data[0].id)
    else if (obj.sel.id === "project") activeRename.set("project_" + obj.sel.data[0].id)
    else if (obj.sel.id === "folder") activeRename.set("folder_" + obj.sel.data[0].id)
    else if (obj.sel.id === "layout") activeRename.set("layout_" + obj.sel.data[0])
    else if (obj.sel.id === "player") activeRename.set("player_" + obj.sel.data[0])
    else if (obj.sel.id.includes("category")) activeRename.set("category_" + get(activeDrawerTab) + "_" + obj.sel.data[0])
    else console.log("Missing rename", obj)
  },
  remove: (obj: any) => {
    if (obj.sel.id === "show" && get(activeProject)) {
      let shows = get(projects)[get(activeProject)!].shows
      let indexes = obj.sel.data.map((a: any) => a.index)
      if (get(activeShow)?.index !== undefined && indexes.includes(get(activeShow)?.index)) {
        activeShow.update((a) => {
          delete a!.index
          return a
        })
      }
      history({ id: "updateProject", newData: { key: "shows", value: shows.filter((_a, i) => !indexes.includes(i)) }, location: { page: "show", project: get(activeProject) } })
      // // TODO: don't remove private!!!!
      // projects.update((a) => {
      //   obj.sel.data.forEach((b: any) => {
      //     a[get(activeProject)!].shows = a[get(activeProject)!].shows.filter((a) => a.id !== b.id)

      //     if (get(activeShow)?.index === b.index) {
      //       activeShow.update((a) => {
      //         delete a!.index
      //         return a
      //       })
      //     }
      //   })
      //   return a
      // })
      return
    }
    if (obj.sel.id === "slide") {
      obj.sel.data.forEach((a: any) => {
        let slide = GetLayoutRef()[a.index].id
        // TODO: change layout children & slide parent children
        history({ id: "changeSlide", newData: { key: "group", value: null }, location: { page: "show", show: get(activeShow)!, slide } })
        history({ id: "changeSlide", newData: { key: "color", value: null }, location: { page: "show", show: get(activeShow)!, slide } })
        history({ id: "changeSlide", newData: { key: "globalGroup", value: null }, location: { page: "show", show: get(activeShow)!, slide } })
      })
    }
    if (obj.sel.id === "layout") {
      if (obj.sel.data.length < _show("active").layouts().get().length) {
        obj.sel.data.forEach((id: string) => {
          history({ id: "deleteLayout", newData: { id }, location: { page: "show", show: get(activeShow)! } })
        })
      } else {
        alertMessage.set("error.keep_one_layout")
        activePopup.set("alert")
      }
    }
  },
  recolor: (obj: any) => {
    if (obj.sel.id === "slide" || obj.sel.id === "group" || obj.sel.id === "overlay" || obj.sel.id === "template") activePopup.set("color")
  },
  remove_slide: (obj: any) => removeSlide(obj),
  delete: (obj: any) => {
    if (obj.sel.id === "show_drawer") {
      activePopup.set("delete_show")
      return
    }
    if (obj.sel.id === "group") {
      console.log(obj.sel.data)
      history({
        id: "deleteGroups",
        newData: { ids: obj.sel.data.map((a: any) => a.id) },
        location: { page: "show", show: get(activeShow)!, layout: _show("active").get("settings.activeLayout") },
      })
      return
    }
    if (obj.contextElem?.classList.value.includes("#edit_box")) {
      let ref: any = _show("active").layouts("active").ref()[0][get(activeEdit).slide!]
      let slide: any = _show("active").slides([ref.id]).get()[0].id
      history({
        id: "deleteItem",
        location: { page: "edit", show: get(activeShow)!, items: get(activeEdit).items, slide: slide },
      })
      return
    }
    if (obj.sel.id === "slide") {
      removeSlide(obj)
      return
    }
    if (obj.sel.id === "category_scripture") {
      scriptures.update((a: any) => {
        obj.sel.data.forEach((id: string) => {
          let key: string | null = null
          Object.entries(a).forEach(([sId, value]: any) => {
            if (value.id === id) key = sId
          })

          if (key) delete a[key]
        })
        return a
      })
      return
    }
    if (obj.contextElem?.classList.value.includes("#event")) {
      history({ id: "deleteEvent", newData: { id: obj.contextElem.id } })
    }

    const deleteIDs: any = {
      folder: "deleteFolder",
      project: "deleteProject",
      stage: "deleteStage",
      category_shows: "deleteShowsCategory",
      category_media: "deleteMediaFolder",
      category_overlays: "deleteOverlaysCategory",
      category_templates: "deleteTemplatesCategory",
      player: "deletePlayerVideo",
      overlay: "deleteOverlay",
      template: "deleteTemplate",
    }
    obj.sel.data.forEach((a: any) => history({ id: deleteIDs[obj.sel.id] || obj.sel.id, newData: { id: a.id || a }, location: { page: get(activePage) as any } }))
  },
  delete_all: (obj: any) => {
    if (obj.contextElem?.classList.value.includes("#event")) {
      let group: any = get(events)[obj.contextElem.id].group
      if (!group) return
      Object.entries(get(events)).forEach(([id, event]: any) => {
        if (event.group === group) history({ id: "deleteEvent", newData: { id } })
      })
    }
  },
  duplicate: (obj: any) => {
    if (obj.contextElem?.classList.value.includes("#event")) {
      let event = JSON.parse(JSON.stringify(get(events)[obj.contextElem.id]))
      event.name += " 2"
      event.repeat = false
      delete event.group
      delete event.repeatData
      history({ id: "newEvent", newData: { id: uid(), data: event } })
      return
    }
    if (obj.sel.id === "show" || obj.sel.id === "show_drawer") {
      duplicateShows(obj.sel)
      return
    }
    if (obj.sel.id === "slide" || obj.sel.id === "overlay" || obj.sel.id === "template") {
      obj.sel.data = obj.sel.data.sort((a: any, b: any) => a.index - b.index)
      copy(obj.sel)
      paste()
      return
    }
    // overlay, template
    if (get(activeEdit).items) {
      copy({ id: "item", data: get(activeEdit) })
      paste()
      return
    }
  },
  // drawer
  enabled_drawer_tabs: (obj: any) => {
    let m = { hide: false, enabled: !obj.enabled }
    drawerTabsData.update((a) => {
      a[obj.menu.id!].enabled = !obj.enabled
      return a
    })
    return m
  },
  addToProject: (obj: any) => {
    if ((obj.sel.id !== "show" && obj.sel.id !== "show_drawer" && obj.sel.id !== "player" && obj.sel.id !== "media" && obj.sel.id !== "audio") || !get(activeProject)) return
    if (obj.sel.id === "player") obj.sel.data = obj.sel.data.map((id: string) => ({ id, type: "player" }))
    else if (obj.sel.id === "audio") obj.sel.data = obj.sel.data.map(({ path, name }: any) => ({ id: path, name, type: "audio" }))
    else if (obj.sel.id === "media")
      obj.sel.data = obj.sel.data.map(({ path, name }: any) => ({
        id: path,
        name,
        type: get(imageExtensions).includes(path.slice(path.lastIndexOf(".") + 1, path.length)) ? "image" : "video",
      }))

    projects.update((a) => {
      a[get(activeProject)!].shows.push(...obj.sel.data)
      // sel.data.forEach((b: any) => {
      //   console.log(b, a[get(activeProject)!].shows)

      //   a[get(activeProject)!].shows.push({ id: b.id })
      // })
      console.log(a)

      return a
    })
  },
  toggle_clock: () => {
    forceClock.set(!get(forceClock))
  },

  // output
  force_output: () => {
    let enabledOutputs: any[] = getActiveOutputs(get(outputs), false)
    enabledOutputs.forEach((id) => {
      let output: any = { id, ...get(outputs)[id] }
      // , force: e.ctrlKey || e.metaKey
      send(OUTPUT, ["DISPLAY"], { enabled: true, output, force: true })
    })
  },
  toggle_output: (obj: any) => {
    let id: string = obj.contextElem.id
    send(OUTPUT, ["DISPLAY"], { enabled: "toggle", one: true, output: { id, ...get(outputs)[id] } })
  },
  move_to_front: (obj: any) => {
    send(OUTPUT, ["TO_FRONT"], obj.contextElem.id)
  },

  // new
  newShowPopup: () => activePopup.set("show"),

  newShow: () => history({ id: "newShow", location: { page: "show", project: get(activeProject) } }),
  newPrivateShow: () => history({ id: "newShow", newData: { private: true }, location: { page: "show", project: get(activeProject) } }),
  newProject: (obj: any) =>
    history({ id: "newProject", oldData: obj.contextElem.getAttribute("data-parent") || obj.contextElem.id, location: { page: "show", project: get(activeProject) } }),
  newFolder: (obj: any) => {
    if (obj.contextElem.classList.includes("#projects"))
      history({ id: "newFolder", oldData: obj.contextElem.getAttribute("data-parent") || obj.contextElem.id, location: { page: "show", project: get(activeProject) } })
    else if (obj.contextElem.classList.includes("#category_media")) window.api.send(OPEN_FOLDER, { id: "media", title: get(dictionary).new?.folder })
  },
  newSlide: () => history({ id: "newSlide", location: { page: "show", show: get(activeShow)!, layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout } }),
  newCategory: (obj: any) => {
    const ids: any = {
      shows: "newShowsCategory",
      overlays: "newOverlaysCategory",
      templates: "newTemplatesCategory",
    }
    let index = obj.contextElem.classList.indexOf("#category_")
    history({ id: ids[obj.contextElem.classList.slice(index + 10, obj.contextElem.classList.indexOf(" ", index))] })
  },
  newScripture: () => activePopup.set("import_scripture"),

  // project
  export: (obj: any) => {
    if (!obj.contextElem.classList.value.includes("project")) return
    if (obj.sel.id !== "project" && !get(activeProject)) return
    let projectId: string = obj.sel.data[0]?.id || get(activeProject)
    exportProject(get(projects)[projectId])
  },
  close: (obj: any) => {
    if (obj.contextElem.classList.contains("media")) {
      if (get(previousShow)) {
        activeShow.set(JSON.parse(get(previousShow)))
        previousShow.set(null)
      }
      return
    }

    // shows
    if (obj.contextElem.classList.contains("grid")) {
      activeShow.set(null)
      return
    }

    if (!obj.contextElem.classList.contains("#projectTab") || !get(activeProject)) return
    activeProject.set(null)
    projectView.set(true)
  },
  private: (obj: any) => {
    showsCache.update((a: any) => {
      obj.sel.data.forEach((b: any) => {
        a[b.id].private = !a[b.id].private
      })
      return a
    })
    shows.update((a: any) => {
      obj.sel.data.forEach((b: any) => {
        if (a[b.id].private) delete a[b.id].private
        else a[b.id].private = true
      })
      return a
    })
  },

  // show
  disable: (obj: any) => {
    if (obj.sel.id === "slide") {
      showsCache.update((a) => {
        obj.sel.data.forEach((b: any) => {
          let ref = GetLayoutRef()[b.index]
          let slides = a[get(activeShow)!.id].layouts[a[get(activeShow)!.id].settings.activeLayout].slides
          if (ref.type === "child") {
            if (!slides[ref.layoutIndex].children) slides[ref.layoutIndex].children = {}
            slides[ref.layoutIndex].children[ref.id] = { ...slides[ref.layoutIndex].children[ref.id], disabled: !obj.enabled }
          } else slides[ref.index].disabled = !obj.enabled
        })
        return a
      })
      return
    }
    if (obj.sel.id === "group") {
      showsCache.update((a) => {
        let ref = GetLayoutRef()
        ref.forEach((b: any) => {
          obj.sel.data.forEach((c: any) => {
            console.log(b)
            if (b.type === "child" && b.parent === c.id)
              a[get(activeShow)!.id].layouts[a[get(activeShow)!.id].settings.activeLayout].slides[b.layoutIndex].children[b.id].disabled = !obj.enabled
            else if (b.id === c.id) a[get(activeShow)!.id].layouts[a[get(activeShow)!.id].settings.activeLayout].slides[b.layoutIndex || b.index].disabled = !obj.enabled
          })
        })
        return a
      })
    }
    if (obj.sel.id === "stage") {
      // history({ id: "changeStage", newData: {key: "disabled", value: }, location: { page: "stage", slide: obj.sel.data.map(({id}: any) => (id)) } })
      stageShows.update((a) => {
        let value: boolean = !a[obj.sel.data[0].id].disabled
        obj.sel.data.forEach((b: any) => {
          a[b.id].disabled = value
        })
        return a
      })
    }
  },

  edit: (obj: any) => {
    if (obj.sel.id === "slide") {
      activeEdit.set({ slide: obj.sel.data[0].index, items: [] })
      activePage.set("edit")
    } else if (obj.sel.id === "media") {
      activeEdit.set({ type: "media", id: obj.sel.data[0].path, items: [] })
      activePage.set("edit")
    } else if (obj.sel.id === "overlay") {
      activeEdit.set({ type: "overlay", id: obj.sel.data[0], items: [] })
      activePage.set("edit")
    } else if (obj.sel.id === "template") {
      activeEdit.set({ type: "template", id: obj.sel.data[0], items: [] })
      activePage.set("edit")
    } else if (obj.sel.id === "global_group") {
      settingsTab.set("groups")
      activePage.set("settings")
    } else if (obj.contextElem?.classList.value.includes("#event")) {
      eventEdit.set(obj.contextElem.id)
      activePopup.set("edit_event")
    } else if (obj.contextElem?.classList.value.includes("output_button")) {
      currentOutputSettings.set(obj.contextElem.id)
      settingsTab.set("outputs")
      activePage.set("settings")
    }
  },

  // change slide group
  slide_groups: (obj: any) => changeSlideGroups(obj),

  actions: (obj: any) => changeSlideAction(obj, obj.menu.id),
  remove_media: (obj: any) => {
    let type: "image" | "overlays" | "audio" = obj.menu.icon
    let slide: number = obj.sel.data[0].index
    let newData: any = null
    let location: any = { page: "show", show: get(activeShow), layout: _show("active").get("settings.activeLayout"), layoutSlide: slide }

    let layoutSlide = _show("active").layouts("active").ref()[0][slide].data
    if (type === "image") {
      newData = { key: "background", value: null }
      // TODO: remove from show media if last one?
    } else if (type === "overlays") {
      let ol = layoutSlide.overlays
      // remove clicked
      ol.splice(ol.indexOf(obj.menu.id), 1)
      newData = { key: "overlays", value: ol }
    } else if (type === "audio") {
      let audio = layoutSlide.audio
      // remove clicked
      audio.splice(audio.indexOf(obj.menu.id), 1)
      newData = { key: "audio", value: audio }
      // TODO: remove from show media if last one?
    }

    if (newData) history({ id: "changeLayout", newData, location })
  },

  // media
  play: (obj: any) => {
    let path = obj.sel.data[0].path || obj.sel.data[0].id
    if (!path) return
    let filter: string = ""
    Object.entries(get(media)[path]?.filter || {}).forEach(([id, a]: any) => (filter += ` ${id}(${a})`))
    if (!get(outLocked)) setOutput("background", { path, filter })
  },
  play_no_filters: (obj: any) => {
    let path = obj.sel.data[0].path || obj.sel.data[0].id
    if (!path) return
    if (!get(outLocked)) setOutput("background", { path })
  },
  favourite: (obj: any) => {
    let favourite: boolean = get(media)[obj.sel.data[0].path || obj.sel.data[0].id]?.favourite !== true
    obj.sel.data.forEach((card: any) => {
      let path = card.path || card.id
      media.update((a) => {
        if (!a[path]) a[path] = { filter: "" }
        if (obj.sel.id === "audio") a[path].audio = true
        a[path].favourite = favourite
        return a
      })
    })
  },

  // overlays
  lock_to_output: (obj: any) => {
    if (obj.sel.id !== "overlay") return
    let setLocked: boolean = !get(overlays)[obj.sel.data[0]]?.locked

    overlays.update((a) => {
      obj.sel.data.forEach((id: string) => {
        a[id].locked = setLocked
      })
      return a
    })
  },

  // drawer navigation
  changeIcon: () => activePopup.set("icon"),

  selectAll: (obj: any) => {
    let data: any[] = []
    if (obj.sel.id === "group") {
      let ref = GetLayoutRef()
      obj.sel.data.forEach((a: any) => {
        ref.forEach((b, i) => {
          if (b.type === "child" ? a.id === b.parent : a.id === b.id) data.push({ index: i })
        })
      })
      selected.set({ id: "slide", data })
    } else if (get(activeShow)) {
      data = GetLayoutRef().map((_a, index) => ({ index }))
    }
    selected.set({ id: "slide", data })
  },

  // formats
  uppercase: (obj: any) => format("uppercase", obj),
  lowercase: (obj: any) => format("lowercase", obj),
  capitalize: (obj: any) => format("capitalize", obj),
  trim: (obj: any) => format("trim", obj),
}

function changeSlideAction(obj: any, id: string) {
  obj.sel.data.forEach((a: any) => {
    let actions: any = GetLayout()[a.index].actions || {}
    actions = { ...actions, [id]: actions[id] ? !actions[id] : true }
    history({
      id: "changeLayout",
      newData: { key: "actions", value: actions },
      location: { page: "show", show: get(activeShow)!, layoutSlide: a.index, layout: _show("active").get("settings.activeLayout") },
    })
  })
}

export function removeSlide(obj: any) {
  let location: any = { page: get(activePage) as any, show: get(activeShow)!, layout: _show("active").get("settings.activeLayout") }
  // console.log(location)
  let ref = _show(location.show.id).layouts([location.layout]).ref()[0]
  let parents: any[] = []
  let childs: any[] = []

  // remove parents and delete childs
  obj.sel.data.forEach((a: any) => {
    if (ref[a.index].type === "parent") parents.push(ref[a.index].index)
    else childs.push(ref[a.index].id)
  })

  if (parents.length) {
    console.log(parents)
    history({
      id: "removeSlides",
      newData: { indexes: parents },
      location,
    })
  }
  if (childs.length) {
    history({
      id: "deleteSlides",
      newData: { ids: childs },
      location: { page: get(activePage) as any, show: get(activeShow)! },
    })
  }
}

function format(id: string, obj: any) {
  let slides: any[] = []
  let ref: any = _show("active").layouts("active").ref()[0]
  if (obj.sel.id?.includes("slide")) {
    slides = obj.sel.data.map((a: any) => ref[a.index].id)
  } else {
    slides = [
      _show("active")
        .slides([ref[get(activeEdit).slide!].id])
        .get()[0].id,
    ]
  }

  slides.forEach((slide) => {
    let items: any = _show("active").slides([slide]).items(get(activeEdit).items).get()[0]
    let newData: any = { style: { values: [] } }

    let newItems: any[] = []
    items.forEach((item: any) => {
      item.lines?.forEach((line: any, j: number) => {
        line.text?.forEach((text: any, k: number) => {
          item.lines[j].text[k].value = formatting[id](text.value)
        })
      })
      newItems.push(item)
    })
    newData.style.values = newItems

    history({ id: "setItems", newData, location: { page: get(activePage) as any, show: get(activeShow)!, items: get(activeEdit).items, slide: slide } })
  })
}

const formatting: any = {
  uppercase: (t: string) => t.toUpperCase(),
  lowercase: (t: string) => t.toLowerCase(),
  capitalize: (t: string) => (t.length > 1 ? t[0].toUpperCase() + t.slice(1, t.length).toLowerCase() : t.toUpperCase()),
  trim: (t: string) => t.replace(/[.,!]*$/g, "").trim(),
}

async function duplicateShows(selected: any) {
  await loadShows(selected.data.map((a: any) => a.id))
  selected.data.forEach((a: any) => {
    let show = JSON.parse(JSON.stringify(get(showsCache)[a.id]))
    show.name += " 2"
    show.timestamps.modified = new Date().getTime()
    history({ id: "newShow", newData: { show }, location: { page: "show", project: selected.id === "show" ? get(activeProject) : null } })
  })
}
