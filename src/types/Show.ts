import type { Resolution } from "./Settings"

export interface Shows {
  [key: string]: Show
}

export interface Show {
  name: string
  private?: boolean
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
  style: string
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
  childOf?: ID
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

export interface Overlays {
  [key: ID]: Overlay
}
export interface Overlay {
  label: string
  color: null | string
  style: string
  items: Item[]
}

export interface OutBackground {
  id: ID
  name?: string
  type?: "media" | "screen" | "camera"
}
export interface OutSlide {
  id: ID
  index: number
  // layout: ID ?
  // type?: ShowType
  // private?: boolean
}
// export interface OutOverlay {
//   id: ID
// }
export interface OutAudio {
  id: ID
  name: string
}
// export interface Output {
//   background: null | {
//     id: ID
//     name: string
//   }
//   slide: null | {
//     id: ID
//     index: number
//     // layout: ID ?
//     private?: boolean
//   }
//   overlay: {
//     id: ID
//   }[]
//   audio: {
//     id: ID
//     name: string
//   }[]
// }

export type ID = string
export type Style = string
export type TransitionType = "none" | "fade"

export type ShowType = null | "image" | "video" | "audio" | "private" // TODO: types
