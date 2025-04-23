import { get, type Writable, writable } from "svelte/store"
import type { Output } from "../../../types/Output"
import type { Dictionary } from "../../../types/Settings"
import type { Overlays, Shows, TrimmedShow } from "../../../types/Show"
import type { StageLayout } from "../../../types/Stage"
import { clone } from "../../common/util/helpers"
import { __update, type DeepKey, type DeepNested, type Inferred, type Nested } from "../../common/util/stores"
import { DEFAULT_DICTIONARY } from "./dictionary"

export let dictionary: Writable<Dictionary> = writable(clone(DEFAULT_DICTIONARY))

export let errors: Writable<string[]> = writable([])

export let isConnected = writable(false)
export let layouts: Writable<{ id: string; name: string; password: boolean }[] | null> = writable(null)
export let selectedLayout = writable("")
export let stageLayout: Writable<StageLayout | null> = writable(null)

export let output: Writable<Output | null> = writable(null)
export let background: Writable<any> = writable({})
export let stream: Writable<any> = writable({})
// export let videoTime: Writable<number> = writable(0)

export let showsCache: Writable<Shows> = writable({})

export let shows: Writable<TrimmedShow[]> = writable([])
export let outSlide: Writable<any> = writable(null)
export let outLayout: Writable<any> = writable(null)
export let outShow: Writable<any> = writable(null)
export let layout: Writable<any[] | null> = writable(null)

export let overlays: Writable<Overlays> = writable({})

export let mediaCache: Writable<any> = writable({})

export let playingAudioData: Writable<any> = writable({})
export let playingAudioTime: Writable<number> = writable(0)

///

export let events: Writable<any> = writable({})
export let timers: Writable<any> = writable({})
export let variables: Writable<any> = writable({})
export let activeTimers: Writable<any[]> = writable([])
export let timeFormat: Writable<"12" | "24"> = writable("24")
export let progressData: Writable<any> = writable({})

/////

export const _ = {
    dictionary,
    errors,

    isConnected,
    layouts,
    selectedLayout,
    stageLayout,

    output,
    background,
    stream,

    showsCache,

    shows,
    outSlide,
    outLayout,
    outShow,
    layout,
    mediaCache,
    playingAudioData,
    playingAudioTime,
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
