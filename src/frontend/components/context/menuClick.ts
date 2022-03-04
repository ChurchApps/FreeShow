import { get } from "svelte/store"
import { MAIN } from "../../../types/Channels"
import { activeEdit, activePage, activePopup, activeProject, activeShow, drawerTabsData, projects, projectView, saved, selected, showsCache } from "../../stores"
import { save } from "../../utils/save"
import { history, redo, undo } from "../helpers/history"
import { GetLayoutRef } from "../helpers/get"
import { _show } from "../helpers/shows"

export function menuClick(id: string, enabled: boolean = true, menu: any = null, contextElem: any = null, actionItem: any = null, sel: any = null) {
  let m: any = { hide: true }

  switch (id) {
    // file
    case "save":
      save()
      break
    case "settings":
      activePage.set("settings")
      break
    case "quit":
      if (get(saved)) window.api.send(MAIN, { channel: "CLOSE" })
      else activePopup.set("unsaved")
      break
    // view
    case "fullscreen":
      window.api.send(MAIN, { channel: "FULLSCREEN" })
      break
    // edit
    case "undo":
      undo()
      break
    case "redo":
      redo()
      break
    // view
    // help
    case "docs":
      window.api.send(MAIN, { channel: "URL", data: "https://freeshow.app/docs" })
      break
    case "about":
      activePopup.set("about")
      break

    // main
    case "rename":
      if (sel.id === "slide" || sel.id === "group") {
        activePopup.set("rename")
      } else {
        if (actionItem instanceof HTMLInputElement) {
          // actionItem.focus()
          console.log(actionItem.value)
          // actionItem!.dispatchEvent(new CustomEvent("doubleclick"))
        } else if (actionItem) {
          // actionItem.click()
          console.log(actionItem.innerHTML)
          // actionItem.dispatchEvent(new CustomEvent("contextmenu"))
        }
      }
      break
    case "remove":
      if (sel.id === "show" && get(activeProject)) {
        // TODO: don't remove private!!!!
        projects.update((a) => {
          sel.data.forEach((b: any) => {
            a[get(activeProject)!].shows = a[get(activeProject)!].shows.filter((a) => a.id !== b.id)

            if (get(activeShow)?.index === b.index) {
              activeShow.update((a) => {
                delete a!.index
                return a
              })
            }
          })
          return a
        })
      } else if (sel.id === "slide") {
        sel.data.forEach((a: any) => {
          let slide = GetLayoutRef()[a.index].id
          // TODO: change layout children & slide parent children
          history({ id: "changeSlide", newData: { group: null, color: null, globalGroup: null }, location: { page: "show", show: get(activeShow)!, slide } })
        })
      }
      break
    case "remove_slide":
      let location: any = { page: "show", show: get(activeShow)!, layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout }
      let ref = _show(location.show).layouts([location.layout]).ref()[0]
      let parents: any[] = []
      let childs: any[] = []

      // remove parents and delete childs
      sel.data.forEach((a: any) => {
        if (ref[a.index].type === "parent") parents.push(ref[a.index].index)
        else childs.push(ref[a.index].id)
      })
      // TODO: "delete" in menu if child...
      console.log(parents, childs)

      if (parents.length) {
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
      break
    case "delete":
      if (sel.id === "show_drawer") {
        activePopup.set("delete_show")
      } else if (sel.id === "category") {
        sel.data.forEach((a: any) => {
          history({ id: "deleteShowsCategory", newData: { id: a } })
        })
      }
      break
    case "duplicate":
      if (sel.id === "show" || sel.id === "show_drawer") {
        sel.data.forEach((a: any) => {
          let show = { ...get(showsCache)[a.id] }
          show.name += " #2"
          show.timestamps.modified = new Date().getTime()
          console.log(show)
          history({ id: "newShow", newData: { show }, location: { page: "show", project: sel.id === "show" ? get(activeProject) : null } })
        })
      } else if (sel.id === "slide") {
        // TODO: duplicate slide....
      }
      break
    // drawer
    case "enabled_drawer_tabs":
      m.hide = false
      m.enabled = !enabled
      drawerTabsData.update((a) => {
        a[menu.id!].enabled = !enabled
        return a
      })
      break
    case "addToProject":
      if ((sel.id === "show" || sel.id === "show_drawer") && get(activeProject)) {
        projects.update((a) => {
          a[get(activeProject)!].shows.push(...sel.data)
          // sel.data.forEach((b: any) => {
          //   console.log(b, a[get(activeProject)!].shows)

          //   a[get(activeProject)!].shows.push({ id: b.id })
          // })
          return a
        })
      }
      break
    // new
    case "newShowPopup":
      activePopup.set("show")
      break
    case "newShow":
    case "newProject":
    case "newFolder":
    case "newPrivateShow":
      let oldData = null
      if (id === "newProject" || id === "newFolder") oldData = contextElem.getAttribute("data-parent") || contextElem.id
      history({ id, oldData, location: { page: "show", project: get(activeProject) } })
      break
    // project
    case "close":
      if (contextElem.classList.contains("#projectTab") && get(activeProject)) {
        activeProject.set(null)
        projectView.set(true)
      }
      break
    case "private":
      showsCache.update((a) => {
        sel.data.forEach((b: any) => {
          a[b.id].private = !enabled
        })
        return a
      })
      break
    // show
    case "disable":
      if (sel.id === "slide") {
        showsCache.update((a) => {
          sel.data.forEach((b: any) => {
            let ref = GetLayoutRef()[b.index]
            if (ref.type === "child") a[get(activeShow)!.id].layouts[a[get(activeShow)!.id].settings.activeLayout].slides[ref.layoutIndex].children[ref.id].disabled = !enabled
            else a[get(activeShow)!.id].layouts[a[get(activeShow)!.id].settings.activeLayout].slides[ref.index].disabled = !enabled
          })
          return a
        })
      } else if (sel.id === "group") {
        showsCache.update((a) => {
          let ref = GetLayoutRef()
          ref.forEach((b: any) => {
            sel.data.forEach((c: any) => {
              console.log(b)
              if (b.type === "child" && b.parent === c.id)
                a[get(activeShow)!.id].layouts[a[get(activeShow)!.id].settings.activeLayout].slides[b.layoutIndex].children[b.id].disabled = !enabled
              else if (b.id === c.id) a[get(activeShow)!.id].layouts[a[get(activeShow)!.id].settings.activeLayout].slides[b.layoutIndex || b.index].disabled = !enabled
            })
          })
          return a
        })
      }
      break
    case "edit":
      if (sel.id === "slide") {
        activeEdit.set({ slide: sel.data[0].index, items: [] })
      }
      activePage.set("edit")
      break
    case "slide_groups":
      sel.data.forEach((a: any) => {
        let slide = GetLayoutRef()[a.index].id
        // TODO: store group/color to redo
        // TODO: change layout children & slide parent children
        history({ id: "changeSlide", newData: { globalGroup: menu.id }, location: { page: "show", show: get(activeShow)!, slide } })
      })
      break
    // drawer navigation
    case "changeIcon":
      activePopup.set("icon")
      break
    case "selectAll":
      let data: any[] = []
      if (sel.id === "group") {
        let ref = GetLayoutRef()
        sel.data.forEach((a: any) => {
          ref.forEach((b, i) => {
            if (b.type === "child" ? a.id === b.parent : a.id === b.id) data.push({ index: i })
          })
        })
        selected.set({ id: "slide", data })
      } else if (get(activeShow)) {
        data = GetLayoutRef().map((_a, index) => ({ index }))
      }
      selected.set({ id: "slide", data })
      break

    default:
      console.log("MISSING CONTEXT: ", id)
      break
  }

  return m
}
