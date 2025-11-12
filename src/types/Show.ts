import type { AutosizeTypes } from "../frontend/components/edit/scripts/autosize"
import type { Input } from "./Input"
import type { Animation } from "./Output"
import type { Resolution } from "./Settings"

export interface Shows {
    [key: string]: Show
}

export interface Show {
    name: string
    id?: string // this id should not be stored (but often used in the program as a temporary value)
    origin?: string // "pco" | "churchApps" | "hymnary", etc.
    private?: boolean // hide from drawer
    locked?: boolean // disable edits
    category: null | ID
    quickAccess?: any
    reference?: {
        type: "calendar" | "scripture" | "lessons"
        data: any
    }
    settings: {
        activeLayout: ID
        // resolution?: Resolution
        template: null | ID
        customAction?: string // special custom trigger
        customFonts?: { name: string; path: string }[]
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
    midi?: { [key: ID]: Action }
}

export interface TrimmedShows {
    [key: string]: TrimmedShow
}
export interface TrimmedShow {
    name: string
    origin?: string
    category: null | ID
    timestamps: {
        created: number
        modified: null | number
        used: null | number
    }
    quickAccess?: any
    private?: boolean
    locked?: boolean
}

export interface ShowList extends TrimmedShow {
    id: string
    match?: number
    originalMatch?: number
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
    textFit?: AutosizeTypes // auto size text fix option (default: shrinkToFit)
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
    decoration?: boolean // ppt imported shapes (no selection directly)
    mirror?: Mirror
    src?: string // media item path
    customSvg?: string
    device?: any // camera
    fit?: string
    filter?: string
    flipped?: boolean
    flippedY?: boolean // media item
    muted?: boolean // media item
    loop?: boolean // media item
    speed?: number // media item
    variable?: any
    web?: any
    tracker?: any // slide progress tracker item data
    bindings?: string[] // bind item to stage or an output
    actions?: any // showTime | hideTime | transition
    clickReveal?: boolean
    lineReveal?: boolean
    chords?: { enabled?: boolean; color?: string; size?: number; offsetY?: number }
    scrolling?: Scrolling
    button?: { press?: string; release?: string } // click actions
    weather?: Weather
    visualizer?: any
    captions?: any
    language?: string // used to store auto localized text
    fromTemplate?: boolean // these will be removed if another template is applied
    // media: fit, startAt, endAt
    // tag?: string; // p, div????
    conditions?: { [key: string]: Condition }
}

export interface LayoutRef {
    type: "parent" | "child"
    layoutId: string
    index: number
    layoutIndex: number
    id: string
    children?: string[]
    parent?: { id: string; index: number; layoutIndex: number }
    data: SlideData

    // slides.ts mover
    clone?: boolean
    newType?: "parent" | "child"
    replacesParent?: boolean
}

export interface ShowGroups {
    [key: string]: ShowGroup
}
export interface ShowGroup {
    name: string
    color: string
    default?: boolean

    template?: string
    shortcut?: string
}

export interface Timer {
    id?: string
    name: string
    type: "counter" | "clock" | "event"
    viewType?: "time" | "line" | "circle"
    circleMask?: boolean
    showHours?: boolean // use just minutes or minutes and hours
    start?: number
    end?: number
    event?: string
    time?: string
    overflow?: boolean
    overflowColor?: string
    overflowBlink?: boolean
    overflowBlinkOffset?: number // start blinking before the time
    // format?: string
    // paused?: boolean
}

export interface Clock {
    type: "digital" | "analog" | "custom"
    dateFormat: "none"
    showTime?: boolean
    seconds?: boolean
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

// pre 1.5.0
// export interface Condition {
//     scenario: string
//     values: { [key: string]: string }[]
// }
// [outer_or, [outer_and, [inner_or, [inner_and, [content, {}}]]]]]
export type Condition = ConditionValue[][][][]
export interface ConditionValue {
    [key: string]: string
}

export interface Weather {
    size?: number
    latitude?: number
    longitude?: number
    altitude?: number
    useFahrenheit?: boolean
    longRange?: boolean
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
    enabled?: boolean
    style?: string
    interval?: number
    items?: ListItem[]
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
    // useDurationTime?: boolean // moved to global settings
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
    children?: { [key: string]: any } // layout slide
    color?: null | string
    nextTimer?: number // next slide timer
    transition?: Transition
    // filterEnabled?: ["background", "foreground"] // pre 1.4.4
    filter?: string
    end?: boolean // go to start
    timer?: number
    background?: string // set backgorund action?
    overlays?: string[]
    effects?: string[]
    audio?: string[]

    mics?: { id: string; name: string }[]
    mediaTransition?: Transition
    remove?: boolean // slides.ts remove parent

    actions?: {
        slideActions?: SlideAction[]

        receiveMidi?: string
        nextAfterMedia?: boolean
        animate?: Animation
        slide_shortcut?: { key: string }
        startShow?: { id: string }

        clearBackground?: boolean
        clearOverlays?: boolean
        clearAudio?: boolean
        stopTimers?: boolean
        trigger?: string
        audioStream?: string
        outputStyle?: string // deprecated
        startTimer?: boolean
    }
    // actions?: {} // to begininng / index, clear (all), start timer, start audio/music ++
    bindings?: string[] // bind slide to an output
}

export interface SlideAction {
    id: string
    name?: string
    triggers: string[]
    actionValues?: { [key: string]: any }
    customData?: { [key: string]: { [key: string]: any } } // currently only used for overrideCategoryAction
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

export interface AnimationData {
    id?: string
    animation?: Animation
    transitions?: { [key: string]: string[] }
    styles?: { [key: string]: string[] }
    style?: { [key: string]: string }
    newIndex?: number
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

export interface Action {
    name: string
    triggers: string[]
    actionValues?: any[]
    tags?: string[]
    // action?: string
    // actionData?: any
    // play specific show slide directly from midi input
    shows?: {
        id: string
        // layoutId: string
        // index: number
    }[]
    customActivation?: string
    keypressActivate?: string
    enabled?: boolean // should customActivation trigger
    midiEnabled?: boolean
    midi?: MidiValues

    // deprecated values
    startupEnabled?: boolean
    specificActivation?: string
}

export interface MidiValues {
    input?: string
    output?: string
    type: "noteon" | "noteoff" | "control"
    values: {
        channel: number
        // Note
        note?: number
        velocity?: number
        // CC
        controller?: number
        value?: number
    }
}

export type EmitterTypes = "osc" | "http" | "midi"
export interface EmitterTemplateValue {
    name: string
    value: string | { note?: number; velocity?: number; channel?: number }
}
export interface EmitterTemplate {
    name: string
    description?: string
    inputs: EmitterTemplateValue[]
}
export interface EmitterInputs {
    signal?: Input[]
}
export interface Emitter {
    name: string
    description?: string
    type: EmitterTypes
    signal?: any
    templates?: { [key: string]: EmitterTemplate }
    data?: string // custom (OSC) data
}

//

export interface Overlays {
    [key: ID]: Overlay
}
export interface Overlay {
    isDefault?: boolean
    name: string
    color: null | string
    category: null | string
    items: Item[]
    locked?: boolean
    placeUnderSlide?: boolean
    displayDuration?: number
}

export interface Templates {
    [key: ID]: Template
}
export interface Template {
    isDefault?: boolean
    name: string
    color: null | string
    category: null | string
    settings?: TemplateSettings
    items: Item[]
}
export interface TemplateStyleOverride {
    id: string
    pattern: string
    color?: string
    bold?: boolean
    italic?: boolean
    underline?: boolean
    uppercase?: boolean
}
export interface TemplateSettings {
    resolution?: Resolution
    backgroundColor?: string
    backgroundPath?: string
    overlayId?: string
    firstSlideTemplate?: string
    maxLinesPerSlide?: number // auto break slides if more than set lines
    breakLongLines?: number // auto break lines if longer than set words
    actions?: any[]
    styleOverrides?: TemplateStyleOverride[]
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
    folderPath?: string // project media folder

    ignoreLayer?: boolean // foreground background type
}

export interface OutSlide {
    id: ID
    layout?: ID
    index?: number
    tempItems?: Item[]
    previousSlides?: Item[][]
    nextSlides?: Item[][]
    line?: number // styles limit lines
    revealCount?: number // reveal one by one line
    itemClickReveal?: boolean // reveal item on click
    // layout: ID ?
    name?: string // mostly used for PDFs
    type?: ShowType // mostly used for PDFs
    page?: number // PDF
    pages?: number // PDF
    screen?: { id: string; name?: string } // PPT

    translations?: number // scripture translations count (for style template)
    attributionString?: string // scripture custom attributionString
}

export interface OutTransition {
    // action: string
    // slide?: number
    duration: number
    folderPath?: string
}

export interface SlideTimer {
    time: number
    paused: boolean
    sliderTimer: NodeJS.Timeout | null
    autoPlay: boolean
    max: number
    timer: any
    remaining?: number
    start?: number
    data?: string // used for project media folder loop
}

export interface Tag {
    name: string
    color: string
}

// types

export type ID = string
export type ItemType = "text" | "list" | "media" | "camera" | "timer" | "clock" | "button" | "events" | "weather" | "variable" | "web" | "mirror" | "icon" | "slide_tracker" | "visualizer" | "captions" | "metronome" | "current_output" // "shape" | "video"
export type ShowType = "show" | "image" | "video" | "audio" | "player" | "section" | "overlay" | "pdf" | "ppt" | "screen" | "ndi" | "camera" | "folder" // "private"
export type TransitionType = "none" | "blur" | "fade" | "crossfade" | "fly" | "scale" | "slide" | "spin"
export type MediaType = "media" | "video" | "image" | "effect" | "screen" | "ndi" | "camera" | "player" | "audio"
