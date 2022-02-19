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
    created: number
    modified: null | number
    used: null | number
  }
  meta: {
    title?: string
    artist?: string
    license?: string
    key?: string
  }
  slides: { [key: ID]: Slide }
  layouts: { [key: ID]: Layout }
  backgrounds: { [key: ID]: Backgrounds }
}

export interface Slide {
  group: null | string
  color: null | string
  globalGroup?: string
  settings: {
    background?: boolean
    color?: string
    resolution?: Resolution
    transition?: Transition
  }
  children?: string[]
  notes: string
  items: Item[]
  stageItems?: Item[]
}

export interface Item {
  lines?: Line[]
  auto?: boolean
  style: string
  align?: string
  media?: {}
  type?: ItemType
  // tag?: string; // p, div????
}

export interface Line {
  align: string
  text: {
    value: string
    style: string
  }[]
}

export interface Layout {
  name: string
  notes: string
  slides: SlideData[]
}

export interface SlideData {
  id: ID
  disabled?: boolean
  parent?: ID // layout ref
  children?: any // layout slide
  color?: null | string
  transition?: Transition
  end?: boolean
  timer?: number
  background?: string // set backgorund action?
  overlays?: string[]
  audio?: string[]
  actions?: {} // to begininng / index, clear (all), start timer, start audio/music ++
}

export interface Transition {
  type: TransitionType
  duration: number
}

export interface Backgrounds {
  // name?: string
  path: string
  type?: BackgroundType
  muted?: boolean
  loop?: boolean
  filters?: string
}

//

export interface Overlays {
  [key: ID]: Overlay
}
export interface Overlay {
  name: string
  color: null | string
  category: null | string
  items: Item[]
}

export interface Templates {
  [key: ID]: Template
}
export interface Template {
  name: string
  color: null | string
  category: null | string
  items: Item[]
}

// output

export interface OutBackground {
  id?: ID
  path?: string
  startAt?: number
  muted?: boolean
  loop?: boolean
  filter?: string
  // name?: string
  type?: BackgroundType
}

export interface OutSlide {
  id: ID
  layout: ID
  index: number
  // layout: ID ?
  // type?: ShowType
  // private?: boolean
}

export interface OutAudio {
  id: ID
  name: string
}

export interface OutTransition extends Transition {
  action: string
  slide?: number
}

// types

export type ID = string
export type ItemType = "text" | "shape" | "image" | "video" | "music"
export type ShowType = "show" | "image" | "video" | "audio" | "player" // "private"
export type TransitionType = "none" | "fade"
export type BackgroundType = "media" | "screen" | "camera" | "player"
