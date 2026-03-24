import { get } from "svelte/store"
import { uid } from "uid"
import type { TimelineAction } from "../../../types/Show"
import { activeEdit, showsCache } from "../../stores"
import { translateText } from "../../utils/language"
import { _show } from "../helpers/shows"
import { getStyles } from "../helpers/style"
import { TimelineActions } from "./TimelineActions"
import { getActiveTimelinePlayback } from "./TimelinePlayback"

export class SlideTimeline {
    static addKeyframe({ name, key, value }: { name: string | undefined; key: string | undefined; value: string | number }) {
        if (!key) return

        const showRef = _show().layouts("active").ref()[0] || []
        const slideIndex = get(activeEdit)?.slide
        const slideId = showRef[slideIndex ?? -1]?.id
        if (!slideId) return

        const currentTimeline = getActiveTimelinePlayback("slide")
        const currentTime = currentTimeline?.currentTime || 0

        const timelineActions = new TimelineActions("slide", () => {})

        // TODO: item vs text part keyframes!!
        const type = "item_style"

        // translate and remove text in parantheses
        name = translateText(name || "")
            .replace(/\s*\(.*?\)\s*/g, "")
            .trim()

        // has existing value on same frame
        const existingAction = timelineActions.getActions().find((a) => a.time === currentTime && a.type === type && a.data.key === key)
        if (existingAction) {
            timelineActions.updateAction(existingAction.id, { data: { key, value } })
        } else {
            timelineActions.addAction({
                id: uid(6),
                time: currentTime,
                name,
                type,
                data: { key, value }
            })
        }

        timelineActions.close()
    }

    static triggerAction(action: TimelineAction, ref?: { id?: string; slideId?: string }) {
        if (action.type === "item_style") {
            showsCache.update((a) => {
                const slide = a[ref?.id || ""]?.slides?.[ref?.slideId || ""]
                if (!slide) return a

                const key = action.data.key
                const value = action.data.value ?? ""
                if (!key) return a

                // TODO: item index
                const itemIndexes = [0] // for now only first item

                itemIndexes.forEach((index) => {
                    const itemStyle = getStyles(slide.items[index]?.style)

                    // WIP append suffix if any
                    // extract string suffix from item value
                    const currentValue = itemStyle[key] || ""
                    const currentSuffixMatch = currentValue.match(/[^0-9.-]+$/)
                    const currentSuffix = currentSuffixMatch ? currentSuffixMatch[0] : ""

                    itemStyle[key] = `${value}${currentSuffix}`

                    // back to string
                    const styleString = Object.entries(itemStyle)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join("; ")

                    slide.items[index].style = styleString
                })

                return a
            })
        }
    }
}
