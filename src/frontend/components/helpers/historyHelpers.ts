import { uid } from "uid"
import { categories, mediaFolders, outOverlays, overlayCategories, shows, templateCategories, templates } from "./../../stores"
import { get } from "svelte/store"
import { drawerTabsData, overlays } from "../../stores"
import type { History } from "./history"

const updateStore: any = {
  overlays: (f: any) => overlays.update(f),
  templates: (f: any) => templates.update(f),
  shows: (f: any) => shows.update(f),
  categories: (f: any) => categories.update(f),
  mediaFolders: (f: any) => mediaFolders.update(f),
  overlayCategories: (f: any) => overlayCategories.update(f),
  templateCategories: (f: any) => templateCategories.update(f),
}

function getStoreNames(historyID: string) {
  let s = {}
  switch (historyID) {
    case "newShowsCategory":
    case "deleteShowsCategory":
      s = { data: "shows", store: "categories" }
      break
    case "newMediaFolder":
    case "deleteMediaFolder":
      s = { data: "media", store: "mediaFolders" }
      break
    case "newOverlaysCategory":
    case "deleteOverlaysCategory":
      s = { data: "overlays", store: "overlayCategories" }
      break
    case "newTemplatesCategory":
    case "deleteTemplatesCategory":
      s = { data: "templates", store: "templateCategories" }
      break
    case "newOverlay":
    case "deleteOverlay":
      s = { store: "overlays" }
      break
    case "newTemplate":
    case "deleteTemplate":
      s = { store: "templates" }
      break
  }
  return s
}

// export function undoHelper()

export function undoAddCategory(obj: History) {
  let s: any = getStoreNames(obj.id)
  console.log(obj.id, s)

  if (!obj.oldData) obj.oldData = { id: obj.newData.id, [s.data]: [] }

  // remove items with category
  updateStore[s.data]?.((a: any) => {
    Object.entries(a).forEach(([tabId, c]: any) => {
      if (c.category === obj.newData.id) {
        obj.oldData[s.data].push(tabId)
        a[tabId].category = null
      }
    })
    return a
  })

  // update active tab
  if (get(drawerTabsData)[s.data].activeSubTab === obj.newData.id) {
    drawerTabsData.update((a) => {
      a[s.data].activeSubTab = null
      return a
    })
  }

  // delete
  updateStore[s.store]((a: any) => {
    obj.oldData.data = a[obj.newData.id]
    delete a[obj.newData.id]
    return a
  })

  return obj
}

export function redoAddCategory(obj: History) {
  let s: any = getStoreNames(obj.id)

  // create data
  if (!obj.newData) {
    let id = uid()
    let icon: null | string = null
    // let tab = get(drawerTabsData)[id].activeSubTab
    // if (tab !== "all" && tab !== "unlabeled") icon = get(drawerTabsData)[id].activeSubTab
    obj.newData = { id, data: { name: "", icon } }
    obj.oldData = { id }
  }

  updateStore[s.store]((a: any) => {
    // set category
    a[obj.newData.id] = obj.newData.data
    return a
  })

  // add if stored
  if (obj.newData[s.data]) {
    updateStore[s.data]?.((a: any) => {
      obj.newData[s.data].forEach((id: string) => (a[id].category = obj.newData.id))
      return a
    })
  }

  // update active tab
  if (get(drawerTabsData)[s.data].activeSubTab !== obj.newData.id) {
    drawerTabsData.update((a) => {
      a[s.data].activeSubTab = obj.newData.id
      return a
    })
  }

  return obj
}

export function undoAddOverlayOrTemplate(obj: History) {
  let s: any = getStoreNames(obj.id)
  let slideId: string = obj.newData?.id

  if (s.store === "overlays") {
    // remove outputted overlays
    if (get(outOverlays).includes(slideId)) outOverlays.set(get(outOverlays).filter((a) => a !== slideId))
  } else if (s.store === "templates") {
    // remove active template in shows with this template ?
  }

  updateStore[s.store]((a: any) => {
    obj.oldData = { data: a[slideId] }
    delete a[slideId]
    return a
  })

  return obj
}

export function redoAddOverlayOrTemplate(obj: History) {
  let s: any = getStoreNames(obj.id)
  // TODO: check for duplicates!!!!

  let category: null | string = null
  if (get(drawerTabsData)[s.store].activeSubTab !== "all" && get(drawerTabsData).templates.activeSubTab !== "unlabeled") category = get(drawerTabsData)[s.store].activeSubTab
  let slide: any = obj.newData?.data || { name: "", color: null, category, items: [] }

  let slideId: string = obj.oldData?.id
  if (!slideId) slideId = uid()

  obj.oldData = { id: slideId }
  updateStore[s.store]((a: any) => {
    a[slideId] = slide
    return a
  })

  return obj
}
