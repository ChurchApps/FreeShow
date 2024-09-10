import { get } from "svelte/store"
import { activeDrawerTab, activePage, activePopup, activeProject, activeShow, dictionary, drawer, outputCache, projects, projectView, shows, showsCache } from "../../stores"
import { DEFAULT_DRAWER_HEIGHT } from "../../utils/common"
import { createDefaultShow } from "../../utils/createData"
import { loadShows } from "../helpers/setShow"
import { nextSlide } from "../helpers/showActions"
import { clearAll } from "../output/clear"

export const guideSteps = [
    {
        title: "$guide.start",
        description: "This is a short walkthrough of some basic features (in English), you can skip in the bottom right corner.",
        query: ".column",
        pre: () => {
            activePage.set("show")
            if (get(shows).default) loadShows(["default"])
        },
        timeout: 200,
    },
    // projects
    {
        title: "Projects",
        description: "Manage all of your projects in one place.",
        query: "#projectsArea",
        pre: () => {
            activeProject.set(null)
            projectView.set(true)
            closeDrawer()
        },
    },
    {
        title: "Projects",
        description: "Create folders to keep it organized, and create new projects.",
        query: "#projectsButtons",
        pre: () => {
            activeProject.set(null)
            projectView.set(true)
        },
    },
    // project
    {
        title: "Project",
        description: "After opening a project you get a list of all the items here on the left side, drag & drop from the drawer to add more.",
        query: "#projectArea",
        pre: () => {
            let projectId = "default"
            if (!get(projects)[projectId]) {
                if (Object.keys(get(projects)).length) projectId = Object.keys(get(projects))[0]
                else {
                    projects.update((a) => {
                        a.default = {
                            name: get(dictionary).example?.example || "Example",
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
        title: "The Drawer",
        description: "Find all of your shows, media, overlays, etc. in one place.",
        query: ".drawer",
        pre: () => {
            openDrawer()
            activeDrawerTab.set("shows")
        },
    },
    // shows
    {
        title: "Categories",
        description: "Manage all of your different shows by organizing them in different categories. Drag & drop any selected show to move them.",
        query: ".categories",
    },
    // show
    {
        title: "Creating a Show",
        description: "Click this to create a new show (song, presentation, etc.)",
        query: "#newShowBtn",
        pre: () => {
            activePopup.set(null)
            openDrawer()
        },
    },
    {
        title: "Creating a Show",
        description: "Fill in the main details of the show, you can also auto find lyrics on the web from the name, or paste the lyrics manually.",
        query: ".card",
        pre: () => {
            activePopup.set("show")
        },
        timeout: 320,
    },
    {
        title: "Show",
        description: "A show is the main presentation, click on any slide to present, and use the arrow keys to navigate. You can also drag & drop media files on a slide to set as background.",
        query: "#showArea",
        pre: () => {
            activePopup.set(null)
            closeDrawer()

            if (!get(showsCache).default) createDefaultShow()
            activeShow.set({ id: "default" })
        },
    },
    // output
    {
        title: "Output",
        description: "After a slide is clicked, it will show in the output and you will see a preview on the right, here you'll also find some extra actions like pausing a video.",
        query: "#previewArea",
        pre: () => {
            activePage.set("show")
            nextSlide({}, true)
        },
    },
    {
        title: "Output",
        description: "Clear individual output layers, or clear all layers in the output.",
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
        title: "Editing",
        description: "Open slide editing with one click at the top.",
        query: ".row",
        pre: () => {
            activePage.set("edit")
        },
    },
    // done
    {
        title: "That's the basics!",
        description: "You can always look on the web if you need help with other features.",
        query: ".column",
        pre: () => {
            activePage.set("show")
            activeProject.set(null)
            activeShow.set(null)
            clearAll()
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
