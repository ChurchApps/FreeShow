import { get, Writable, writable } from "svelte/store"
import type { Bible } from "../../../types/Bible"
import type { OutData } from "../../../types/Output"
import type { Dictionary } from "../../../types/Settings"
import type { Overlays, Show, ShowList } from "../../../types/Show"
import type { BibleCategories } from "../../../types/Tabs"
import { clone } from "../../common/util/helpers"
import { __update, DeepKey, DeepNested, Inferred, Nested } from "../../common/util/stores"
import type { Project, ProjectShowRef } from "./../../../types/Projects"
import { DEFAULT_DICTIONARY } from "./dictionary"

export let dictionary: Writable<Dictionary> = writable(clone(DEFAULT_DICTIONARY))

export let errors: Writable<string[]> = writable([])

export let password = writable({
    required: true,
    remember: false,
    stored: ""
})

export let isConnected = writable(false)
export let quickPlay = writable(false)
export let createShow: Writable<boolean | string> = writable(false)
export let showSearchValue = writable("")
export let activeTab = writable("shows")
export let activeDrawerTab = writable("shows")
export let activeCategory = writable("all")
export let drawer: Writable<{ height: number; stored: number | null; autoclosed: boolean }> = writable({ height: 300, stored: null, autoclosed: false })
export let outputMode: Writable<"slide" | "lyrics"> = writable("slide")

export let active: Writable<ProjectShowRef> = writable({ id: "", type: "show" })
export let activeShow: Writable<Show | null> = writable(null)
export let shows: Writable<ShowList[]> = writable([])
export let outData: Writable<OutData> = writable({})
export let outSlide: Writable<number | null> = writable(null)
export let outLayout: Writable<string | null> = writable(null)
export let styleRes: Writable<any> = writable(null) // this is actually aspect ratio
export let outShow: Writable<Show | null> = writable(null)
export let layout: Writable<any[] | null> = writable(null)
export let isCleared = writable({ all: true, background: true, slide: true, overlays: true, audio: true, slideTimers: true })

export let projectsOpened: Writable<boolean> = writable(false)
export let activeProject: Writable<Project | null> = writable(null)
export let folders: Writable<any> = writable(null)
export let openedFolders: Writable<any[]> = writable([])
export let projects: Writable<any[]> = writable([])
export let project: Writable<string> = writable("")

export let scriptures: Writable<{ [key: string]: BibleCategories }> = writable({})
export let selectedTranslationIndex: Writable<number | null> = writable(null) // null = all, number = specific translation index
export let categories: Writable<{ [key: string]: any }> = writable({})
export let resized: Writable<{ [key: string]: number }> = writable({})
export let scriptureViewList = writable(false)
export let scriptureWrapText = writable(false)
export let openedScripture = writable(localStorage.getItem("scripture") || "")
export let collectionId = writable(localStorage.getItem("collectionId") || "")

export let actions: Writable<{ [key: string]: any }> = writable({})
export let actionTags: Writable<{ [key: string]: any }> = writable({})
export let variables: Writable<{ [key: string]: any }> = writable({})
export let variableTags: Writable<{ [key: string]: any }> = writable({})
export let timers: Writable<{ [key: string]: any }> = writable({})
export let triggers: Writable<{ [key: string]: any }> = writable({})
export let activeTimers: Writable<any[]> = writable([])
export let runningActions: Writable<string[]> = writable([])

export let activeActionTagFilter: Writable<string[]> = writable([])
export let activeVariableTagFilter: Writable<string[]> = writable([])
export let functionsSubTab: Writable<string> = writable("actions")

export type CurrentScriptureState = {
    scriptureId: string
    bookId: number
    chapterId: number
    activeVerses: number[]
}

export let currentScriptureState: Writable<CurrentScriptureState> = writable({
    scriptureId: "",
    bookId: -1,
    chapterId: -1,
    activeVerses: []
})

export let overlays: Writable<Overlays> = writable({})
export let overlayCategories: Writable<{ [key: string]: any }> = writable({})
export let activeOverlayCategory: Writable<string> = writable("all")

export let templates: Writable<{ [key: string]: any }> = writable({})
export let templateCategories: Writable<{ [key: string]: any }> = writable({})
export let activeTemplateCategory: Writable<string> = writable("all")

export let mediaCache: Writable<any> = writable({})
export let textCache: Writable<any> = writable({})
export let groupsCache: Writable<any> = writable({})
export let scriptureCache: Writable<{ [key: string]: Bible }> = writable({})

export let playingAudioData: Writable<any> = writable({})
export let playingAudioTime: Writable<number> = writable(0)

export let pdfPages: Writable<{ [key: string]: string[] }> = writable({})
export let scriptureSearchResults: Writable<any> = writable(null)

/////

export const _ = {
    dictionary,
    errors,
    password,
    isConnected,
    quickPlay,
    activeTab,
    activeDrawerTab,
    activeCategory,
    drawer,
    outputMode,
    active,
    activeShow,
    shows,
    outData,
    outSlide,
    outLayout,
    styleRes,
    outShow,
    layout,
    isCleared,
    projectsOpened,
    activeProject,
    folders,
    openedFolders,
    projects,
    project,
    scriptures,
    categories,
    resized,
    openedScripture,
    collectionId,
    currentScriptureState,
    overlays,
    overlayCategories,
    activeOverlayCategory,
    templates,
    templateCategories,
    activeTemplateCategory,
    mediaCache,
    textCache,
    groupsCache,
    scriptureCache,
    playingAudioData,
    playingAudioTime,
    pdfPages,
    scriptureSearchResults,
    actions,
    actionTags,
    variables,
    variableTags,
    timers,
    triggers,
    activeTimers,
    runningActions,
    activeActionTagFilter,
    activeVariableTagFilter,
    functionsSubTab
}

/////

type Stores = typeof _
type StoreId = keyof typeof _

export function _get<ID extends StoreId>(id: ID) {
    const value = get(_[id] as any) as Inferred<Stores[ID]>
    return clone(value)
}

export function _set<ID extends StoreId, V extends Inferred<Stores[ID]>>(id: ID, value: V) {
    if (!_[id]) return console.log("Invalid store ID")
    // @ts-ignore
    _[id].set(value)
}

type UpdateKey<ID extends StoreId> = keyof Inferred<Stores[ID]> | DeepKey<Inferred<Stores[ID]>>
type UpdateValue<ID extends StoreId, K> = K extends [string, string] ? DeepNested<Inferred<Stores[ID]>, K> : Nested<Inferred<Stores[ID]>, K>
/**
 * @param id string
 * @param key string | [string, string]
 * @param value any
 */
export function _update<ID extends StoreId, K extends UpdateKey<ID>>(id: ID, key: K, value: UpdateValue<ID, K>) {
    if (!_[id]) return console.log("Invalid store ID")

    _[id].update((a: any) => __update(a, key as any, value))
}
