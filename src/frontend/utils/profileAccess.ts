import type { AccessType } from "../../types/Main"

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

export function resolveAccessLevel(access: AccessMap = {}, key: string): AccessType {
    const localLevel = access[key] || "write"
    const globalLevel = access.global || "write"

    if (globalLevel === "none") return "none"
    if (globalLevel === "read" && localLevel === "write") return "read"
    return localLevel
}
