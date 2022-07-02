import { get } from "svelte/store"
import { uid } from "uid"
import { activeEdit, activeShow, clipboard, overlays, showsCache, templates } from "../../stores"
import { history } from "./history"
import { _show } from "./shows"

const copyData: any = {
  item: (data: any) => {
    let ref = _show(data.id || "active")
      .layouts("active")
      .ref()?.[0]?.[data.slide!]
    if (!ref) return null
    return _show(data.id || "active")
      .slides([ref.id])
      .items()
      .get(null, false)[0]
      .filter((_a: any, i: number) => data.items.includes(i))
  },
  slide: (data: any) => {
    let ref = _show("active").layouts("active").ref()?.[0]
    let ids = data.map((a: any) => ref[a.index].id)
    // TODO: copy media too
    return _show("active").slides(ids).get(null)
  },
  overlay: (data: any) => {
    return data.map((id: string) => get(overlays)[id])
  },
  template: (data: any) => {
    return data.map((id: string) => get(templates)[id])
  },
}

export function copy({ id, data }: any, getData: boolean = true) {
  if (!id) return

  if (getData && copyData[id]) data = copyData[id](data)

  if (data) clipboard.set({ id, data })

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
    // clone slides
    data = JSON.parse(JSON.stringify(data))

    // get all slide ids & child ids
    let copiedIds: string[] = []
    let childs: any[] = []
    data.forEach((slide: any) => {
      copiedIds.push(slide.id)
      if (slide.children?.length) childs.push(...slide.children)
    })

    // remove children
    data = data.map((slide: any) => {
      // new slide
      if (slide.group !== null) slide.id = uid()

      // has children
      if (slide.children) {
        let children: string[] = []
        children = slide.children.filter((child: string) => copiedIds.includes(child))
        // if (JSON.stringify(children) !== JSON.stringify(slide.children)) slide.id = uid()
        slide.children = children
      } else if (slide.group === null && !childs.includes(slide.id)) {
        // is child
        slide.id = uid()
        slide.group = ""
      }
      return slide
    })
    // TODO: add at index

    history({ id: "newSlide", newData: { slides: data }, location: { page: "show", show: get(activeShow)!, layout: get(showsCache)[get(activeShow)!.id].settings.activeLayout } })
    setTimeout(() => console.log(get(showsCache)), 1000)
  },
  overlay: (data: any) => {
    data.forEach((slide: any) => {
      slide = JSON.parse(JSON.stringify(slide))
      slide.name += " 2"
      history({ id: "newOverlay", newData: { data: slide } })
    })
  },
  template: (data: any) => {
    data.forEach((slide: any) => {
      slide = JSON.parse(JSON.stringify(slide))
      slide.name += " 2"
      history({ id: "newTemplate", newData: { data: slide } })
    })
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
