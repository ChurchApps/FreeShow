// AI AUTO SCRIPTURE - quote matching: matcher hosting
// The session talks to a MatcherHost and never to the matcher directly. In production the host
// is a Web Worker (quoteMatch.worker.ts) so index building and per-segment matching cannot stall
// the renderer thread that forwards mic audio and animates the UI. When workers are unavailable
// (tests run in node; a spawn can fail in exotic environments) the direct host runs the same
// matcher in-thread - identical behavior, just without the isolation.

import type { QuoteMatchAnchor, QuoteMatchEmission } from "./quoteMatcher"
import { QuoteMatcher } from "./quoteMatcher"
import { buildIndexesFromPayloads, createIndexBuildContext, type TranslationPayload } from "./quoteMatchPayload"

export interface MatcherHostCallbacks {
    onReady: (info: { count: number; totalBytes: number }) => void
    onUpdated?: (info: { count: number; added: number; removed: number; totalBytes: number }) => void
    onEmissions: (emissions: QuoteMatchEmission[]) => void
    onError: (message: string) => void
}

export interface MatcherHost {
    start(payloads: TranslationPayload[], callbacks: MatcherHostCallbacks): void
    /** Incrementally index added translations and drop removed ones - the matcher keeps running. */
    update(add: TranslationPayload[], remove: string[]): void
    segment(segment: { text: string; startMs: number; endMs: number }): void
    setAnchor(anchor: QuoteMatchAnchor): void
    noteExplicit(ref: { bookNumber: number; chapter: number; verseStart: number }): void
    stop(): void
}

/** Worker-backed host when the environment has workers, in-thread host otherwise. */
export async function createMatcherHost(): Promise<MatcherHost> {
    if (typeof Worker !== "undefined") {
        try {
            // dynamic import: the ?worker&inline module only exists under the Vite build
            const module = await import("./quoteMatchWorkerHost")
            return module.createWorkerHost()
        } catch (err) {
            console.warn("[AiScripture] Quote match worker unavailable - matching on the main thread:", err)
        }
    }
    return createDirectHost()
}

export function createDirectHost(): MatcherHost {
    let matcher: QuoteMatcher | null = null
    let callbacks: MatcherHostCallbacks | null = null
    let stopped = false
    // survives for the whole session so mid-session additions build into the same shared pool
    let buildContext = createIndexBuildContext()

    return {
        start(payloads, hostCallbacks) {
            callbacks = hostCallbacks
            buildContext = createIndexBuildContext()
            buildIndexesFromPayloads(payloads, buildContext)
                .then(({ indexes, totalBytes }) => {
                    if (stopped) return
                    matcher = new QuoteMatcher(indexes)
                    hostCallbacks.onReady({ count: indexes.length, totalBytes })
                })
                .catch((err) => {
                    if (!stopped) hostCallbacks.onError(String((err as Error)?.message || err))
                })
        },
        update(add, remove) {
            const active = matcher
            if (!active || !callbacks) return
            active.removeTranslations(remove)
            buildIndexesFromPayloads(add, buildContext)
                .then(({ indexes, totalBytes }) => {
                    if (stopped) return
                    active.addIndexes(indexes)
                    callbacks?.onUpdated?.({ count: active.translationCount, added: indexes.length, removed: remove.length, totalBytes })
                })
                .catch((err) => {
                    if (!stopped) callbacks?.onError(String((err as Error)?.message || err))
                })
        },
        segment(segment) {
            if (!matcher || !callbacks) return
            try {
                const emissions = matcher.onSegment(segment)
                if (emissions.length) callbacks.onEmissions(emissions)
            } catch (err) {
                callbacks.onError(String((err as Error)?.message || err))
            }
        },
        setAnchor(anchor) {
            matcher?.setAnchor(anchor)
        },
        noteExplicit(ref) {
            matcher?.noteExplicitReference(ref)
        },
        stop() {
            stopped = true
            matcher = null
            callbacks = null
        }
    }
}
