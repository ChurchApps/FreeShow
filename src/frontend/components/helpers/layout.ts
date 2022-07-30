import { uid } from "uid"
import { _show } from "./shows"

export function getCurrentLayout() {
  let slides: any = JSON.parse(JSON.stringify(_show("active").get().slides))
  let layout: any[] = _show("active").layouts("active").get()[0].slides
  return JSON.parse(JSON.stringify({ slides, layout }))
}

export function cloneSlide(currentLayout: any, oldSlideId: string, newSlideId: string, keepChildren: boolean = true) {
  let newSlide: any = JSON.parse(JSON.stringify(currentLayout.slides[oldSlideId]))

  // cloning a parent means that all its children must be cloned too
  if (newSlide.children) {
    if (keepChildren) {
      // clone children
      let clonedChildren: any[] = []
      newSlide.children.forEach((childId: string) => {
        let newChild: any = JSON.parse(JSON.stringify(currentLayout.slides[childId]))
        let newChildId: string = uid()
        currentLayout.slides[newChildId] = newChild
        clonedChildren.push(newChildId)
      })
      newSlide.children = clonedChildren
    } else delete newSlide.children
  }

  currentLayout.slides[newSlideId] = newSlide

  console.log("NEW SLIDE CLONE", newSlide)
  return currentLayout
}

export function addParents(currentLayout: any, parents: { id: string; pos: number }[]) {
  parents
    .sort((a: any, b: any) => (a.pos < b.pos ? 1 : -1))
    .forEach(({ id, pos }: any) => {
      currentLayout.layout = [...currentLayout.layout.slice(0, pos), { id }, ...currentLayout.layout.slice(pos, currentLayout.layout.length)]
    })
  return currentLayout
}
