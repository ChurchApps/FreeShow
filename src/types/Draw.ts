import type { Resolution } from "./Settings"

export type DrawTools = "focus" | "pointer" | "zoom" | "particles" | "fill" | "paint"

export interface Draw {
    x: number
    y: number
    resolution?: Resolution
}

export interface DrawSettings {
    [key: string]: {
        [key: string]: any
    }
}
