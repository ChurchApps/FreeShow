import { get } from "svelte/store"
import { activeDrawerTab, activePage, activePopup, activeProject, activeShow, drawer, focusMode, outputCache, projects, projectView, showRecentlyUsedProjects, shows, showsCache } from "../../stores"
import { DEFAULT_DRAWER_HEIGHT } from "../../utils/common"
import { createDefaultShow } from "../../utils/createData"
import { translateText } from "../../utils/language"
import { keysToID, removeDeleted } from "../helpers/array"
import { loadShows } from "../helpers/setShow"
import { nextSlide } from "../helpers/showActions"
import { clearAll } from "../output/clear"

export const guideSteps = [
    {
        title: "guide.start",
        description: "guide_description.start",
        query: ".column",
        pre: () => {
            activePage.set("show")
            activePopup.set(null)
            focusMode.set(false)
            showRecentlyUsedProjects.set(false)
            if (get(shows).default) loadShows(["default"])
        },
        timeout: 200,
    },
    // projects
    {
        title: "guide_title.projects",
        description: "guide_description.project_manage",
        query: "#projectsArea",
        pre: () => {
            activeProject.set(null)
            projectView.set(true)
            closeDrawer()
        },
    },
    {
        title: "guide_title.projects",
        description: "guide_description.project_create",
        query: "#projectsButtons",
        pre: () => {
            activeProject.set(null)
            projectView.set(true)
        },
    },
    // project
    {
        title: "guide_title.project",
        description: "guide_description.project_list",
        query: "#projectArea",
        pre: () => {
            let projectId = "default"
            if (!get(projects)[projectId] || get(projects)[projectId]?.deleted) {
                if (removeDeleted(keysToID(get(projects))).length) projectId = Object.keys(get(projects))[0]
                else {
                    projects.update((a) => {
                        a.default = {
                            name: translateText("example.example") || "Example",
                            created: Date.now(),
                            parent: "/",
                            shows: [],
                        }
                        return a
                    })
                }
            }

            activeProject.set(projectId)
            projectView.set(false)
            closeDrawer()
        },
    },
    // drawer
    {
        title: "guide_title.drawer",
        description: "guide_description.drawer",
        query: ".drawer",
        pre: () => {
            openDrawer()
            activeDrawerTab.set("shows")
        },
    },
    {
        title: "guide_title.drawer",
        description: "guide_description.drawer_search",
        query: ".drawer button.search",
    },
    // shows
    {
        title: "guide_title.categories",
        description: "guide_description.drawer_shows",
        query: ".categories",
    },
    // show
    {
        title: "guide_title.show_create",
        description: "guide_description.create_show_button",
        query: "#newShowBtn",
        pre: () => {
            activePopup.set(null)
            openDrawer()
        },
    },
    {
        title: "guide_title.show_create",
        description: "guide_description.create_show_popup",
        query: ".card",
        pre: () => {
            activePopup.set("show")
        },
        timeout: 320,
    },
    {
        title: "guide_title.show",
        description: "guide_description.show",
        query: "#showArea",
        pre: () => {
            activePopup.set(null)
            closeDrawer()

            if (!get(showsCache).default) createDefaultShow()
            activeShow.set({ id: "default" })
        },
    },
    // drawer (media)
    {
        title: "guide_title.drawer",
        description: "guide_description.media",
        query: ".drawer",
        pre: () => {
            activeDrawerTab.set("media")
            openDrawer()
        },
    },
    // output
    {
        title: "guide_title.output",
        description: "guide_description.show_slide",
        query: "#previewArea",
        pre: () => {
            activePage.set("show")
            nextSlide({}, true)

            closeDrawer()
        },
    },
    {
        title: "guide_title.output",
        description: "guide_description.output_window",
        query: "#output_window_button",
    },
    {
        title: "guide_title.output",
        description: "guide_description.output_clear",
        query: ".clear",
        pre: () => {
            activePage.set("show")
            nextSlide({}, true)
        },
    },
    // WIP groups / layouts
    // WIP media / overlays etc.
    // editing
    {
        title: "guide_title.editing",
        description: "guide_description.edit",
        query: ".row",
        pre: () => {
            activePage.set("edit")
        },
    },
    // done
    {
        title: "guide_title.end",
        description: "guide_description.end",
        query: ".column",
        pre: () => {
            activePage.set("show")
            activeProject.set(null)
            activeShow.set(null)
            clearAll(true)
            outputCache.set(null)
            openDrawer()
        },
    },
]

// drawer
const minHeight = 40
function closeDrawer() {
    if (get(drawer).height > minHeight) drawer.set({ height: minHeight, stored: get(drawer).height })
}
function openDrawer() {
    if (get(drawer).height <= minHeight) drawer.set({ height: get(drawer).stored || DEFAULT_DRAWER_HEIGHT, stored: null })
}
