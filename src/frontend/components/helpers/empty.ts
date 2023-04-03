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
        showLabelIfEmptySlide: true,
    },
    items: {},
}

export const EMPTY_CATEGORY = { name: "", icon: null }
export const EMPTY_PLAYER_VIDEO = { name: "", type: "" } // "youtube" | "vimeo"

// if (get(drawerTabsData)[s.store]?.activeSubTab !== "all" && get(drawerTabsData).templates?.activeSubTab !== "unlabeled") category = get(drawerTabsData)[s.store].activeSubTab
export const EMPTY_SLIDE = { name: "", color: null, category: null, items: [] }

export const EMPTY_PROJECT = { name: "", created: 0, parent: "/", shows: [] }
export const EMPTY_PROJECT_FOLDER = { name: "", parent: "/" }

export const EMPTY_SECTION = { id: "", type: "section", name: "", notes: "" }

// SLIDE
export const EMPTY_SHOW_SLIDE = { group: "", color: null, settings: {}, notes: "", items: [] }
