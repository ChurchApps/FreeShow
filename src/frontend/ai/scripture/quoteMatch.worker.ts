// AI AUTO SCRIPTURE - quote matching worker
// Owns the per-translation indexes and the QuoteMatcher for one listening session, so neither
// the seconds-long index build nor per-segment matching (voting + alignments across up to 41
// translations) ever runs on the renderer's main thread - the thread that forwards mic audio to
// the transcriber and animates the UI. Indexes never leave this worker; only emissions do.

import { QuoteMatcher } from "./quoteMatcher"
import { buildIndexesFromPayloads, type TranslationPayload } from "./quoteMatchPayload"

export type QuoteMatchWorkerRequest = { type: "start"; translations: TranslationPayload[] } | { type: "segment"; segment: { text: string; startMs: number; endMs: number } } | { type: "anchor"; anchor: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } } | { type: "explicit"; ref: { bookNumber: number; chapter: number; verseStart: number } }

export type QuoteMatchWorkerResponse = { type: "ready"; count: number; totalBytes: number } | { type: "emissions"; emissions: ReturnType<QuoteMatcher["onSegment"]> } | { type: "error"; message: string }

const scope = self as unknown as { onmessage: ((event: MessageEvent<QuoteMatchWorkerRequest>) => void) | null; postMessage(message: QuoteMatchWorkerResponse): void }

let matcher: QuoteMatcher | null = null

const post = (message: QuoteMatchWorkerResponse) => scope.postMessage(message)

scope.onmessage = (event) => {
    const message = event.data
    try {
        if (message.type === "start") {
            void buildIndexesFromPayloads(message.translations)
                .then(({ indexes, totalBytes }) => {
                    matcher = new QuoteMatcher(indexes)
                    post({ type: "ready", count: indexes.length, totalBytes })
                })
                .catch((err) => post({ type: "error", message: String((err as Error)?.message || err) }))
        } else if (message.type === "segment") {
            if (!matcher) return
            const emissions = matcher.onSegment(message.segment)
            if (emissions.length) post({ type: "emissions", emissions })
        } else if (message.type === "anchor") {
            matcher?.setAnchor(message.anchor)
        } else if (message.type === "explicit") {
            matcher?.noteExplicitReference(message.ref)
        }
    } catch (err) {
        post({ type: "error", message: String((err as Error)?.message || err) })
    }
}
