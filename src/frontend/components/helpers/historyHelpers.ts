import { get } from "svelte/store"
import { uid } from "uid"
import { ShowObj } from "../../classes/Show"
import {
    activeDrawerTab,
    activeEdit,
    activeProject,
    activeRename,
    activeShow,
    activeStage,
    activeTagFilter,
    audioPlaylists,
    currentOutputSettings,
    dictionary,
    drawerTabsData,
    effects,
    events,
    focusMode,
    folders,
    globalTags,
    groups,
    notFound,
    openedFolders,
    overlays,
    playerVideos,
    projects,
    projectTemplates,
    projectView,
    shows,
    showsCache,
    special,
    stageShows,
    styles,
    theme,
    themes
} from "../../stores"
import { updateThemeValues } from "../../utils/updateSettings"
import { EMPTY_CATEGORY, EMPTY_EFFECT, EMPTY_EVENT, EMPTY_LAYOUT, EMPTY_PLAYER_VIDEO, EMPTY_PROJECT, EMPTY_PROJECT_FOLDER, EMPTY_SECTION, EMPTY_SLIDE, EMPTY_STAGE, EMPTY_TAG } from "../../values/empty"
import { getWeekNumber } from "../drawer/calendar/calendar"
import { audioFolders, categories, mediaFolders, outputs, overlayCategories, templateCategories, templates } from "./../../stores"
import { clone, keysToID, sortByName } from "./array"
import { isOutCleared } from "./output"
import { saveTextCache } from "./setShow"
import { checkName } from "./show"
import { _show } from "./shows"
import { addZero, getMonthName, getWeekday } from "./time"
import { addToPos } from "./mover"
import { REMOTE } from "../../../types/Channels"

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
    }
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

            // find any stage output window linked to this stage layout
            const outputId = Object.entries(get(outputs)).find(([_id, output]) => output.stageOutput === id)?.[0] || ""
            if (!outputId) return

            // get first stage layout
            const stageOutput = sortByName(keysToID(get(stageShows))).filter((a) => a.id !== id)[0] || null
            if (!stageOutput) return

            // set to new stage output
            outputs.update((a) => {
                a[outputId].stageOutput = stageOutput.id
                return a
            })
        }
    },

    project: {
        store: projects,
        empty: EMPTY_PROJECT,
        cloudCombine: true,
        initialize: (data) => {
            return replaceEmptyValues(data, { name: getProjectName(), created: Date.now(), modified: Date.now(), used: Date.now() })
        },
        select: (id: string, { data }: any, initializing: boolean) => {
            activeProject.set(id)

            // remove active show index
            if (get(activeShow) !== null) {
                activeShow.update((a) => {
                    delete a!.index
                    return a
                })
            }

            // open parent folders if closed
            openedFolders.update((a) => {
                let parentFolder = data.parent
                while (parentFolder !== "/" && get(folders)[parentFolder]) {
                    if (!a.includes(parentFolder)) a.push(parentFolder)
                    parentFolder = get(folders)[parentFolder].parent
                }

                a.push(id)
                return a
            })

            if (!initializing || data.shows?.length) return

            activeRename.set("project_" + id)
        },
        deselect: (id: string) => {
            if (get(activeProject) === id) {
                activeProject.set(null)
                projectView.set(true)
            }
        }
    },
    project_folder: {
        store: folders,
        empty: EMPTY_PROJECT_FOLDER,
        cloudCombine: true,
        initialize: (data) => {
            return replaceEmptyValues(data, { created: Date.now(), modified: Date.now() })
        },
        select: (id: string, { data, changed }: any, initializing: boolean) => {
            // open parent folders if closed
            openedFolders.update((a) => {
                let parentFolder = data.parent
                while (parentFolder !== "/" && get(folders)[parentFolder]) {
                    if (!a.includes(parentFolder)) a.push(parentFolder)
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
            const parentId = get(folders)[id]?.parent
            if (!parentId) return

            const parents: any = { project: [], folder: [] }
            projects.update((a) => findAllParents(a, "project"))
            folders.update((a) => findAllParents(a, "folder"))

            return parents

            function findAllParents(items: any, type: "project" | "folder") {
                let found = -1
                do {
                    if (found > -1) {
                        const key = Object.keys(items)[found]
                        parents[type].push({ id: key, parent: items[key].parent })
                        items[key].parent = parentId
                    }
                    found = Object.values(items).findIndex((a: any) => a.parent === id)
                } while (found > -1)

                return items
            }
        }
    },
    project_template: {
        store: projectTemplates,
        cloudCombine: true,
        empty: EMPTY_PROJECT
    },

    project_key: {
        store: projects,
        timestamp: true
    },
    project_folder_key: { store: folders, timestamp: true },

    project_ref: { store: projects, timestamp: true },
    section: {
        store: projects,
        empty: EMPTY_SECTION,
        initialize: (data) => {
            return replaceEmptyValues(data, { id: uid(5) })
        },
        select: (_id: string, data: any) => {
            // let index = get(projects)[id].shows.findIndex((ref) => ref.id === data.id)
            // if (index < 0) return

            // WIP set name / notes when moved while active
            // if (get(activeShow)?.id === data.data.id)
            // let sectionData = clone(get(projects)[get(activeProject) || ""]?.shows[data.index])
            // ...data.data

            activeShow.set({ id: data.data.id, index: data.index, type: "section" })

            // focus on section title input
            setTimeout(() => {
                document.getElementById("sectionTitle")?.querySelector("input")?.focus()
            }, 10)
        }
    },

    category_shows: {
        store: categories,
        ...getDefaultCategoryUpdater("shows"),
        select: (id: string, _data, initializing: boolean) => {
            if (!initializing) return

            setDrawerTabData("shows", id)
            activeRename.set("category_" + get(activeDrawerTab) + "_" + id)
        }
    },
    category_overlays: {
        store: overlayCategories,
        ...getDefaultCategoryUpdater("overlays"),
        select: (id: string, _data, initializing: boolean) => {
            if (!initializing) return

            setDrawerTabData("overlays", id)
            activeRename.set("category_" + get(activeDrawerTab) + "_" + id)
        }
    },
    category_templates: {
        store: templateCategories,
        ...getDefaultCategoryUpdater("templates"),
        select: (id: string, _data, initializing: boolean) => {
            if (!initializing) return

            setDrawerTabData("templates", id)
            activeRename.set("category_" + get(activeDrawerTab) + "_" + id)
        }
    },
    category_media: { store: mediaFolders, ...getDefaultCategoryUpdater("media") },
    category_audio: { store: audioFolders, ...getDefaultCategoryUpdater("audio") },
    audio_playlists: { store: audioPlaylists, ...getDefaultCategoryUpdater("audio"), empty: { name: "", songs: [] } },
    audio_playlist_key: { store: audioPlaylists },

    effect: {
        store: effects,
        empty: EMPTY_EFFECT,
        initialize: (data, id: string) => {
            activeRename.set("effect_" + id)
            return data
        }
    },

    overlay: {
        store: overlays,
        empty: EMPTY_SLIDE,
        initialize: (data, id: string) => {
            // get selected category
            if (get(drawerTabsData).overlays?.activeSubTab && get(overlayCategories)[get(drawerTabsData).overlays.activeSubTab!]) {
                data.category = get(drawerTabsData).overlays.activeSubTab
            }

            activeRename.set("overlay_" + id)

            return data
        },
        deselect: (id: string) => clearOverlayOutput(id)
    },
    overlay_items: { store: overlays, empty: [] },
    overlay_name: { store: overlays, empty: "" },
    overlay_color: { store: overlays, empty: null },
    overlay_category: { store: overlays, empty: null },

    template: {
        store: templates,
        empty: EMPTY_SLIDE,
        initialize: (data, id: string) => {
            // get selected category
            if (get(drawerTabsData).templates?.activeSubTab && get(templateCategories)[get(drawerTabsData).templates.activeSubTab!]) {
                data.category = get(drawerTabsData).templates.activeSubTab
            }

            activeRename.set("template_" + id)

            return data
        }
    },
    template_items: { store: templates, empty: [] },
    template_name: { store: templates, empty: "" },
    template_color: { store: templates, empty: null },
    template_category: { store: templates, empty: null },
    template_settings: { store: templates, empty: {} },

    player_video: { store: playerVideos, empty: EMPTY_PLAYER_VIDEO },

    event: {
        store: events,
        empty: EMPTY_EVENT,
        deselect: (id: string, data: any) => {
            const event = get(events)[id]
            if (!event) return
            if (data.data?.repeat === true && data.previousData?.repeat === false) {
                // TODO: delete repeated...
            }
        }
    },

    stage_item_style: { store: stageShows, empty: "" },
    stage_item_position: { store: stageShows, empty: "" },
    stage_item_content: { store: stageShows, empty: "" },

    show: {
        store: showsCache,
        empty: new ShowObj(),
        initialize: (data: any) => {
            const replacer: any = {}

            // template
            let template = _show().get("settings.template") || null
            // TODO: set default template from settings!
            if (!template) template = get(templates).default ? "default" : null
            if (template) replacer.template = clone(template)

            // category
            if (get(drawerTabsData).shows?.activeSubTab !== "all") replacer.category = get(drawerTabsData).shows?.activeSubTab

            // name
            replacer.name = checkName(get(dictionary).main?.unnamed || "Unnamed")

            // update remote project shows data, so the new show is properly added
            setTimeout(() => window.api.send(REMOTE, { channel: "SHOWS", data: get(shows) }))

            return replaceEmptyValues(data, replacer)
        },
        select: (id: string, data: any) => {
            // add to current(stored) project
            const showRef: any = { id, type: "show" }
            if (data.remember?.project && get(projects)[data.remember.project]?.shows) {
                projects.update((p) => {
                    if (data.remember.index !== undefined && p[data.remember.project].shows.length > data.remember.index) {
                        p[data.remember.project].shows = addToPos(p[data.remember.project].shows, [{ id }], data.remember.index)
                        showRef.index = data.remember.index
                    } else {
                        p[data.remember.project].shows.push({ id })
                        showRef.index = p[data.remember.project].shows.length - 1
                    }

                    return p
                })
            }

            // don't open when importing lots of songs
            // if (data.open !== false)
            if (!get(focusMode)) {
                activeShow.set(showRef)
                activeEdit.set({ type: "show", slide: 0, items: [], showId: showRef.id })
            }

            // set text cache
            saveTextCache(id, data.data)

            // update shows list (same as showsCache, but with less data)
            shows.update((a) => {
                a[id] = { name: data.data.name, category: data.data.category, timestamps: data.data.timestamps, quickAccess: data.data.quickAccess || {} }
                if (data.data.origin) a[id].origin = data.data.origin
                if (data.data.private) a[id].private = true
                if (data.data.locked) a[id].locked = true

                return a
            })

            // open selected drawer tab
            const activeCategory = get(drawerTabsData).shows?.activeSubTab
            if (activeCategory !== "all" && activeCategory !== "unlabeled") {
                drawerTabsData.update((a) => {
                    a.shows = { enabled: true, activeSubTab: data.data.category }
                    return a
                })
            }

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
            if (data.remember?.project && get(projects)[data.remember.project]?.shows) {
                projects.update((a) => {
                    a[data.remember.project].shows = a[data.remember.project].shows.filter((showRef) => showRef.id !== id)
                    return a
                })
            }

            // update shows list (same as showsCache, but with less data)
            shows.update((a) => {
                delete a[id]
                return a
            })
        }
    },

    show_layout: {
        store: showsCache,
        empty: EMPTY_LAYOUT,
        select: (id: string, { subkey }: any, initializing: boolean) => {
            _show(id).set({ key: "settings.activeLayout", value: subkey })

            // set active layout in project
            if (get(activeShow)?.index !== undefined && get(activeProject) && get(projects)[get(activeProject)!]?.shows?.[get(activeShow)!.index!]) {
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

            const firstLayoutId = Object.keys(get(showsCache)[id].layouts).filter((layoutId) => layoutId !== subkey)[0]
            if (firstLayoutId) _show(id).set({ key: "settings.activeLayout", value: firstLayoutId })
        }
    },

    show_key: { store: showsCache },

    global_group: { store: groups },

    tag: {
        store: globalTags,
        empty: EMPTY_TAG,
        initialize: (data, id: string) => {
            activeRename.set("tag_" + id)
            return data
        },
        deselect: () => {
            activeTagFilter.set([])
        }
    },
    tag_key: { store: globalTags },

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

            if (!initializing || data.key) return
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
        }
    },
    settings_style: {
        store: styles,
        select: (id: string, data, initializing: boolean) => {
            if (!initializing || data.key) return
            activeRename.set("style_" + id)
        }
    },
    settings_output: {
        store: outputs,
        select: (id: string) => {
            currentOutputSettings.set(id)
        },
        deselect: () => {
            setTimeout(() => {
                const allNormalOutputs = Object.keys(get(outputs)).filter((outputId) => {
                    const output = get(outputs)[outputId]
                    return !output.isKeyOutput && !output.stageOutput
                })

                if (allNormalOutputs.length > 0) {
                    // enable if no enabled
                    const allEnabled = allNormalOutputs.filter((id) => get(outputs)[id].enabled)
                    if (!allEnabled.length) {
                        outputs.update((a) => {
                            a[allNormalOutputs[0]].enabled = true
                            return a
                        })
                    }
                    return
                }

                // create output if no normal outputs (in case stage outputs are still active)
                outputs.update((a) => {
                    a.default = { enabled: true, active: true, name: get(dictionary).theme?.primary || "Primary", color: "#F0008C", bounds: { x: 0, y: 0, width: 1920, height: 1080 }, screen: null, style: "default", show: {} }
                    return a
                })
            }, 100)
        }
    }
}

function updateTransparentColors(id: string) {
    themes.update((a) => {
        Object.entries(a[id].colors).forEach(([subId, color]: any) => {
            if (!converts[subId]) return
            const transparentColors: any[] = converts[subId]

            transparentColors.forEach(({ id: colorId, opacity }: any) => {
                const rgba = makeTransparent(color, opacity)

                a[id].colors[colorId] = rgba
            })
        })

        return a
    })
}
const converts = {
    secondary: [{ id: "secondary-opacity", opacity: 0.5 }],
    text: [
        { id: "hover", opacity: 0.05 },
        { id: "focus", opacity: 0.1 }
    ]
}
function makeTransparent(value: string, amount = 0.5) {
    const rgb = hexToRgb(value)
    if (!rgb) return null
    const newValue = `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${amount})`
    return newValue
}
function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16)
          }
        : null
}

function replaceEmptyValues(object: any, replacer: any) {
    Object.entries(replacer).forEach(([key, value]) => {
        if (!object[key]) object[key] = value
    })

    return object
}

export const projectReplacers = [
    { id: "DD", title: get(dictionary).calendar?.day || "Day", value: (date) => addZero(date.getDate()) },
    { id: "MM", title: get(dictionary).calendar?.month || "Month", value: (date) => addZero(date.getMonth() + 1) },
    { id: "YY", title: get(dictionary).calendar?.year || "Year", value: (date) => date.getFullYear().toString().slice(-2) },
    { id: "YYYY", title: "Full year", value: (date) => date.getFullYear() },
    { id: "hh", title: "Hours", value: (date) => date.getHours() },
    { id: "mm", title: "Minutes", value: (date) => date.getMinutes() },
    { id: "weeknum", title: "Week number", value: (date) => getWeekNumber(date) },
    { id: "weekday", title: "Weekday", value: (date) => getWeekday(date.getDay(), get(dictionary), true) },
    { id: "monthname", title: "Name of month", value: (date) => getMonthName(date.getMonth(), get(dictionary), true) }
]
export const DEFAULT_PROJECT_NAME = "{DD}.{MM}.{YY}"
export function getProjectName(updater = get(special)) {
    let name = updater.default_project_name ?? DEFAULT_PROJECT_NAME

    const date = new Date()
    projectReplacers.forEach((a) => {
        name = name.replaceAll(`{${a.id}}`, a.value(date))
    })

    return name
}

function clearOverlayOutput(slideId: string) {
    if (!isOutCleared("overlays")) {
        outputs.update((a) => {
            Object.entries(a).forEach(([id, output]) => {
                if (output.out?.overlays?.includes(slideId)) {
                    a[id].out!.overlays = a[id].out!.overlays!.filter((overlayId) => overlayId !== slideId)
                }
            })
            return a
        })
    }
}

export function setDrawerTabData(tabId, data) {
    drawerTabsData.update((a) => {
        if (!a[tabId]) a[tabId] = { enabled: true, activeSubTab: "" }
        a[tabId].activeSubTab = data

        return a
    })
}
