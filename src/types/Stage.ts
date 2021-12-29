import type { Resolution } from "./Settings"

export interface StageShows {
  [key: string]: {
    name: string
    enabled: boolean
    settings: {
      background: boolean
      color: string
      resolution: boolean
      size: Resolution
      labels: boolean
    }
    items: {
      [key: string]: {
        enabled: boolean
        style: string
        align: string
      }
    }
  }
}
