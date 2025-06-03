import type { Event } from "../../types/Calendar"
import type { Effect } from "../../types/Effects"
import type { Project, ProjectShowRef } from "../../types/Projects"
import type { Layout, Overlay, Slide, Template } from "../../types/Show"
import type { Category } from "../../types/Tabs"

// UPDATE

export const EMPTY_STAGE = {
    name: "",
    disabled: false,
    password: "",
    settings: {
        background: false,
        color: "#000000",
        resolution: false,
        size: { width: 10, height: 20 },
        labels: false,
        showLabelIfEmptySlide: true
    },
    items: {}
}

export const EMPTY_CATEGORY: Category = { name: "", icon: null }
export const EMPTY_PLAYER_VIDEO = { name: "", type: "" } // "youtube" | "vimeo"
export const EMPTY_EFFECT: Effect = { name: "", color: null, style: "", items: [] }

// if (get(drawerTabsData)[s.store]?.activeSubTab !== "all" && get(drawerTabsData).templates?.activeSubTab !== "unlabeled") category = get(drawerTabsData)[s.store].activeSubTab
export const EMPTY_SLIDE: Overlay | Template = { name: "", color: null, category: null, items: [] }

export const EMPTY_PROJECT: Project = { name: "", created: 0, parent: "/", shows: [] }
export const EMPTY_PROJECT_FOLDER = { name: "", created: 0, parent: "/" }

export const EMPTY_SECTION: ProjectShowRef = { id: "", type: "section", name: "", notes: "" }

export const EMPTY_EVENT: Event = { name: "", color: null, type: "event", from: "", to: "", time: false, repeat: false }

export const EMPTY_TAG = { name: "", color: "" }

// SLIDE
export const EMPTY_SHOW_SLIDE: Slide = { group: "", color: null, settings: {}, notes: "", items: [] }

export const EMPTY_LAYOUT: Layout = { name: "", notes: "", slides: [] }
