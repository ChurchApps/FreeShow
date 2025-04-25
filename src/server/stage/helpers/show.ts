import { get } from "svelte/store"
import type { Show, Shows } from "../../../types/Show"
import { getLayoutRef as getRef } from "../../common/util/show"
import { awaitRequest } from "../util/socket"
import { showsCache } from "../util/stores"

export function getLayoutRef(showId: string, layoutId: string = "", _updater?: Shows | Show) {
    let currentShow = get(showsCache)[showId]
    return getRef(currentShow, layoutId)
}

let cached: { [key: string]: string } = {}
export function getDynamicValue(value: string) {
    return cached[value] || value
}
export async function replaceDynamicValues(value: string, _updater: number = 0) {
    const newValue = await awaitRequest("API:get_dynamic_value", { value, ref: { type: "stage" } })
    if (newValue !== undefined) cached[value] = newValue
    return newValue ?? cached[value] ?? value
}
