export interface ProjectLink {
    id?: string
    name: string
    sharedAt: number
    items: (LinkShowItem | LinkOverlayItem | LinkGenericItem | null)[]
}

export interface LinkItem {
    id?: string
    name: string
}

export type LinkShowItem = LinkItem & {
    type?: "show"
    data: {
        slides: LinkSlide[]
    }
}

export type LinkOverlayItem = LinkItem & {
    type: "overlay"
    data: {
        items: LinkSlideItems
    }
}

export type LinkGenericItem = LinkItem & {
    type: "image" | "video" | "audio" | "player" | "section" | "pdf" | "ppt" | "screen" | "ndi" | "camera" | "folder"
}

export type LinkSlide = {
    group?: string
    color?: string
    notes?: string
    items: LinkSlideItem[]
}

export type LinkSlideItems = (LinkSlideTextItem | LinkSlideMediaItem | LinkSlideGenericItem)[]
export type LinkSlideItem = {
    style: string
}
export type LinkSlideTextItem = LinkSlideItem & {
    type?: "text"
    lines: LinkSlideLine[]
    align?: string
}
export type LinkSlideMediaItem = LinkSlideItem & {
    type: "media"
    src: string
}

export type LinkSlideGenericItem = LinkSlideItem & {
    type: "camera" | "timer" | "clock" | "events" | "weather" | "variable" | "web" | "mirror" | "icon" | "slide_tracker" | "visualizer" | "captions" | "metronome"
    src: string
}

export type LinkSlideLine = {
    align?: string
    text: {
        value: string
        style: string
    }[]
}
