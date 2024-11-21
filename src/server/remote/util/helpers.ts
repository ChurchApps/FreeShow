import type { Dictionary } from "../../../types/Settings"
import { clone } from "../../common/util/helpers"
import { _get, _set } from "./stores"

export function translate(key: string, d: Dictionary = _get("dictionary")) {
    let keys = key.split(".")
    return d[keys[0]]?.[keys[1]] || ""
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
