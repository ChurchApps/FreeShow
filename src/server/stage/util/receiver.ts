import type { Output } from "../../../types/Output"
import type { Show } from "../../../types/Show"
import type { StageLayout } from "../../../types/Stage"
import { openLayout, setError } from "./helpers"
import { send } from "./socket"
import { _, _set, _update, activeTimers, events, outputSlideCache, progressData, stream, timeFormat, timers, variables } from "./stores"

export type ReceiverKey = keyof typeof receiver
export const receiver = {
    LAYOUTS: (data: { id: string; name: string; password: boolean }[]) => {
        _set("layouts", data)
        if (!data.length) return

        // password is not implemented

        if (data.length === 1) {
            openLayout(data[0].id)
            return
        }

        const urlParams = new URLSearchParams(window.location.search)
        const idQuery = urlParams.get("id")
        if (idQuery) {
            openLayout(idQuery)
            return
        }

        const nameQuery = urlParams.get("name")
        if (nameQuery) {
            let matchingLayout = data.find(a => a.name.replaceAll(" ", "").toLowerCase() === nameQuery.toLowerCase())
            if (matchingLayout) {
                openLayout(matchingLayout.id)
                return
            }
        }

        const storedValue = localStorage.getItem("selectedLayout") || localStorage.getItem("show")
        if (storedValue) {
            openLayout(storedValue)
            return
        }
    },
    LAYOUT: (data: StageLayout) => {
        if (data.disabled) {
            _set("selectedLayout", "")
            return
        }

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

    REQUEST_STREAM: (data: any) => {
        stream.update(a => {
            a[data.alpha ? "alpha" : "default"] = data.stream
            return a
        })
    },
    // REQUEST_VIDEO_DATA: (data: any) => {
    //     console.log(data)

    //     _set("videoTime", data.time || 0)
    //     let reverse = id.includes("countdown")
    //     if (reverse) _set("videoTime", (data.data?.duration || 0) - get(videoTime))
    // },

    ERROR: (data: any) => {
        setError(data)
        _set("selectedLayout", "")
    },
    LANGUAGE: (data: any) => {
        _.dictionary.update(a => {
            Object.keys(a).forEach(i => {
                Object.keys(a[i] || {}).forEach(j => {
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
