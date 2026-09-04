import { get } from "svelte/store"
import { ai, outputs } from "../../stores"
import { updateAnchorFromActiveScripture } from "./projection"
import { scriptureState } from "./scriptureState"

let lastActiveSlideKey: string | null = null
let autoResumeTimer: NodeJS.Timeout | null = null
let ourLiveSlideKey: string | null = null

outputs.subscribe((allOutputs) => {
    const list = Object.values(allOutputs || {})
    const active = list.find((a) => a.enabled && a.active && !a.stageOutput) || list.find((a) => a.enabled && !a.stageOutput)
    const slide = active?.out?.slide || null

    const key = slide ? JSON.stringify({ id: slide.id, layout: slide.layout, index: slide.index, values: slide.customDynamicValues || null }) : null

    const changed = key !== lastActiveSlideKey
    const previousKey = lastActiveSlideKey
    lastActiveSlideKey = key

    if (!changed || !scriptureState.sessionActive) return

    if (scriptureState.selfProjecting) {
        ourLiveSlideKey = key
        return
    }

    if (key !== null && slide?.id === "temp") updateAnchorFromActiveScripture()

    const confidence = get(ai).scripture?.confidence || "ask"
    if (confidence === "ask" || !previousKey || previousKey !== ourLiveSlideKey) return

    ourLiveSlideKey = null

    if (autoResumeTimer) clearTimeout(autoResumeTimer)
})
