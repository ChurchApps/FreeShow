import type { Writable } from "svelte/store";
import { get } from "svelte/store"
import type { StoreKey } from "../../stores";
import { $ } from "../../stores"
import { clone } from "./array"
import { historyNew } from "./history"

type StoreValue<K extends StoreKey> = (typeof $)[K] extends Writable<infer T> ? T : never
type StoreItem<K extends StoreKey> = StoreValue<K> extends Record<string, infer V> ? V : never

export function createStore<T extends StoreKey>(id: T, initialValue: any, key: string, addToHistory = true) {
    if (!addToHistory) {
        createStoreHistory(id, initialValue, key)
        return
    }

    const historyValue = { id, key, value: initialValue }
    historyNew("store_create", historyValue)
}

export function updateStore<T extends StoreKey>(id: T, key: string, value: StoreItem<T>, addToHistory = true) {
    if (!get($[id])) return
    value = clone(value)

    if (!addToHistory) {
        updateStoreHistory(id, key, value)
        return
    }

    const oldValue = clone($[id][key])
    const historyValue = { id, key, value, oldValue }
    historyNew("store_update", historyValue)
}

export function deleteStore<T extends StoreKey>(id: T, key: string, addToHistory = true) {
    if (!get($[id])) return

    if (!addToHistory) {
        deleteStoreHistory(id, key)
        return
    }

    const oldValue = clone($[id][key])
    const historyValue = { id, key, oldValue }
    historyNew("store_delete", historyValue)
}

export function createStoreHistory<T extends StoreKey>(id: T, initialValue: any, key: string) {
    if (key) {
        if (!get($[id])) return

        $[id].update((a) => {
            a[key] = initialValue
            return a
        })
    } else {
        ;($[id] as any).set(initialValue)
    }
}

export function updateStoreHistory<T extends StoreKey>(id: T, key: string, value: StoreItem<T>) {
    if (!get($[id])) return

    $[id].update((a) => {
        a[key] = value
        return a
    })
}

export function deleteStoreHistory<T extends StoreKey>(id: T, key: string) {
    if (!get($[id])) return

    $[id].update((a) => {
        delete a[key]
        return a
    })
}
