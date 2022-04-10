import { get } from "svelte/store"
import { activeEdit, activeShow, clipboard, showsCache } from "../../stores"
import { history } from "./history"
import { _show } from "./shows"

const copyData: any = {
  item: (data: any) => {
    let ref = _show(data.id || "active")
      .layouts("active")
      .ref()?.[0][data.slide!]
    return _show(data.id || "active")
      .slides([ref.id])
      .items()
      .get(null, false)[0]
      .filter((_a: any, i: number) => data.items.includes(i))
  },
  slide: (data: any) => {
    let ref = _show("active").layouts("active").ref()?.[0]
    let ids = data.map((a: any) => ref[a.index].id)
    return _show("active").slides(ids).get(null, false)
  },
}

export function copy({ id, data }: any, getData: boolean = true) {
  if (!id) return

  if (getData && copyData[id]) data = copyData[id](data)

  clipboard.set({ id, data })

  console.log("COPIED:", id)
  console.log("CLIPBOARD", get(clipboard))
}

const paster: any = {
  item: (data: any) => {
    let ref = _show(get(activeEdit).id || "active")
      .layouts("active")
      .ref()?.[0][get(activeEdit).slide!]
    data.forEach((item: any) => {
      history({ id: "newItem", newData: item, location: { page: "edit", show: { id: get(activeEdit).id || get(activeShow)!.id }, slide: ref.id } })
    })
  },
  slide: (data: any) => {
    // TODO: copying parent and children...
    history({ id: "newSlide", newData: { slides: data }, location: { page: "show", show: get(activeShow)!, layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout } })
  },
}

export function paste() {
  let clip = get(clipboard)
  if (clip.id === null) return

  if (paster[clip.id]) {
    paster[clip.id](clip.data)
    console.log("PASTED:", clip)
  }
}
