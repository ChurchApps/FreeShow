import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, TimelineAction } from "../../../types/Show"
import { activeEdit, showsCache } from "../../stores"
import { hasNewerUpdate, triggerFunction } from "../../utils/common"
import { translateText } from "../../utils/language"
import { _show } from "../helpers/shows"
import { getStyles } from "../helpers/style"
import { evaluateTimelineCurve } from "./easingHelper"
import { TimelineActions } from "./TimelineActions"
import { getActiveTimelinePlayback } from "./TimelinePlayback"

// let slideTimelineActions = new TimelineActions("slide", () => {})
export class SlideTimeline {
    static async addKeyframe({ name, key, value, type, indexes }: { name: string | undefined; key: string | undefined; value: string | number; type: string; indexes: number[] }, toggle: boolean = false) {
        if (!key) return

        const showRef = _show().layouts("active").ref()[0] || []
        const slideIndex = get(activeEdit)?.slide
        const slideId = showRef[slideIndex ?? -1]?.id
        if (!slideId) return

        const currentTimeline = getActiveTimelinePlayback("slide")
        const currentTime = currentTimeline?.currentTime || 0

        const timelineActions = new TimelineActions("slide", () => {})

        // translate and remove text in parantheses
        name = translateText(name || "")
            .replace(/\s*\(.*?\)\s*/g, "")
            .trim()

        // sort indexes
        indexes = indexes.sort((a, b) => a - b)

        // has existing value on same frame
        const existingAction = timelineActions.getActions().find((a) => a.time === currentTime && a.type === "style" && JSON.stringify(a.data.indexes) === JSON.stringify(indexes) && a.data.type === type && a.data.key === key)
        if (existingAction) {
            if (toggle) timelineActions.deleteActions([existingAction.id])
            else timelineActions.updateAction(existingAction.id, { data: { indexes, key, value, type } })
        } else {
            timelineActions.addAction({
                id: uid(6),
                time: currentTime,
                name,
                type: "style",
                data: {
                    indexes,
                    key,
                    value,
                    type // "item" | "text"
                }
            })
        }

        timelineActions.close()

        // make sure updates don't interfere with each other
        if (await hasNewerUpdate("TIMELINE_UPDATE", 120)) return
        triggerFunction("timeline_update")
    }

    static hasActionWithKey(key: string, type: string) {
        const timelineActions = new TimelineActions("slide", () => {})
        const actions = timelineActions.getActions().some((a) => a.type === "style" && a.data.key === key && a.data.type === type)
        timelineActions.close()
        return actions
    }

    static hasActionAtTime(key: string, type: string, indexes: number[], _updater: number = -1) {
        const timelineActions = new TimelineActions("slide", () => {})
        const currentTime = getActiveTimelinePlayback("slide")?.currentTime || 0

        // sort indexes
        indexes = indexes.sort((a, b) => a - b)

        const actions = timelineActions.getActions().some((a) => a.type === "style" && JSON.stringify(a.data.indexes) === JSON.stringify(indexes) && a.data.key === key && a.data.type === type && a.time === currentTime)

        timelineActions.close()
        return actions
    }

    static triggerAction(action: TimelineAction, value: string | number, ref?: { id?: string; slideId?: string }) {
        if (action.type === "style") {
            // WIP too many updates to showsCache at once with many actions!!
            showsCache.update((a) => {
                const slide = a[ref?.id || ""]?.slides?.[ref?.slideId || ""]
                if (!slide) return a

                const itemIndexes = action.data.indexes ?? [0]
                itemIndexes.forEach((index) => {
                    const item = slide.items[index]
                    if (!item) return

                    const updatedItem = this.updateStyle(action, item, value)
                    slide.items[index] = updatedItem
                })

                return a
            })
        }
    }

    static updateStyle(action: TimelineAction, item: Item, value: string | number) {
        const key = action.data.key
        const type = (action.data.type || "item") as "item" | "text"
        if (!key) return item

        let styleStr = ""
        if (type === "item") styleStr = item.style || ""
        else if (type === "text") styleStr = item.lines?.[0]?.text?.[0]?.style || ""

        const currentStyle = getStyles(styleStr)

        if (key === "rotate") {
            // WIP add back other transforms
            currentStyle.transform = `rotate(${value}deg)`
        } else {
            // extract string suffix from item value
            const currentValue = currentStyle[key] || ""
            const currentSuffixMatch = currentValue.match(/[^0-9.-]+$/)
            const currentSuffix = currentSuffixMatch ? currentSuffixMatch[0] : ""

            currentStyle[key] = `${value}${currentSuffix}`
        }

        // back to string
        const styleString = Object.entries(currentStyle)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; ")

        if (type === "item") item.style = styleString
        else if (type === "text") {
            // WIP currently only using style from first text part
            item.lines?.forEach((line) => {
                line.text?.forEach((text) => {
                    if (text.style === styleStr) text.style = styleString
                })
            })
        }

        return item
    }

    static interpolateValue(previous: TimelineAction | null, next: TimelineAction | null, currentTime: number) {
        if (!previous && !next) return null

        // simple number interpolation for now
        const start = previous?.data.value
        const end = next?.data.value
        if (start === undefined) return end ?? null
        if (end === undefined) return start ?? null

        const prevTime = previous?.time || 0
        const nextTime = next?.time || 0
        if (nextTime <= prevTime) return end

        // calculate progress between previous and next action
        const progress = (currentTime - prevTime) / (nextTime - prevTime)
        if (progress < 0) return start
        if (progress > 1) return end

        const easedProgress = evaluateTimelineCurve(progress, previous, next)

        if (typeof start === "number" && typeof end === "number") {
            return start + (end - start) * easedProgress
        }

        return end
    }
}
