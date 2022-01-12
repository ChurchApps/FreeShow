import type { SlideData, Slide } from "../../../types/Show"

export const getSlide = (show: any, slideIndex: number): Slide => {
  return show.slides[GetLayout(show)[slideIndex]?.id]
}

export const GetLayout = (show: any): SlideData[] => {
  let layoutSlides: SlideData[] = []
  if (show) {
    show.layouts[show.settings.activeLayout].slides.forEach((ls: any) => {
      let slide: Slide = show.slides[ls.id]
      layoutSlides.push({ ...ls, color: slide.color })
      if (slide.children) {
        slide.children.forEach((id) => {
          if (ls.children?.[id]) {
            let slideData: any = ls.children[id]
            if (slideData) layoutSlides.push({ id, ...slideData, color: slide.color, parent: ls.id })
          }
        })
      }
    })
  }
  return layoutSlides
}
