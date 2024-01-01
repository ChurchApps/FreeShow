import { $, StoreKey } from "../../stores"
import { clone } from "./array"

export interface StoreData {
    key?: string
    keys?: string[]
    value?: any
}
export function updateStore(storeId: StoreKey, data: StoreData, options: any = {}): StoreData {
    let oldData: StoreData = clone(data)
    oldData.value = undefined

    $[storeId].update((a) => {
        let split: any = splitKeys(a, data, options)

        oldData = split.old
        a = split.new

        return a
    })

    return oldData
}

export function removeStore(storeId: StoreKey, data: StoreData) {
    updateStore(storeId, data, { delete: true })
}

export function splitKeys(obj: any, data: StoreData, options: any) {
    let d: any = { old: undefined, new: obj }
    let keys: string[] = data.keys || []
    if (!obj || (!data.key && !data.keys)) return d

    if (data.key) {
        d.old = d.new[data.key]
        if (options.delete) delete d.new[data.key]
        else d.new[data.key] = data.value
        return d
    }

    if (!d.new[keys[0]]) d.new[keys[0]] = {}

    if (keys.length === 2) {
        d.old = d.new[keys[0]][keys[1]]
        if (options.delete) delete d.new[keys[0]][keys[1]]
        else d.new[keys[0]][keys[1]] = data.value
        return d
    }

    if (!d.new[keys[0]][keys[1]]) d.new[keys[0]][keys[1]] = {}

    if (keys.length === 3) {
        d.old = d.new[keys[0]][keys[1]][keys[2]]
        if (options.delete) delete d.new[keys[0]][keys[1]][keys[2]]
        else d.new[keys[0]][keys[1]][keys[2]] = data.value
        return d
    }
}
