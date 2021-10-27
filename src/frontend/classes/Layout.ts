import type { LayoutSlideData } from "../../types/Show"

export default class Layout {
  notes: string
  slides: LayoutSlideData[]
  constructor(public name: string) {
    this.name = name
    this.notes = ""
    this.slides = []
  }
}
