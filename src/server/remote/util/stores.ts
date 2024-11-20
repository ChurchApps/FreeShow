import type { ProjectShowRef } from "./../../../types/Projects"
import { get, Writable, writable } from "svelte/store"
import type { Dictionary } from "../../../types/Settings"
import { __update, DeepKey, DeepNested, Inferred, Nested } from "../../common/util/stores"
import { clone } from "../../common/util/helpers"
import { DEFAULT_DICTIONARY } from "./dictionary"

export let dictionary: Writable<Dictionary> = writable(clone(DEFAULT_DICTIONARY))

export let errors: Writable<string[]> = writable([])

export let password = writable({
    required: true,
    remember: false,
    stored: "",
})

export let isConnected = writable(false)
export let quickPlay = writable(false)
export let activeTab = writable("shows")
export let outputMode: Writable<"slide" | "lyrics"> = writable("slide")

export let active: Writable<ProjectShowRef> = writable({ id: "", type: "show" })
export let activeShow: Writable<any> = writable(null)
export let shows: Writable<any[]> = writable([])
export let outSlide: Writable<any> = writable(null)
export let outLayout: Writable<any> = writable(null)
export let styleRes: Writable<any> = writable(null)
export let outShow: Writable<any> = writable(null)
export let layout: Writable<any[] | null> = writable(null)
export let isCleared = writable({ all: true, background: true, slide: true, overlays: true, audio: true, slideTimers: true })

export let projectsOpened: Writable<boolean> = writable(false)
export let activeProject: Writable<any> = writable(null)
export let folders: Writable<any> = writable(null)
export let openedFolders: Writable<any[]> = writable([])
export let projects: Writable<any[]> = writable([])
export let project: Writable<string> = writable("")

export let mediaCache: Writable<any> = writable({})
export let textCache: Writable<any> = writable({})
export let groupsCache: Writable<any> = writable({})

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
    mediaCache,
    textCache,
    groupsCache,
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
