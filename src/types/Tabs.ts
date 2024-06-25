export interface Categories {
    [key: string]: Category
}
export interface Category {
    name: string
    icon?: null | string
    path?: string
    id?: string
    type?: "youtube" | "vimeo"
    url?: string
    default?: boolean
    description?: string
}

export interface BibleCategories extends Category {
    customName?: string
    api?: boolean
    books?: any[]
    cacheUpdate?: Date
    collection?: {
        versions: string[]
    }
}

export interface TabsObj {
    [key: string]: {
        name: string
        icon: string
        disabled?: boolean
        remove?: boolean
        overflow?: boolean
    }
}

export interface DrawerTabs {
    [key: string]: {
        enabled: boolean
        activeSubTab: null | string
    }
}

export type DrawerTabIds = "shows" | "media" | "overlays" | "audio" | "scripture" | "calendar" | "timers" | "templates" | "functions"
export type SettingsTabs = "general" | "theme" | "groups" | "styles" | "display_settings" | "actions" | "connection" | "cloud" | "calendar" | "other"
export type TopViews = "show" | "edit" | "reflow" | "draw" | "stage" | "calendar" | "settings"
