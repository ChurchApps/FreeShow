import { get } from "svelte/store"
import { drawerTabsData, groups, selected } from "../../stores"
import { translate } from "../../utils/language"
import { drawerTabs } from "../../values/tabs"
import { GetLayoutRef } from "../helpers/get"
import { _show } from "../helpers/shows"
import type { ContextMenuItem } from "./contextMenus"

export function loadItems(id: string): [string, ContextMenuItem][] {
  let items: [string, ContextMenuItem][] = []
  switch (id) {
    case "enabled_drawer_tabs":
      Object.entries(drawerTabs).forEach(([aID, a]: any, i) => {
        if (i >= 2) items.push([id, { id: aID, label: a.name, icon: a.icon, enabled: get(drawerTabsData)[aID].enabled }])
      })
      break
    case "slide_groups":
      let currentGroup = _show("active")
        .slides([GetLayoutRef()[get(selected).data[0]?.index].id])
        .get("globalGroup")[0]
      Object.entries(get(groups)).forEach(([aID, a]: any) => {
        items.push([id, { id: aID, color: a.color, label: a.default ? "groups." + a.name : a.name, translate: a.default, enabled: aID === currentGroup }])
      })
      items = items.sort((a, b) => {
        let aName = a[1].translate ? translate(a[1].label) : a[1].label
        let bName = b[1].translate ? translate(b[1].label) : b[1].label
        return aName.localeCompare(bName)
      })
      break
    case "actions":
      let currentActions: any = _show("active").layouts("active").ref()[0][get(selected).data[0]?.index].data.actions
      let actions = [
        { id: "clearBackground", label: "clear.background", icon: "background", enabled: currentActions?.clearBackground || false },
        { id: "clearOverlays", label: "clear.overlays", icon: "overlays", enabled: currentActions?.clearOverlays || false },
        { id: "clearAudio", label: "clear.audio", icon: "audio", enabled: currentActions?.clearAudio || false },
      ]
      actions.forEach((action: any) => items.push([id, action]))
      break
  }
  return items
}
