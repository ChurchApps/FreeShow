// AI AUTO SCRIPTURE - MANUAL OVERRIDE WATCHER
// pause auto projection when the operator manually projects something else

import { outputs } from "../../stores"
import { updateAnchorFromActiveScripture } from "./projection"
import { getSettings, scriptureState } from "./scriptureState"

let lastActiveSlideKey: string | null = null
let autoResumeTimer: NodeJS.Timeout | null = null
let ourLiveSlideKey: string | null = null // fingerprint of the slide the AI itself projected

outputs.subscribe((allOutputs) => {
    const outputList = Object.values(allOutputs || {})
    const active = outputList.find((a) => a.enabled === true && a.active === true && !a.stageOutput) || outputList.find((a) => a.enabled === true && !a.stageOutput)
    const slide = active?.out?.slide || null

    // light fingerprint - customDynamicValues includes the scripture reference for "temp" slides
    const key = slide ? JSON.stringify({ id: slide.id, layout: slide.layout, index: slide.index, values: slide.customDynamicValues || null }) : null

    const changed = key !== lastActiveSlideKey
    const previousKey = lastActiveSlideKey
    lastActiveSlideKey = key

    if (!changed || !scriptureState.sessionActive) return

    if (scriptureState.selfProjecting) {
        ourLiveSlideKey = key // remember what we put on the output, so only overriding THAT pauses auto
        return
    }

    // an operator-initiated scripture play moves the sermon anchor too
    if (key !== null && slide?.id === "temp") updateAnchorFromActiveScripture()

    const settings = getSettings()
    const confidence = settings.confidence || "ask"
    if (confidence === "ask") return

    // ordinary output use (songs, slides, clearing) must NOT pause auto projection -
    // only the operator replacing/clearing a scripture the AI itself projected counts as an override
    if (!previousKey || previousKey !== ourLiveSlideKey) return
    ourLiveSlideKey = null

    // the override is temporary - resume on its own so a missed chip can't silently disable auto mode for the rest of the service
    if (autoResumeTimer) clearTimeout(autoResumeTimer)
})
