import type { Dictionary } from "../../../types/Settings"
import { clone } from "../../common/util/helpers"
import { send } from "./socket"
import { _get, _set } from "./stores"

export function translate(key: string, d: Dictionary = _get("dictionary"), fallback = "") {
    let keys = key.split(".")
    return d[keys[0]]?.[keys[1]] || fallback || ""
}

export function setError(err: string) {
    let errors = _get("errors")
    if (errors.includes(err)) return

    _set("errors", [...errors, err])

    setTimeout(() => {
        errors = clone(_get("errors"))
        errors.shift()
        _set("errors", errors)
    }, 2000)
}

export let lastAttemptedLayoutId = ""
export let lastAttemptedPassword = ""

export function openLayout(id: string, password?: string) {
    lastAttemptedLayoutId = id
    if (password !== undefined) lastAttemptedPassword = password
    const pwd = (password && password.length > 0) ? password : (localStorage.getItem("password_" + id) || localStorage.getItem("password") || "")

    const layoutsList = _get("layouts") || []
    const layoutObj = layoutsList.find((a) => a.id === id)

    if (layoutObj?.password && !pwd && password === undefined) {
        _set("passwordRequiredLayout", { id, name: layoutObj.name || "" })
        return
    }

    _set("selectedLayout", id)
    send("LAYOUT", { id, password: pwd })
    localStorage.setItem("selectedLayout", id)
}
