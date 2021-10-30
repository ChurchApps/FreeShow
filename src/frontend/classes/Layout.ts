import type { SlideData } from "../../types/Show"

export default class Layout {
  notes: string
  slides: SlideData[]
  constructor(public name: string) {
    this.name = name
    this.notes = ""
    this.slides = []
  }
}
