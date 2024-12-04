import { type Writable, get, writable } from "svelte/store"
import type { Dictionary } from "../../../types/Settings"
import type { BibleCategories } from "../../../types/Tabs"
import { clone } from "../../common/util/helpers"
import { type DeepKey, type DeepNested, type Inferred, type Nested, __update } from "../../common/util/stores"
import type { ProjectShowRef } from "./../../../types/Projects"
import { DEFAULT_DICTIONARY } from "./dictionary"

export const dictionary: Writable<Dictionary> = writable(clone(DEFAULT_DICTIONARY))

export const errors: Writable<string[]> = writable([])

export const password = writable({
    required: true,
    remember: false,
    stored: "",
})

export const isConnected = writable(false)
export const quickPlay = writable(false)
export const activeTab = writable("shows")
export const outputMode: Writable<"slide" | "lyrics"> = writable("slide")

export const active: Writable<ProjectShowRef> = writable({
    id: "",
    type: "show",
})
export const activeShow: Writable<any> = writable(null)
export const shows: Writable<any[]> = writable([])
export const outSlide: Writable<any> = writable(null)
export const outLayout: Writable<any> = writable(null)
export const styleRes: Writable<any> = writable(null)
export const outShow: Writable<any> = writable(null)
export const layout: Writable<any[] | null> = writable(null)
export const isCleared = writable({
    all: true,
    background: true,
    slide: true,
    overlays: true,
    audio: true,
    slideTimers: true,
})

export const projectsOpened: Writable<boolean> = writable(false)
export const activeProject: Writable<any> = writable(null)
export const folders: Writable<any> = writable(null)
export const openedFolders: Writable<any[]> = writable([])
export const projects: Writable<any[]> = writable([])
export const project: Writable<string> = writable("")

export const scriptures: Writable<{ [key: string]: BibleCategories }> = writable({})

export const mediaCache: Writable<any> = writable({})
export const textCache: Writable<any> = writable({})
export const groupsCache: Writable<any> = writable({})
export const scriptureCache: Writable<any> = writable({})

/////

export const _ = {
    dictionary,
    errors,
    password,
    isConnected,
    quickPlay,
    activeTab,
    outputMode,
    active,
    activeShow,
    shows,
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
    mediaCache,
    textCache,
    groupsCache,
    scriptureCache,
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
