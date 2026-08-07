import type { Output } from "../../../types/Output"
import type { Show } from "../../../types/Show"
import type { StageLayout } from "../../../types/Stage"
import { lastAttemptedLayoutId, lastAttemptedPassword, openLayout, setError, translate } from "./helpers"
import { send } from "./socket"
import { _, _get, _set, _update, activeTimers, events, outputSlideCache, progressData, stream, timeFormat, timers, variables } from "./stores"

export type ReceiverKey = keyof typeof receiver
export const receiver = {
    LAYOUTS: (data: { id: string; name: string; password: boolean }[]) => {
        _set("layouts", data)
        if (!data.length) return

        const urlParams = new URLSearchParams(window.location.search)
        const pwdQuery = urlParams.get("password") || ""

        if (data.length === 1) {
            openLayout(data[0].id, pwdQuery)
            return
        }

        const idQuery = urlParams.get("id")
        if (idQuery) {
            openLayout(idQuery, pwdQuery)
            return
        }

        const nameQuery = urlParams.get("name")
        if (nameQuery) {
            let matchingLayout = data.find((a) => a.name.replaceAll(" ", "").toLowerCase() === nameQuery.toLowerCase())
            if (matchingLayout) {
                openLayout(matchingLayout.id, pwdQuery)
                return
            }
        }

        const storedValue = localStorage.getItem("selectedLayout") || localStorage.getItem("show")
        if (storedValue) {
            openLayout(storedValue, pwdQuery)
            return
        }
    },
    LAYOUT: (data: StageLayout & { id?: string }) => {
        if (data.disabled) {
            _set("selectedLayout", "")
            return
        }

        const id = data.id || _get("selectedLayout") || lastAttemptedLayoutId
        if (lastAttemptedPassword) {
            localStorage.setItem("password_" + id, lastAttemptedPassword)
            localStorage.setItem("password", lastAttemptedPassword)
        }

        _set("passwordRequiredLayout", null)
        _set("stageLayout", data)
    },
    SWITCH: (data: { id: string }) => openLayout(data.id),

    OUT: (data: Output) => {
        _set("output", data)

        let outputId = data?.id
        if (outputId) send("REQUEST_PROGRESS", { outputId })
    },
    OUT_SLIDE_CACHE: (data: any) => outputSlideCache.set(data),
    BACKGROUND: (data: any) => _set("background", data),
    MEDIA: (data: any) => _update("media", data.path, data.value),

    SHOW_DATA: (data: { id: string; show: Show }) => {
        if (!data.id || !data.show) return
        _update("showsCache", data.id, data.show)
    },

    EVENTS: (data: any) => events.set(data),
    TIMERS: (data: any) => timers.set(data),
    VARIABLES: (data: any) => variables.set(data),
    ACTIVE_TIMERS: (data: any) => activeTimers.set(data),
    REQUEST_PROGRESS: (data: any) => progressData.set(data),
    DATA: (data: any) => {
        if (data.timeFormat) timeFormat.set(data.timeFormat)
    },

    // push-driven frames from the app - keyed per output id so multiple mirrored outputs don't clobber each other
    STREAM_FRAME: (data: any) => {
        if (!data?.id || !data.jpeg) return
        stream.update((a) => {
            a[data.id] = { jpeg: data.jpeg, size: data.size }
            return a
        })
    },

    ERROR: (data: any) => {
        if (data === "wrongPass") {
            setError(translate("remote.wrong_password") || "Wrong password")
            const layoutId = _get("selectedLayout") || lastAttemptedLayoutId
            const layoutsList = _get("layouts") || []
            const layoutObj = layoutsList.find((a) => a.id === layoutId)
            _set("passwordRequiredLayout", { id: layoutId, name: layoutObj?.name || "" })
            localStorage.removeItem("password")
            if (layoutId) localStorage.removeItem("password_" + layoutId)
        } else {
            setError(data)
        }
        _set("selectedLayout", "")
    },
    LANGUAGE: (data: any) => {
        _.dictionary.update((a) => {
            Object.keys(a).forEach((i) => {
                Object.keys(a[i] || {}).forEach((j) => {
                    if (data.strings[i]?.[j] && a[i]) a[i]![j] = data.strings[i][j]
                })
            })
            return a
        })
    }

    /////

    // "API:get_thumbnail": (data: any) => {
    //     if (!data.path || !data.thumbnail) return

    //     _update("mediaCache", data.path, data.thumbnail)
    // },
}
