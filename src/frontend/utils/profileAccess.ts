import type { AccessType } from "../../types/Main"
import { getAccess } from "./profile"

type AccessMap = { [key: string]: AccessType }

export function functionActionTagAccessKey(tagId: string) {
    return `action_tag:${tagId}`
}

export function functionVariableTagAccessKey(tagId: string) {
    return `variable_tag:${tagId}`
}

export function functionTimerAccessKey(timerId: string) {
    return `timer:${timerId}`
}

export function functionAccessKey(functionId: string, itemId?: string) {
    if (!itemId) return functionId
    return `${functionId}:${itemId}`
}

function resolveLegacyFunctionKey(functionId: string, itemId: string) {
    if (functionId === "actions") return functionActionTagAccessKey(itemId)
    if (functionId === "variables") return functionVariableTagAccessKey(itemId)
    if (functionId === "timers") return functionTimerAccessKey(itemId)
    return ""
}

function getLocalLevel(access: AccessMap, key: string, functionId?: string, itemId?: string) {
    if (!functionId || !itemId) return access[key] || "write"

    const legacyKey = resolveLegacyFunctionKey(functionId, itemId)
    return access[key] || access[itemId] || (legacyKey ? access[legacyKey] : undefined) || "write"
}

export function resolveAccessLevel(access: AccessMap, key: string): AccessType
export function resolveAccessLevel(functionId: string, itemId?: string): AccessType
export function resolveAccessLevel(accessOrFunctionId: AccessMap | string = {}, keyOrItemId = ""): AccessType {
    const access = typeof accessOrFunctionId === "string" ? getAccess("functions") : accessOrFunctionId
    const functionId = typeof accessOrFunctionId === "string" ? accessOrFunctionId : undefined
    const key = functionId ? functionAccessKey(functionId, keyOrItemId || undefined) : keyOrItemId

    const localLevel = getLocalLevel(access, key, functionId, keyOrItemId || undefined)
    const globalLevel = access.global || "write"

    if (globalLevel === "none") return "none"
    if (globalLevel === "read" && localLevel === "write") return "read"
    return localLevel
}
