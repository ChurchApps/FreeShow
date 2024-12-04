import { uid } from "uid"
import { clone } from "./array"
import { _show } from "./shows"

export function getCurrentLayout() {
    const slides: any = clone(_show("active").get().slides)
    const layout: any[] = _show("active").layouts("active").get()[0].slides
    return clone({ slides, layout })
}

export function cloneSlide(currentLayout: any, oldSlideId: string, newSlideId: string, keepChildren = true) {
    const newSlide: any = clone(currentLayout.slides[oldSlideId])

    // cloning a parent means that all its children must be cloned too
    if (newSlide.children) {
        if (keepChildren) {
            // clone children
            const clonedChildren: any[] = []
            newSlide.children.forEach((childId: string) => {
                const newChild: any = clone(currentLayout.slides[childId])
                const newChildId: string = uid()
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

export function addParents(currentLayout: any, parents: { id: string; data: any; pos: number }[]) {
    parents
        .sort((a: any, b: any) => (a.pos < b.pos ? 1 : -1))
        .forEach(({ id, data, pos }: any) => {
            currentLayout.layout = [...currentLayout.layout.slice(0, pos), { id, ...data }, ...currentLayout.layout.slice(pos, currentLayout.layout.length)]
        })
    return currentLayout
}
