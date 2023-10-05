import { get } from "svelte/store"
import { uid } from "uid"
import { ShowObj } from "../../classes/Show"
import {
    activeDrawerTab,
    activeProject,
    activeRename,
    activeShow,
    activeStage,
    currentOutputSettings,
    defaultProjectName,
    dictionary,
    drawerTabsData,
    events,
    folders,
    groups,
    notFound,
    openedFolders,
    overlays,
    playerVideos,
    projects,
    projectView,
    shows,
    showsCache,
    stageShows,
    styles,
    theme,
    themes,
} from "../../stores"
import { updateThemeValues } from "../../utils/updateSettings"
import { audioFolders, categories, mediaFolders, outputs, overlayCategories, templateCategories, templates } from "./../../stores"
import { clone } from "./array"
import { EMPTY_CATEGORY, EMPTY_EVENT, EMPTY_LAYOUT, EMPTY_PLAYER_VIDEO, EMPTY_PROJECT, EMPTY_PROJECT_FOLDER, EMPTY_SECTION, EMPTY_SLIDE, EMPTY_STAGE } from "./empty"
import { isOutCleared } from "./output"
import { saveTextCache } from "./setShow"
import { checkName } from "./show"
import { _show } from "./shows"
import { dateToString } from "./time"

const getDefaultCategoryUpdater = (tabId: string) => ({
    empty: EMPTY_CATEGORY,
    select: (id: string) => {
        setDrawerTabData(tabId, id)
    },
    deselect: (id: string) => {
        if (get(drawerTabsData)[tabId]?.activeSubTab === id) {
            setDrawerTabData(tabId, null)
        }

        // TODO: set overlays/templates to unlabeled??
    },
})

export const _updaters = {
    stage: {
        store: stageShows,
        empty: EMPTY_STAGE,
        select: (id: string, data: any, initializing: boolean) => {
            activeStage.set({ id, items: [] })

            if (!initializing || data.key) return
            activeRename.set("stage_" + id)
        },
        deselect: (id: string) => {
            if (get(activeStage).id === id) {
                activeStage.set({ id: null, items: [] })
            }
        },
    },

    project: {
        store: projects,
        empty: EMPTY_PROJECT,
        initialize: (data) => {
            return replaceEmptyValues(data, { name: getProjectName(), created: Date.now() })
        },
        select: (id: string, { data }: any, initializing: boolean) => {
            activeProject.set(id)

            // remove active show index
            if (get(activeShow) !== null) {
                activeShow.update((as: any) => {
                    as.index = null
                    return as
                })
            }
            // open parent folder if closed
            if (!get(openedFolders).includes(data.parent)) {
                openedFolders.update((f) => {
                    f.push(data.parent)
                    return f
                })
            }

            if (!initializing) return
            activeRename.set("project_" + id)
        },
        deselect: (id: string) => {
            if (get(activeProject) === id) {
                activeProject.set(null)
                projectView.set(true)
            }
        },
    },
    project_folder: {
        store: folders,
        empty: EMPTY_PROJECT_FOLDER,
        initialize: (data) => {
            return replaceEmptyValues(data, { created: Date.now() })
        },
        select: (id: string, { data, changed }: any, initializing: boolean) => {
            // add folder to opened folders
            openedFolders.update((a) => {
                // open parent folders
                let parentFolder = data.parent
                while (parentFolder !== "/" && !a.includes(parentFolder) && get(folders)[parentFolder]) {
                    a.push(parentFolder)
                    parentFolder = get(folders)[parentFolder].parent
                }

                a.push(id)
                return a
            })

            if (initializing) {
                activeRename.set("folder_" + id)
            }

            if (!changed) return

            // add back projects & folders inside
            projects.update((a) => addBackParents(a, "project"))
            folders.update((a) => addBackParents(a, "folder"))

            function addBackParents(items: any, type: "project" | "folder") {
                changed[type]?.forEach((a: any) => {
                    items[a.id].parent = a.parent
                })
                return items
            }
        },
        deselect: (id: string) => {
            // remove folder from opened folders
            if (get(openedFolders).includes(id)) {
                openedFolders.update((a) => {
                    a.splice(a.indexOf(id), 1)
                    return a
                })
            }

            // remove projects & folders inside
            let parentId = get(folders)[id]?.parent
            if (!parentId) return

            let parents: any = { project: [], folder: [] }
            projects.update((a) => findAllParents(a, "project"))
            folders.update((a) => findAllParents(a, "folder"))

            return parents

            function findAllParents(items: any, type: "project" | "folder") {
                let found: number = -1
                do {
                    if (found > -1) {
                        let key = Object.keys(items)[found]
                        parents[type].push({ id: key, parent: items[key].parent })
                        items[key].parent = parentId
                    }
                    found = Object.values(items).findIndex((a: any) => a.parent === id)
                } while (found > -1)

                return items
            }
        },
    },

    project_key: { store: projects },
    project_folder_key: { store: folders },

    project_ref: { store: projects },
    section: {
        store: projects,
        empty: EMPTY_SECTION,
        initialize: (data) => {
            return replaceEmptyValues(data, { id: uid(5) })
        },
        select: (_id: string, data: any) => {
            // let index = get(projects)[id].shows.findIndex((ref) => ref.id === data.id)
            // if (index < 0) return

            activeShow.set({ id: data.data.id, index: data.index, type: "section" })

            // focus on section title input
            setTimeout(() => {
                document.getElementById("sectionTitle")?.querySelector("input")?.focus()
            }, 10)
        },
    },

    category_shows: {
        store: categories,
        ...getDefaultCategoryUpdater("shows"),
        select: (id: string, _data, initializing: boolean) => {
            if (!initializing) return
            activeRename.set("category_" + get(activeDrawerTab) + "_" + id)
        },
    },
    category_overlays: {
        store: overlayCategories,
        ...getDefaultCategoryUpdater("overlays"),
        select: (id: string, _data, initializing: boolean) => {
            if (!initializing) return
            activeRename.set("category_" + get(activeDrawerTab) + "_" + id)
        },
    },
    category_templates: {
        store: templateCategories,
        ...getDefaultCategoryUpdater("templates"),
        select: (id: string, _data, initializing: boolean) => {
            if (!initializing) return
            activeRename.set("category_" + get(activeDrawerTab) + "_" + id)
        },
    },
    category_media: { store: mediaFolders, ...getDefaultCategoryUpdater("media") },
    category_audio: { store: audioFolders, ...getDefaultCategoryUpdater("audio") },

    overlay: {
        store: overlays,
        empty: EMPTY_SLIDE,
        initialize: (data) => {
            // get selected category
            if (get(drawerTabsData).overlays?.activeSubTab && get(overlayCategories)[get(drawerTabsData).overlays.activeSubTab!]) {
                data.category = get(drawerTabsData).overlays.activeSubTab
            }

            // auto name
            let newName = 1
            while (Object.values(get(overlays)).find((a) => a.name === newName.toString())) {
                newName++
            }
            data.name = newName.toString()

            return data
        },
        deselect: (id: string) => clearOverlayOutput(id),
    },
    overlay_items: { store: overlays, empty: [] },
    overlay_name: { store: overlays, empty: "" },
    overlay_color: { store: overlays, empty: null },
    overlay_category: { store: overlays, empty: null },

    template: {
        store: templates,
        empty: EMPTY_SLIDE,
        initialize: (data) => {
            // get selected category
            if (get(drawerTabsData).templates?.activeSubTab && get(categories)[get(drawerTabsData).templates.activeSubTab!]) {
                data.category = get(drawerTabsData).templates.activeSubTab
            }

            // auto name
            let newName = 1
            while (Object.values(get(templates)).find((a) => a.name === newName.toString())) {
                newName++
            }
            data.name = newName.toString()

            return data
        },
    },
    template_items: { store: templates, empty: [] },
    template_name: { store: templates, empty: "" },
    template_color: { store: templates, empty: null },
    template_category: { store: templates, empty: null },

    player_video: { store: playerVideos, empty: EMPTY_PLAYER_VIDEO },

    event: {
        store: events,
        empty: EMPTY_EVENT,
        deselect: (id: string, data: any) => {
            let event = get(events)[id]
            if (!event) return
            if (data.data?.repeat === true && data.previousData?.repeat === false) {
                // TODO: delete repeated...
            }
        },
    },

    stage_item_style: { store: stageShows, empty: "" },
    stage_item_position: { store: stageShows, empty: "" },
    stage_item_content: { store: stageShows, empty: "" },

    show: {
        store: showsCache,
        empty: new ShowObj(),
        initialize: (data: any) => {
            let replacer: any = {}

            // template
            let template = _show("active").get("settings.template") || null
            // TODO: set default template from settings!
            if (!template) template = get(templates).default ? "default" : null
            if (template) replacer.template = clone(template)

            // category
            if (get(drawerTabsData).shows?.activeSubTab !== "all") replacer.category = get(drawerTabsData).shows?.activeSubTab

            // name
            replacer.name = checkName(get(dictionary).main?.unnamed || "Unnamed")

            return replaceEmptyValues(data, replacer)
        },
        select: (id: string, data: any) => {
            // add to current(stored) project
            let showRef: any = { id, type: "show" }
            if (data.remember?.project && get(projects)[data.remember.project]) {
                projects.update((p) => {
                    p[data.remember.project].shows.push({ id })
                    return p
                })
                // TODO: remember index
                showRef.index = get(projects)[data.remember.project].shows.length - 1
            }

            // don't open when importing lots of songs
            // if (data.open !== false)
            activeShow.set(showRef)

            // set text cache
            saveTextCache(id, data.data)

            // update shows list (same as showsCache, but with less data)
            shows.update((a) => {
                a[id] = { name: data.data.name, category: data.data.category, timestamps: data.data.timestamps }
                if (data.data.private) a[id].private = true

                return a
            })

            // remove from "not found" (should not be nessesary)
            setTimeout(() => {
                notFound.update((a) => {
                    if (a.show.includes(id)) a.show = a.show.filter((showId) => showId !== id)
                    return a
                })
            }, 10)
        },
        deselect: (id: string, data: any) => {
            if (get(activeShow)?.id === id) activeShow.set(null)

            // remove from stored project
            if (data.remember?.project) {
                projects.update((a) => {
                    a[data.remember.project].shows = a[data.remember.project].shows.filter((a) => a.id !== id)
                    return a
                })
            }

            // update shows list (same as showsCache, but with less data)
            shows.update((a) => {
                delete a[id]
                return a
            })
        },
    },

    show_layout: {
        store: showsCache,
        empty: EMPTY_LAYOUT,
        select: (id: string, { subkey }: any, initializing: boolean) => {
            _show(id).set({ key: "settings.activeLayout", value: subkey })

            // set active layout in project
            if (get(activeShow)?.index !== undefined && get(activeProject) && get(projects)[get(activeProject)!].shows[get(activeShow)!.index!]) {
                projects.update((a) => {
                    a[get(activeProject)!].shows[get(activeShow)!.index!].layout = subkey
                    return a
                })
            }

            if (!initializing) return
            activeRename.set("layout_" + subkey)
        },
        deselect: (id: string, { subkey }: any) => {
            if (_show(id).get("settings.activeLayout") !== subkey) return

            let firstLayoutId = Object.keys(get(showsCache)[id].layouts).filter((id) => id !== subkey)[0]
            _show(id).set({ key: "settings.activeLayout", value: firstLayoutId })
        },
    },

    show_key: { store: showsCache },

    global_group: { store: groups },

    settings_theme: {
        store: themes,
        select: (id: string, data: any, initializing: boolean) => {
            // TODO: remove default if name change; if (a[obj.location!.theme!].default) groupValue
            if (data.key === "name" && get(themes)[id].default) {
                themes.update((a) => {
                    delete a[id].default
                    return a
                })
            }

            theme.set(id)

            setTimeout(() => {
                if (data.subkey) updateTransparentColors(id)
                updateThemeValues(get(themes)[id])
            }, 100)

            if (!initializing) return
            activeRename.set("theme_" + id)
        },
        deselect: (id: string, data: any) => {
            if (!data.key && get(theme) === id) {
                id = "default"
                theme.set(id)
            }

            // if (data.key === "name" && get(themes)[id].default) {
            //     data.default = true
            // }

            setTimeout(() => {
                // setTheme({ ...data, data: data.previousValue })
                if (data.subkey) updateTransparentColors(id)
                updateThemeValues(get(themes)[id])
            }, 100)
        },
    },
    settings_style: {
        store: styles,
        select: (id: string, data, initializing: boolean) => {
            if (!initializing || data.key) return
            activeRename.set("style_" + id)
        },
    },
    settings_output: {
        store: outputs,
        select: (id: string) => {
            currentOutputSettings.set(id)
        },
    },
}

function updateTransparentColors(id: string) {
    themes.update((a) => {
        Object.entries(a[id].colors).forEach(([subId, color]: any) => {
            if (!converts[subId]) return
            let transparentColors: any[] = converts[subId]

            transparentColors.forEach(({ id: colorId, opacity }: any) => {
                let rgba: string | null = makeTransparent(color, opacity)

                a[id].colors[colorId] = rgba
            })
        })

        return a
    })
}
const converts: any = {
    secondary: [{ id: "secondary-opacity", opacity: 0.5 }],
    text: [
        { id: "hover", opacity: 0.05 },
        { id: "focus", opacity: 0.1 },
    ],
}
function makeTransparent(value: string, amount: number = 0.5) {
    let rgb = hexToRgb(value)
    if (!rgb) return null
    let newValue: string = `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${amount})`
    return newValue
}
function hexToRgb(hex: string) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : null
}

function replaceEmptyValues(object: any, replacer: any) {
    Object.entries(replacer).forEach(([key, value]) => {
        if (!object[key]) object[key] = value
    })

    return object
}

function getProjectName() {
    let name = ""
    if (get(defaultProjectName) === "date") name = dateToString(Date.now())
    console.log(name)

    return name
}

function clearOverlayOutput(slideId: string) {
    if (!isOutCleared("overlays")) {
        outputs.update((a) => {
            Object.entries(a).forEach(([id, output]: any) => {
                if (output.out?.overlays?.includes(slideId)) {
                    a[id].out!.overlays = a[id].out!.overlays!.filter((a) => a !== slideId)
                }
            })
            return a
        })
    }
}

function setDrawerTabData(tabId, data) {
    drawerTabsData.update((a) => {
        a[tabId].activeSubTab = data
        return a
    })
}
