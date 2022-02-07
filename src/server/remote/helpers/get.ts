import type { SlideData, Slide } from "../../../types/Show"

export const getSlide = (show: any, slide: any, layout: any): Slide => {
  return show.slides[GetLayout(show, layout)[slide]?.id]
}

export function nextSlide(layout: any, currentSlide: number, previous: boolean = false): null | number {
  console.log("NEXT")

  console.log(currentSlide)
  let index = previous ? currentSlide - 1 : currentSlide + 1

  while ((previous ? index > 0 : index < layout!.length) && (layout![index]?.disabled || (!previous && layout![index - 1]?.end))) {
    if (!previous && layout![index - 1]?.end) index = 0
    else index = previous ? index - 1 : index + 1
  }
  console.log(layout, index)

  return layout![index] && !layout![index].disabled ? index : null
}

export const getNextSlide = (show: any, slideIndex: number, layout: string = show.settings.activeLayout): Slide => {
  let index = nextSlide(GetLayout(show, layout), slideIndex)
  console.log(index)

  return index === null ? null : show.slides[GetLayout(show, layout)[slideIndex]?.id]
}

export const GetLayout = (show: any, layout: string): SlideData[] => {
  let layoutSlides: SlideData[] = []
  if (show && layout) {
    show.layouts[layout]?.slides.forEach((ls: any) => {
      let slide: Slide = show.slides[ls.id]
      layoutSlides.push({ ...ls, color: slide.color })
      if (slide.children) {
        slide.children.forEach((id) => {
          if (ls.children?.[id]) {
            let slideData: any = ls.children[id]
            if (slideData) layoutSlides.push({ id, ...slideData, color: slide.color, parent: ls.id })
          } else layoutSlides.push({ id, color: slide.color, parent: ls.id })
        })
      }
    })
  }
  return layoutSlides
}
