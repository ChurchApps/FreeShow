import { GetLayout } from "./../../helpers/get"
import { activeEdit, activeShow, overlays, showsCache, templates } from "../../../stores"
import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, ItemType } from "../../../../types/Show"
import { history } from "../../helpers/history"

export function addItem(type: ItemType, id: any = null) {
  let activeTemplate: string | null = get(activeShow)?.id ? get(showsCache)[get(activeShow)!.id!].settings.template : null
  let template = activeTemplate ? get(templates)[activeTemplate].items : null

  let newData: Item = {
    style: template?.[0].style || "top:121px;left:50.5px;height:840px;width:1820px;",
    type,
  }
  if (id) newData.id = id

  if (type === "text") newData.lines = [{ align: template?.[0].lines?.[0].align || "", text: [{ value: "", style: template?.[0].lines?.[0].text?.[0].style || "" }] }]
  else if (type === "timer") newData.timer = { id: uid(), name: "", type: "countdown", start: 300, end: 0, format: "MM:SS" }
  console.log(newData)

  if (get(activeEdit).type === "overlay") {
    // TODO: history
    overlays.update((a) => {
      a[get(activeEdit).id!].items.push(newData)
      return a
    })
  } else if (get(activeEdit).type === "template") {
    // TODO: history
    templates.update((a) => {
      a[get(activeEdit).id!].items.push(newData)
      return a
    })
  } else if (!get(activeEdit).id) {
    history({
      id: "newItem",
      oldData: null,
      newData,
      location: { page: "edit", show: get(activeShow)!, slide: GetLayout()[get(activeEdit).slide!].id },
    })
  }
}
