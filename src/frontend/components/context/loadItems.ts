import { get } from "svelte/store"
import { activeShow, drawerTabsData, groups, selected, showsCache } from "../../stores"
import { drawerTabs } from "../../values/tabs"
import { GetLayoutRef } from "../helpers/get"
import type { ContextMenuItem } from "./contextMenus"

export function loadItems(id: string): [string, ContextMenuItem][] {
  let items: [string, ContextMenuItem][] = []
  switch (id) {
    case "enabled_drawer_tabs":
      Object.entries(drawerTabs).forEach(([aID, a], i) => {
        if (i >= 2) items.push([id, { id: aID, label: a.name, icon: a.icon, enabled: get(drawerTabsData)[aID].enabled }])
      })
      break
    case "slide_groups":
      let currentGroup = get(showsCache)[get(activeShow)!.id].slides[GetLayoutRef()[get(selected).data[0]?.index].id].globalGroup
      Object.entries(get(groups)).forEach(([aID, a]: any) => {
        items.push([id, { id: aID, color: a.color, label: a.default ? "groups." + a.name : a.name, translate: a.default, enabled: aID === currentGroup }])
      })
      break
  }
  return items
}
