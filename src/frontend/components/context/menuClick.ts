import { get } from "svelte/store"
import { MAIN } from "../../../types/Channels"
import {
  activeDrawerTab,
  activeEdit,
  activePage,
  activePopup,
  activeProject,
  activeShow,
  drawerTabsData,
  projects,
  projectView,
  saved,
  selected,
  showsCache,
  stageShows,
} from "../../stores"
import { send } from "../../utils/request"
import { save } from "../../utils/save"
import { GetLayoutRef, GetLayout } from "../helpers/get"
import { history, redo, undo } from "../helpers/history"
import { _show } from "../helpers/shows"
import { activeRename } from "./../../stores"

export function menuClick(id: string, enabled: boolean = true, menu: any = null, contextElem: any = null, actionItem: any = null, sel: any = null) {
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
  // view
  // help
  docs: () => window.api.send(MAIN, { channel: "URL", data: "https://freeshow.app/docs" }),
  shortcuts: () => activePopup.set("shortcuts"),
  about: () => activePopup.set("about"),
  // main
  rename: (obj: any) => {
    console.log(obj)

    if (obj.sel.id === "slide" || obj.sel.id === "group") activePopup.set("rename")
    else if (obj.sel.id === "show") activeRename.set("show_" + obj.sel.data[0].id + "#" + obj.sel.data[0].index)
    else if (obj.sel.id === "show_drawer") activeRename.set("show_drawer_" + obj.sel.data[0].id)
    else if (obj.sel.id === "category") activeRename.set("category_" + get(activeDrawerTab) + "_" + obj.sel.data[0])
    else if (obj.sel.id === "project") activeRename.set("project_" + obj.sel.data[0].id)
    else if (obj.sel.id === "folder") activeRename.set("folder_" + obj.sel.data[0].id)
    else if (obj.sel.id === "layout") activeRename.set("layout_" + obj.sel.data[0])
    else if (obj.sel.id === "player") activeRename.set("player_" + obj.sel.data[0])

    // else if (obj.actionItem instanceof HTMLInputElement) {
    //   // obj.actionItem.focus()
    //   console.log(obj.actionItem.value)
    //   // obj.actionItem!.dispatchEvent(new CustomEvent("doubleclick"))
    // } else if (obj.actionItem) {
    //   // obj.actionItem.click()
    //   console.log(obj.actionItem.innerHTML)
    //   // obj.actionItem.dispatchEvent(new CustomEvent("contextmenu"))
    // }
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
  },
  remove_slide: (obj: any) => {
    let location: any = { page: "show", show: get(activeShow)!, layout: _show("active").get("settings.activeLayout") }
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
        location: { page: "show", show: get(activeShow)! },
      })
    }
  },
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

    const deleteIDs: any = {
      folder: "deleteFolder",
      project: "deleteProject",
      stage: "deleteStage",
      category: "deleteShowsCategory",
    }
    obj.sel.data.forEach((a: any) => history({ id: deleteIDs[obj.sel.id], newData: { id: a.id || a } }))
  },
  duplicate: (obj: any) => {
    if (obj.sel.id === "show" || obj.sel.id === "show_drawer") {
      obj.sel.data.forEach((a: any) => {
        let show = { ...get(showsCache)[a.id] }
        show.name += " #2"
        show.timestamps.modified = new Date().getTime()
        console.log(show)
        history({ id: "newShow", newData: { show }, location: { page: "show", project: obj.sel.id === "show" ? get(activeProject) : null } })
      })
      return
    }
    if (obj.sel.id === "slide") {
      // TODO: duplicate slide....
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
    if (obj.sel.id !== "show" || obj.sel.id !== "show_drawer" || !get(activeProject)) return

    projects.update((a) => {
      a[get(activeProject)!].shows.push(...obj.sel.data)
      // sel.data.forEach((b: any) => {
      //   console.log(b, a[get(activeProject)!].shows)

      //   a[get(activeProject)!].shows.push({ id: b.id })
      // })
      return a
    })
  },

  // new
  newShowPopup: () => activePopup.set("show"),

  newShow: () => history({ id: "newShow", location: { page: "show", project: get(activeProject) } }),
  newPrivateShow: () => history({ id: "newShow", newData: { private: true }, location: { page: "show", project: get(activeProject) } }),
  newProject: (obj: any) =>
    history({ id: "newProject", oldData: obj.contextElem.getAttribute("data-parent") || obj.contextElem.id, location: { page: "show", project: get(activeProject) } }),
  newFolder: (obj: any) =>
    history({ id: "newFolder", oldData: obj.contextElem.getAttribute("data-parent") || obj.contextElem.id, location: { page: "show", project: get(activeProject) } }),
  newSlide: () => history({ id: "newSlide", location: { page: "show", show: get(activeShow)!, layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout } }),

  // project
  close: (obj: any) => {
    if (!obj.contextElem.classList.contains("#projectTab") || !get(activeProject)) return
    activeProject.set(null)
    projectView.set(true)
  },
  private: (obj: any) => {
    showsCache.update((a: any) => {
      obj.sel.data.forEach((b: any) => {
        a[b.id].private = !obj.enabled
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
    if (obj.sel.id === "slide") activeEdit.set({ slide: obj.sel.data[0].index, items: [] })
    else if (obj.sel.id === "overlay") activeEdit.set({ type: "overlay", id: obj.sel.data, items: [] })
    activePage.set("edit")
  },

  slide_groups: (obj: any) => {
    obj.sel.data.forEach((a: any) => {
      let slide = GetLayoutRef()[a.index].id
      // TODO: store group/color to redo
      // TODO: change layout children & slide parent children
      history({ id: "changeSlide", newData: { key: "globalGroup", value: obj.menu.id }, location: { page: "show", show: get(activeShow)!, slide } })
    })
  },

  actions: (obj: any) => changeSlideAction(obj, obj.menu.id),

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
