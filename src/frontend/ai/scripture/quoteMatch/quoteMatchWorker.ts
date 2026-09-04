import { QuoteMatcher, buildIndexesFromPayloads, createIndexBuildContext, type IndexBuildContext, type TranslationPayload } from "./quoteMatcherEngine"

let matcher: QuoteMatcher | null = null
let buildContext: IndexBuildContext = createIndexBuildContext()

self.onmessage = async (event: MessageEvent<any>) => {
    const data = event.data
    if (!data || !data.type) return

    try {
        switch (data.type) {
            case "start": {
                buildContext = createIndexBuildContext()
                const { indexes, totalBytes } = await buildIndexesFromPayloads(data.translations as TranslationPayload[], buildContext)
                matcher = new QuoteMatcher(indexes)
                self.postMessage({ type: "ready", count: indexes.length, totalBytes })
                break
            }
            case "update": {
                if (!matcher) return
                if (data.remove && data.remove.length) matcher.removeTranslations(data.remove)
                let addedCount = 0
                if (data.add && data.add.length) {
                    const { indexes } = await buildIndexesFromPayloads(data.add as TranslationPayload[], buildContext)
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
                break
            }
            case "segment": {
                if (!matcher) return
                const emissions = matcher.onSegment(data.segment)
                if (emissions.length > 0) {
                    self.postMessage({ type: "emissions", emissions })
                }
                break
            }
            case "anchor": {
                matcher?.setAnchor(data.anchor)
                break
            }
            case "explicit": {
                matcher?.noteExplicitReference(data.ref)
                break
            }
        }
    } catch (err: any) {
        self.postMessage({ type: "error", message: err?.message || String(err) })
    }
}
