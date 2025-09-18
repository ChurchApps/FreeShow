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
    isArchive?: boolean
    action?: string // trigger custom action on content presentation
    template?: string // set a custom template all shows within this category will use by default (if no other template is set)
    submenu?: { options: any[] } // open a submenu of options (tags)
    openTrigger?: Function // trigger a custom function
}

export interface BibleCategories extends Category {
    customName?: string
    api?: boolean
    copyright?: string // API copyright information
    attributionRequired?: boolean // API needs attribution
    attributionString?: string // API needs custom attribution
    books2?: any[] // api cache
    cacheUpdate?: Date
    favorite?: boolean // marked as favorite
    biblePreviewIndex?: number
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
        tooltip?: string // custom tooltip
    }
}

export interface DrawerTabs {
    [key: string]: {
        enabled: boolean
        activeSubTab: null | string
        openedSubSubTab?: { [key: string]: string } // media "Online"/"Screens" sub tabs
        openedSubmenus?: string[] // submenu (action tags) opened/closed state (contains activeSubTab ids)
        activeSubmenu?: string // active submenu if any
    }
}

export type DrawerTabIds = "shows" | "media" | "overlays" | "audio" | "scripture" | "calendar" | "timers" | "templates" | "functions"
export type SettingsTabs = "general" | "files" | "display_settings" | "styles" | "connection" | "profiles" | "theme" | "other" // "calendar"
export type TopViews = "show" | "edit" | "reflow" | "draw" | "stage" | "calendar" | "settings"
