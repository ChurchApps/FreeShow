import type { ItemType } from "../../../../types/Show"

interface AddItem {
    id: ItemType | "icon" | "slide_text" | "current_output" | "metronome"
    icon: string
    label: string
    title?: string
    suffix?: string
    isLarge?: boolean
}

export const slideItems: AddItem[] = [
    { id: "text", icon: "text", label: "items.text", isLarge: true },
    { id: "media", icon: "image", label: "items.media" },
    { id: "camera", icon: "camera", label: "items.camera" },
    { id: "web", icon: "web", label: "items.web" },
    { id: "table", icon: "grid", label: "items.table" },
    { id: "chart", icon: "pie_chart", label: "items.chart" },
    { id: "events", icon: "calendar", label: "items.events" },
    { id: "icon", icon: "star", label: "items.icon", title: "edit.add_icons" },
    { id: "timer", icon: "timer", label: "items.timer" },
    { id: "clock", icon: "clock", label: "items.clock" },
    { id: "slide_tracker", icon: "percentage", label: "items.slide_tracker" },
    { id: "weather", icon: "cloud", label: "items.weather" },
    { id: "visualizer", icon: "visualizer", label: "items.visualizer" },
    { id: "captions", icon: "captions", label: "items.captions" }
]

export const stageItems: AddItem[] = [
    { id: "slide_text", icon: "text", label: "items.slide_text", isLarge: true },
    { id: "media", icon: "image", label: "items.media" },
    { id: "web", icon: "web", label: "items.web" },
    { id: "timer", icon: "timer", label: "items.timer" },
    { id: "clock", icon: "clock", label: "items.clock" },
    { id: "text", icon: "text", label: "items.text" },
    { id: "camera", icon: "camera", label: "items.camera" },
    { id: "slide_tracker", icon: "percentage", label: "items.slide_tracker" },
    { id: "metronome", icon: "metronome", label: "items.metronome" },
    { id: "visualizer", icon: "visualizer", label: "items.visualizer" },
    { id: "current_output", icon: "screen", label: "items.current_output" }
]
