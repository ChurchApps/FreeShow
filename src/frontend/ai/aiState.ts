// AI - MAIN SWITCH
// the main AI toggle, shared by the settings page & quick search:
// turning AI off also ends any feature session that is still running

import { ai } from "../stores"
import { stopAiScriptureListening } from "./scripture/aiScripture"

export function setAiEnabled(enabled: boolean): void {
    if (!enabled) stopAiScriptureListening()

    ai.update((a) => {
        a.enabled = enabled
        // features require the AI layer - turning AI off turns them off too (never the reverse)
        if (!enabled && a.scripture?.enabled) a.scripture.enabled = false
        return a
    })
}
