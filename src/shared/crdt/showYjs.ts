// ----- FreeShow -----
// Show <-> Yjs mapping. Used by both the client bridge and the server doc registry.
//
// Granularity (v1): the show's big collections (slides/layouts/media) are nested
// Y.Maps keyed by item id with opaque JSON values, so concurrent edits to
// DIFFERENT slides merge cleanly (per-key). All other top-level keys are stored
// as JSON values on the root map (last-writer-wins).
//
// FUTURE REFINEMENT (finer-grained co-editing):
//   Because each slide is stored as an opaque JSON value, two people editing the
//   SAME slide (or the same text box) resolve last-writer-wins — one edit clobbers
//   the other. To support Google-Docs-style simultaneous same-item / character-level
//   editing, deepen the mapping here: represent a slide as its own nested Y.Map,
//   its `items` as a Y.Array of Y.Maps, and text `lines` as Y.Text. `yDocToShow`
//   and `applyShowDiffToYDoc` would then recurse into those shared types instead of
//   treating slide values as opaque JSON. This file is the single place that change
//   lives; the client bridge and server relay stay the same.

import * as Y from "yjs"

const ROOT = "show"
// collections stored as per-item Y.Maps (see FUTURE REFINEMENT above to go deeper than per-item)
const COLLECTION_KEYS = ["slides", "layouts", "media"]

export function getShowRoot(doc: Y.Doc): Y.Map<any> {
    return doc.getMap(ROOT)
}

function deepEqual(a: any, b: any): boolean {
    if (a === b) return true
    try {
        return JSON.stringify(a) === JSON.stringify(b)
    } catch {
        return false
    }
}

function ensureCollection(root: Y.Map<any>, key: string): Y.Map<any> {
    let m = root.get(key)
    if (!(m instanceof Y.Map)) {
        m = new Y.Map()
        root.set(key, m)
    }
    return m as Y.Map<any>
}

/** Reconstruct a plain Show object from the Yjs doc. */
export function yDocToShow(doc: Y.Doc): any {
    const root = getShowRoot(doc)
    const show: any = {}
    root.forEach((value: any, key: string) => {
        if (value instanceof Y.Map) {
            const obj: any = {}
            value.forEach((itemValue: any, itemKey: string) => (obj[itemKey] = itemValue))
            show[key] = obj
        } else {
            show[key] = value
        }
    })
    return show
}

/** Hydrate an (empty) doc from a full Show object. */
export function showToYDoc(show: any, doc: Y.Doc, origin?: any): void {
    doc.transact(() => {
        const root = getShowRoot(doc)
        for (const [key, value] of Object.entries(show || {})) {
            if (COLLECTION_KEYS.includes(key)) {
                const m = ensureCollection(root, key)
                for (const [id, item] of Object.entries((value as any) || {})) m.set(id, item)
            } else {
                root.set(key, value)
            }
        }
    }, origin)
}

/**
 * Apply the minimal set of changes between prev and next Show onto the doc.
 * Collections diff per-item; other keys diff whole-value. Runs in one transaction
 * tagged with `origin` so the update observer can distinguish local vs remote.
 */
export function applyShowDiffToYDoc(doc: Y.Doc, prev: any, next: any, origin?: any): void {
    doc.transact(() => {
        const root = getShowRoot(doc)
        const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})])

        for (const key of keys) {
            if (COLLECTION_KEYS.includes(key)) {
                const p = (prev?.[key] as any) || {}
                const n = (next?.[key] as any) || {}
                const ids = new Set([...Object.keys(p), ...Object.keys(n)])
                // only touch the collection map if something actually changed
                let m: Y.Map<any> | null = null
                for (const id of ids) {
                    const inNext = id in n
                    if (!inNext) {
                        if (!m) m = ensureCollection(root, key)
                        if (m.has(id)) m.delete(id)
                    } else if (!deepEqual(p[id], n[id])) {
                        if (!m) m = ensureCollection(root, key)
                        m.set(id, n[id])
                    }
                }
            } else {
                const inNext = key in (next || {})
                if (!inNext) {
                    if (root.has(key)) root.delete(key)
                } else if (!deepEqual(prev?.[key], next?.[key])) {
                    root.set(key, next[key])
                }
            }
        }
    }, origin)
}
