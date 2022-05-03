import { uid } from "uid"
import { shows, templates } from "./../../stores"
import { get } from "svelte/store"
import type { DrawerTabIds } from "../../../types/Tabs"
import { drawerTabsData, overlays } from "../../stores"
import type { History } from "./history"

const updateStore: any = {
  overlays: (f: any) => overlays.update(f),
  templates: (f: any) => templates.update(f),
  shows: (f: any) => shows.update(f),
}

// export function undoHelper()

export function undoAddCategory(obj: History, data: any, id: DrawerTabIds) {
  // store data
  if (!obj.oldData) obj.oldData = { id: obj.newData.id, data: data[obj.newData.id], [id]: [] }

  // remove items with category
  updateStore[id]?.((a: any) => {
    Object.entries(a).forEach(([tabId, c]: any) => {
      if (c.category === obj.newData.id) {
        obj.oldData[id].push(tabId)
        a[tabId].category = null
      }
    })
    return a
  })

  // update active tab
  if (get(drawerTabsData)[id].activeSubTab === obj.newData.id) {
    drawerTabsData.update((a) => {
      a[id].activeSubTab = null
      return a
    })
  }

  // delete
  delete data[obj.newData.id]

  return { obj, data }
}

export function redoAddCategory(obj: History, data: any, id: DrawerTabIds) {
  // create data
  if (!obj.newData) {
    let id = uid()
    let icon: null | string = null
    // let tab = get(drawerTabsData)[id].activeSubTab
    // if (tab !== "all" && tab !== "unlabeled") icon = get(drawerTabsData)[id].activeSubTab
    obj.newData = { id, data: { name: "", icon } }
    obj.oldData = { id }
  }

  // set category
  data[obj.newData.id] = obj.newData.data

  // add if stored
  if (obj.newData[id]) {
    updateStore[id]?.((a: any) => {
      obj.newData[id].forEach((id: string) => (a[id].category = obj.newData.id))
      return a
    })
  }

  // update active tab
  if (get(drawerTabsData)[id].activeSubTab !== obj.newData.id) {
    drawerTabsData.update((a) => {
      a[id].activeSubTab = obj.newData.id
      return a
    })
  }

  return { obj, data }
}
