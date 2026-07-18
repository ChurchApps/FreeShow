import type { ItemType } from "../../../../types/Show"

export interface AddItem {
    id: ItemType | "icon" | "slide_text" | "current_output" | "metronome" | "more" | "dynamic_values"
    icon: string
    label: string
    title?: string
    suffix?: string
    isLarge?: boolean
    children?: AddItem[]
}

interface AddItemGroup {
    label?: string
    items: AddItem[]
}

export const slideItems: AddItemGroup[] = [
    {
        items: [{ id: "text", icon: "text", label: "items.text", isLarge: true }]
    },
    {
        // label: "media",
        items: [
            { id: "media", icon: "image", label: "items.media" },
            { id: "camera", icon: "camera", label: "items.camera" },
            { id: "web", icon: "web", label: "items.web" }
        ]
    },
    {
        items: [
            { id: "timer", icon: "timer", label: "items.timer" },
            { id: "clock", icon: "clock", label: "items.clock" }
        ]
    },
    {
        items: [
            { id: "table", icon: "grid", label: "items.table" },
            { id: "chart", icon: "pie_chart", label: "items.chart" }
        ]
    },
    {
        items: [{ id: "icon", icon: "star", label: "items.icon", title: "edit.add_icons" }]
    },
    {
        items: [
            {
                id: "more",
                icon: "arrow_back_modern",
                label: "main.more",
                children: [
                    { id: "slide_tracker", icon: "percentage", label: "items.slide_tracker" },
                    { id: "events", icon: "calendar", label: "items.events" },
                    { id: "weather", icon: "cloud", label: "items.weather" },
                    { id: "visualizer", icon: "visualizer", label: "items.visualizer" },
                    { id: "captions", icon: "captions", label: "items.captions" }
                ]
            }
        ]
    }
]

export const stageItems: AddItemGroup[] = [
    {
        items: [{ id: "slide_text", icon: "text", label: "items.slide_text", isLarge: true }]
    },
    {
        items: [
            { id: "text", icon: "text", label: "items.text" },
            {
                id: "dynamic_values",
                icon: "arrow_back_modern",
                label: "popup.dynamic_values",
                children: []
            }
        ]
    },
    {
        items: [
            { id: "media", icon: "image", label: "items.media" },
            { id: "camera", icon: "camera", label: "items.camera" },
            { id: "web", icon: "web", label: "items.web" }
        ]
    },
    {
        items: [
            { id: "timer", icon: "timer", label: "items.timer" },
            { id: "clock", icon: "clock", label: "items.clock" }
        ]
    },
    {
        items: [{ id: "current_output", icon: "screen", label: "items.current_output" }]
    },
    {
        items: [
            {
                id: "more",
                icon: "arrow_back_modern",
                label: "main.more",
                children: [
                    { id: "slide_tracker", icon: "percentage", label: "items.slide_tracker" },
                    { id: "metronome", icon: "metronome", label: "items.metronome" },
                    { id: "visualizer", icon: "visualizer", label: "items.visualizer" }
                ]
            }
        ]
    }
]
