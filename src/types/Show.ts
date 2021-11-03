import type { Resolution } from "./Settings"

export interface Shows {
  [key: string]: Show
}

export interface Show {
  name: string
  category: null | ID
  settings: {
    activeLayout: ID
    resolution?: Resolution
    template: null | ID
  }
  timestamps: {
    created: Date
    modified: null | Date
    used: null | Date
  }
  meta: {
    title?: string
    artist?: string
    license?: string
    key?: string
  }
  slides: { [key: ID]: Slide }
  layouts: { [key: ID]: Layout }
}

export interface Slide {
  label: null | string
  color: null | string
  children?: SlideData[]
  notes: string
  items: Item[]
  stageItems?: Item[]
}

export interface Item {
  text?: {
    value: string
    style: Style
  }[]
  style: Style
  media?: {}
  // tag?: string; // p, div????
  // type: // text, shape, image, video++
}

export interface Layout {
  name: string
  notes: string
  slides: SlideData[]
}

// export interface LayoutSlideData {
//   id: string
//   transition: {
//     type: "none" | "fade"
//     duration: number
//   }
//   background: {}
//   overlay: {}
//   actions: {}
// }

export interface SlideData {
  id: ID
  color?: null | string
  transition?: Transition
  timer?: number
  background?: {} // set backgorund action?
  actions?: {} // to begininng / index, clear (all), start timer, start audio/music ++
}

export interface Transition {
  type: TransitionType
  duration: number
}

export interface Output {
  background: null | ID
  slide: null | {
    id: ID
    index: number
    // layout: ID ?
    private?: boolean
  }
  overlay: null | ID
  audio: null | ID
}
export interface OutputValues {
  background: null | string
  slide: null | Slide
  overlay: null | string
  audio: null | string
}

export type ID = string
export type Style = string
export type TransitionType = "none" | "fade"

export type ShowType = null | "image" | "video" | "audio" | "private" // TODO: types
