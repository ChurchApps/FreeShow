import type { OutBackground, OutSlide, OutTransition } from "./Show"

export interface Outputs {
    [key: string]: Output
}

export interface Output {
    id?: string
    enabled: boolean
    active: boolean
    name: string
    color: string
    bounds: { x: number; y: number; width: number; height: number }
    screen: string | null
    kiosk: boolean
    style?: string
    show?: any
    out?: {
        refresh?: boolean
        background?: null | OutBackground
        slide?: null | OutSlide
        overlays?: string[]
        transition?: null | OutTransition
    }
}
