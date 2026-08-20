// AI - MAIN SWITCH
// the main AI toggle, shared by the settings page & quick search:
// turning AI off also ends any feature session that is still running

import type { AiSettings } from "../../types/ai/AiSettings"
import { ai } from "../stores"
import { stopAiScriptureListening } from "./scripture/aiScripture"

// features require the AI layer - stored settings from before that rule (or edited by hand)
// could wake up with a feature on while AI is off, so loading runs through here
export function sanitizeAiSettings(settings: AiSettings | undefined): AiSettings {
    if (settings?.scripture?.enabled && !settings.enabled) {
        return { ...settings, scripture: { ...settings.scripture, enabled: false } }
    }
    return settings || {}
}

export function setAiEnabled(enabled: boolean): void {
    if (!enabled) stopAiScriptureListening()

    ai.update((a) => {
        a.enabled = enabled
        // features require the AI layer - turning AI off turns them off too (never the reverse)
        if (!enabled && a.scripture?.enabled) a.scripture.enabled = false
        return a
    })
}
