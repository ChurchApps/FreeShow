import { uid } from "uid"
import type { Show } from "./../../types/Show"

export class ShowObj implements Show {
  name: string
  private: boolean
  category: any
  settings: any
  timestamps: any
  meta: any
  slides: any
  layouts: any
  backgrounds: any
  constructor(isPrivate: boolean = false, category: null | string = null, layoutID: string = uid(), created: Date = new Date()) {
    // private?: boolean,
    this.name = ""
    this.private = isPrivate
    // this.private = private
    this.category = category
    this.settings = {
      activeLayout: layoutID,
      template: null,
    }
    ;(this.timestamps = {
      created,
      modified: null,
      used: null,
    }),
      (this.meta = {})
    this.slides = {}
    this.layouts = { [layoutID]: { name: "", notes: "", slides: [] } }
    this.backgrounds = {}
  }
}
