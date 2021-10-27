import type { ID } from "../../types/Show"

export class OutputObject {
  background: null | ID = null
  slide: null | {
    id: ID
    index: number
  } = null
  overlay: null | ID = null
  audio: null | ID = null

  constructor() {
    this.background = null
    this.slide = null
    this.overlay = null
    this.audio = null
  }
}
