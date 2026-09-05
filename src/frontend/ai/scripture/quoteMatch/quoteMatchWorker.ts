import { QuoteMatcher, buildIndexesFromPayloads, createIndexBuildContext, type IndexBuildContext, type TranslationPayload } from "./quoteMatcherEngine"

let matcher: QuoteMatcher | null = null
let buildContext: IndexBuildContext = createIndexBuildContext()

type WorkerMessage = {
    type?: "start" | "update" | "segment" | "anchor" | "explicit"
    translations?: TranslationPayload[]
    add?: TranslationPayload[]
    remove?: string[]
    order?: string[]
    segment?: { text: string; startMs: number; endMs: number }
    anchor?: { bookNumber: number; chapter: number; verseStart: number; verseEnd: number } | null
    ref?: unknown
}

const handlers: Record<string, (data: WorkerMessage) => Promise<void> | void> = {
    async start(data) {
        buildContext = createIndexBuildContext()
        const { indexes, totalBytes } = await buildIndexesFromPayloads(data.translations || [], buildContext)
        matcher = new QuoteMatcher(indexes)
        self.postMessage({ type: "ready", count: indexes.length, totalBytes })
    },
    async update(data) {
        if (!matcher) return
        if (data.remove?.length) matcher.removeTranslations(data.remove)

        let addedCount = 0
        if (data.add?.length) {
            const { indexes } = await buildIndexesFromPayloads(data.add, buildContext)
            matcher.addIndexes(indexes)
            addedCount = indexes.length
        }

        if (data.order) matcher.reorderTranslations(data.order)
        self.postMessage({
            type: "updated",
            count: matcher.translationCount,
            added: addedCount,
            removed: data.remove?.length || 0,
            totalBytes: buildContext.usedBytes
        })
    },
    segment(data) {
        if (!matcher || !data.segment) return
        const emissions = matcher.onSegment(data.segment)
        if (emissions.length > 0) self.postMessage({ type: "emissions", emissions })
    },
    anchor(data) {
        matcher?.setAnchor(data.anchor ?? null)
    }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const data = event.data || {}
    if (!data.type) return

    try {
        await handlers[data.type]?.(data)
    } catch (err: any) {
        self.postMessage({ type: "error", message: err?.message || String(err) })
    }
}
