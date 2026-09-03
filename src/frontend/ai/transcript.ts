// AI TRANSCRIPT
// groups raw STT segments into display lines & copies them to the clipboard - shared by the
// bubble UI and the context menu

import { get } from "svelte/store"
import { aiSuggestions, aiTranscript } from "../stores"
import { newToast } from "../utils/common"

// segments closer than this continue the same display line
const LINE_GAP_MS = 2000

export interface TranscriptLine {
    text: string
    music: boolean
    endMs: number
    done: boolean
    open?: boolean
}

export function groupTranscriptLines(segments: { text: string; startMs: number; endMs: number; music?: boolean; utteranceEnd?: boolean }[]): TranscriptLine[] {
    const lines: TranscriptLine[] = []
    for (const segment of segments) {
        const last = lines[lines.length - 1]
        // a textless marker means an utterance ended with no new words - it only closes the line
        if (!segment.text) {
            if (last && segment.utteranceEnd) {
                last.done = true
                last.endMs = segment.endMs
            }
            continue
        }
        const startNew = !last || last.done || !!segment.music !== last.music || segment.startMs - last.endMs > LINE_GAP_MS
        if (startNew) lines.push({ text: segment.text, music: !!segment.music, endMs: segment.endMs, done: !!segment.utteranceEnd })
        else {
            last.text += " " + segment.text
            last.endMs = segment.endMs
            last.done = !!segment.utteranceEnd
        }
    }
    // the greyed interim continues this line while its utterance is still being spoken
    const last = lines[lines.length - 1]
    if (last && !last.done) last.open = true
    return lines
}

/** Copy the whole session transcript - finalized text only, the unstable interim tail is excluded. */
export function copyTranscript(): void {
    const text = groupTranscriptLines(get(aiTranscript))
        .map((line) => line.text)
        .join("\n")
    if (!text) return

    navigator.clipboard.writeText(text)
    newToast("actions.copied")
}

export function dismissAiSuggestion(id: string): void {
    aiSuggestions.update((list) => list.filter((item) => item.id !== id))
}
