// AI AUTO SCRIPTURE - quote matching: Web Worker host
// Loaded dynamically by createMatcherHost() only when workers exist. The worker is bundled INLINE
// (?worker&inline): the packaged app loads its windows from file://, where an emitted worker
// asset URL would not resolve - an inline blob has no URL to break.

import QuoteMatchWorkerFactory from "./quoteMatch.worker?worker&inline"
import type { MatcherHost, MatcherHostCallbacks } from "./quoteMatchHost"
import type { QuoteMatchWorkerRequest, QuoteMatchWorkerResponse } from "./quoteMatch.worker"
import { payloadTransferables, type TranslationPayload } from "./quoteMatchPayload"

export function createWorkerHost(): MatcherHost {
    const worker: Worker = new QuoteMatchWorkerFactory()
    let callbacks: MatcherHostCallbacks | null = null

    const send = (message: QuoteMatchWorkerRequest, transfer?: Transferable[]) => {
        try {
            if (transfer) worker.postMessage(message, transfer)
            else worker.postMessage(message)
        } catch (err) {
            callbacks?.onError(String((err as Error)?.message || err))
        }
    }

    worker.onmessage = (event: MessageEvent<QuoteMatchWorkerResponse>) => {
        const message = event.data
        if (!message || !callbacks) return
        if (message.type === "ready") callbacks.onReady({ count: message.count, totalBytes: message.totalBytes })
        else if (message.type === "updated") callbacks.onUpdated?.({ count: message.count, added: message.added, removed: message.removed, totalBytes: message.totalBytes })
        else if (message.type === "emissions") callbacks.onEmissions(message.emissions)
        else if (message.type === "error") callbacks.onError(message.message)
    }

    worker.onerror = (event: ErrorEvent) => {
        callbacks?.onError(event.message || "Quote match worker failed")
    }

    return {
        start(payloads: TranslationPayload[], hostCallbacks) {
            callbacks = hostCallbacks
            send({ type: "start", translations: payloads }, payloadTransferables(payloads))
        },
        update(add: TranslationPayload[], remove: string[], order?: string[]) {
            send({ type: "update", add, remove, order }, payloadTransferables(add))
        },
        segment(segment) {
            send({ type: "segment", segment })
        },
        setAnchor(anchor) {
            send({ type: "anchor", anchor })
        },
        noteExplicit(ref) {
            send({ type: "explicit", ref })
        },
        stop() {
            callbacks = null
            worker.terminate()
        }
    }
}
