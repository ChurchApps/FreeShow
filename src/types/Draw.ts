export type DrawTools = "focus" | "pointer" | "fill" | "paint"

export interface Draw {
  x: number
  y: number
}

export interface DrawSettings {
  [key: string]: {
    [key: string]: any
  }
}
