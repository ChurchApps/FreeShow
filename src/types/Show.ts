import type { Resolution } from "./Settings"

export interface Shows {
    [key: string]: Show
}

export interface Show {
    name: string
    id?: string // this id should not be stored (but often used in the program as a temporary value)
    private?: boolean // hide from drawer
    locked?: boolean // disable edits
    category: null | ID
    quickAccess?: any
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
        template?: string
    }
    metadata?: {
        autoMedia?: boolean
        override: boolean
        display: string
        template: string
        tags?: string[]
    }
    meta: {
        number?: string
        title?: string
        artist?: string
        author?: string
        composer?: string
        publisher?: string
        copyright?: string
        CCLI?: string
        year?: string
        key?: string
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
    id?: string // used for reference, but might not be removed
    group: null | string
    color: null | string
    globalGroup?: string
    settings: {
        template?: string
        background?: boolean
        color?: string
        resolution?: Resolution
    }
    children?: string[]
    notes: string
    items: Item[]
}

export interface Item {
    id?: string
    lines?: Line[]
    list?: List
    auto?: boolean
    textFit?: string // auto size text fix option (default: shrinkToFit)
    autoFontSize?: number // only used to store the calculated auto size text size
    style: string
    align?: string
    specialStyle?: any // line gap && line background
    media?: any
    timer?: Timer // pre 0.8.3 // also local backup?
    timerId?: string
    clock?: Clock
    events?: DynamicEvent
    type?: ItemType
    mirror?: Mirror
    src?: string
    customSvg?: string
    device?: any // camera
    fit?: string
    filter?: string
    flipped?: boolean
    flippedY?: boolean // media item
    muted?: boolean // media item
    variable?: any
    web?: any
    tracker?: any // slide progress tracker item data
    bindings?: string[] // bind item to stage or an output
    actions?: any // showTime | hideTime
    chords?: any
    scrolling?: Scrolling
    visualizer?: any
    captions?: any
    language?: string // used to store auto localized text
    // media: fit, startAt, endAt
    // tag?: string; // p, div????
}

export interface Timer {
    id?: string
    name: string
    type: "counter" | "clock" | "event"
    viewType?: "time" | "line" | "circle"
    circleMask?: boolean
    start?: number
    end?: number
    event?: string
    time?: string
    overflow?: boolean
    overflowColor?: string
    // format?: string
    // paused?: boolean
}

export interface Clock {
    type: "digital" | "analog"
    seconds: boolean
}

export interface DynamicEvent {
    maxEvents: number
    startDaysFromToday: number
    justOneDay: boolean
    enableStartDate: boolean
    startDate?: string
    startTime?: string
}

export interface Scrolling {
    type: "none" | "top_bottom" | "bottom_top" | "left_right" | "right_left"
    speed?: number
}

export interface Mirror {
    show?: string
    stage?: string
    enableStage?: boolean
    nextSlide?: boolean
    useSlideIndex?: boolean
    index?: number
}

export interface Line {
    align: string
    text: {
        value: string
        style: string
        customType?: string // "disableTemplate"
    }[]
    chords?: Chords[]
}

export interface List {
    style?: string
    interval?: number
    items: ListItem[]
}
export interface ListItem {
    text: string
    icon?: string
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
    recording?: Recording[]
    slides: SlideData[]
}

export interface Recording {
    id: string
    // name: string
    useDurationTime?: boolean
    layoutAtRecording: string // store layout ids to detect changes
    sequence: {
        time: number
        slideRef: { id: string; index: number }
    }[]
}

export interface SlideData {
    id: ID
    disabled?: boolean
    parent?: ID // layout ref
    children?: any // layout slide
    color?: null | string
    nextTimer?: number // next slide timer
    transition?: Transition
    filterEnabled?: ["background", "foreground"]
    filter?: string
    end?: boolean // go to start
    timer?: number
    background?: string // set backgorund action?
    overlays?: string[]
    audio?: string[]

    actions?: {
        // ...
        slideActions?: any[]
    }
    // actions?: {} // to begininng / index, clear (all), start timer, start audio/music ++
    bindings?: string[] // bind slide to an output
}

export interface Transition {
    type: TransitionType
    duration: number
    easing: string
    delay?: number // item in/out wait
    custom?: any // e.g. transition direction

    between?: TransitionData
    in?: TransitionData
    out?: TransitionData
}

export interface TransitionData {
    type: TransitionType
    duration: number
    easing: string
    delay?: number // item in/out wait
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
    base64?: string // saving media data
    cloud?: { [key: string]: string }
}

export interface Midi {
    name: string
    triggers: string[]
    actionValues?: any[]
    // action?: string
    // actionData?: any
    shows?: any[] // ??
    customActivation?: string
    keypressActivate?: string
    midiEnabled?: boolean
    midi?: {
        input?: string
        output?: string
        type: "noteon" | "noteoff" | "cc"
        values: {
            note: number
            velocity: number
            channel: number
        }
    }
}

export interface MidiIn extends Midi {
    enabled?: boolean
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
    placeUnderSlide?: boolean
}

export interface Templates {
    [key: ID]: Template
}
export interface Template {
    name: string
    color: null | string
    category: null | string
    settings?: TemplateSettings
    items: Item[]
}
export interface TemplateSettings {
    resolution?: Resolution
    backgroundColor?: string
    backgroundPath?: string
    overlayId?: string
    firstSlideTemplate?: string
    actions?: any[]
}

// output

export interface OutBackground {
    id?: ID
    path?: string
    name?: string
    type?: MediaType
    // video / player
    startAt?: number
    muted?: boolean
    loop?: boolean
    // media
    filter?: string
    flipped?: boolean
    flippedY?: boolean
    title?: string // player
    cameraGroup?: string // camera
}

export interface OutSlide {
    id: ID
    layout?: ID
    index?: number
    tempItems?: Item[]
    line?: number
    // layout: ID ?
    name?: string // mostly used for PDFs
    type?: ShowType // mostly used for PDFs
    page?: number // PDF
    pages?: number // PDF
    viewport?: { width: number; height: number } // PDF
    screen?: { id: string; name?: string } // PPT
}

export interface OutTransition {
    // action: string
    // slide?: number
    duration: number
}

// types

export type ID = string
export type ItemType = "text" | "list" | "media" | "camera" | "timer" | "clock" | "events" | "variable" | "web" | "mirror" | "icon" | "slide_tracker" | "visualizer" | "captions" // "shape" | "video" | "media" | "camera"
export type ShowType = "show" | "image" | "video" | "audio" | "player" | "section" | "overlay" | "pdf" | "ppt" // "private"
export type TransitionType = "none" | "blur" | "fade" | "crossfade" | "fly" | "scale" | "slide" | "spin"
export type MediaType = "media" | "video" | "image" | "screen" | "camera" | "player" | "audio"
