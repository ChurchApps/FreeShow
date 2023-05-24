import type { Resolution } from "./Settings"

export interface Shows {
    [key: string]: Show
}

export interface Show {
    name: string
    private?: boolean
    category: null | ID
    reference?: {
        type: "calendar" | "scripture"
        data: any
    }
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
    message?: {
        text: string
        template: string
    }
    metadata?: {
        override: boolean
        display: string
        template: string
    }
    meta: {
        title?: string
        artist?: string
        author?: string
        composer?: string
        publisher?: string
        copyright?: string
        CCLI?: string
        year?: string
    }
    slides: { [key: ID]: Slide }
    layouts: { [key: ID]: Layout }
    media: { [key: ID]: Media }
    midi?: { [key: ID]: Midi }
}

export interface ShowList extends Show {
    id: string
    match?: number
}

export interface Slide {
    group: null | string
    color: null | string
    globalGroup?: string
    settings: {
        background?: boolean
        color?: string
        resolution?: Resolution
    }
    children?: string[]
    notes: string
    items: Item[]
    stageItems?: Item[]
}

export interface Item {
    id?: string
    lines?: Line[]
    auto?: boolean
    style: string
    align?: string
    media?: any
    timer?: Timer
    clock?: Clock
    type?: ItemType
    mirror?: Mirror
    src?: string
    fit?: string
    filter?: string
    flipped?: boolean
    chords?: boolean // stage
    // media: fit, startAt, endAt
    // tag?: string; // p, div????
}

export interface Timer {
    id?: string
    name: string
    type: "counter" | "clock" | "event"
    start?: number
    end?: number
    event?: string
    time?: string
    // format?: string
    // paused?: boolean
}

export interface Clock {
    type: "digital" | "analog"
    seconds: boolean
}

export interface Mirror {
    show?: string
}

export interface Line {
    align: string
    text: {
        value: string
        style: string
    }[]
    chords?: Chords[]
}

export interface Chords {
    id: string
    pos: number
    key: string
}

export interface Layout {
    id?: string
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
    // TODO: this is next slide timer
    nextTimer?: number
    transition?: Transition
    filterEnabled?: ["background", "foreground"]
    filter?: string
    end?: boolean
    timer?: number
    background?: string // set backgorund action?
    overlays?: string[]
    audio?: string[]

    actions?: {
        clearBackground?: boolean
        clearOverlays?: boolean
        clearAudio?: boolean
    }
    // actions?: {} // to begininng / index, clear (all), start timer, start audio/music ++
}

export interface Transition {
    type: TransitionType
    duration: number
    easing: string
}

export interface Media {
    // name?: string
    id?: string
    name?: string
    path?: string
    cameraGroup?: string
    type?: MediaType
    muted?: boolean
    loop?: boolean
    filters?: string
}

export interface Midi {
    name: string
    input?: string
    output?: string
    action?: string
    type: "noteon" | "noteoff" | "cc"
    values: {
        note: number
        velocity: number
        channel: number
    }
}

export interface MidiIn extends Midi {
    shows: {
        id: string
        // layoutId: string
        // index: number
    }[]
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
    locked?: boolean
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
    name?: string
    startAt?: number
    muted?: boolean
    loop?: boolean
    filter?: string
    flipped?: boolean
    // name?: string
    type?: MediaType
}

export interface OutSlide {
    id: ID
    layout?: ID
    index?: number
    tempItems?: Item[]
    line?: number
    // layout: ID ?
    // type?: ShowType
    // private?: boolean
}

export interface OutTransition {
    // action: string
    // slide?: number
    duration: number
}

// types

export type ID = string
export type ItemType = "text" | "shape" | "media" | "mirror" | "icon" | "timer" | "clock" // "image" | "video"
export type ShowType = "show" | "image" | "video" | "audio" | "player" | "section" // "private"
export type TransitionType = "none" | "blur" | "fade" | "fly" | "scale" | "slide" | "spin"
export type MediaType = "media" | "video" | "image" | "screen" | "camera" | "player" | "audio"
