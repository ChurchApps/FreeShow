// ----- FreeShow -----
// Authoritative per-show Yjs documents for the headless server. Each doc is
// hydrated from its .show file on first open and debounce-persisted back after
// changes (writing the same [id, Show] format the desktop uses).

import * as Y from "yjs"
import { joinPath, writeFile } from "../../../shared/data/fsCore"
import { showToYDoc, yDocToShow } from "../../../shared/crdt/showYjs"
import { getDataFolderPath } from "../data/dataPaths"
import { loadShow } from "../data/persistence"

interface DocEntry {
    doc: Y.Doc
    name: string
    saveTimer: NodeJS.Timeout | null
}

const PERSIST_DEBOUNCE = 1500
const docs = new Map<string, DocEntry>()

export function getDoc(showId: string, name = ""): Y.Doc {
    let entry = docs.get(showId)
    if (!entry) {
        const doc = new Y.Doc()
        const loaded = loadShow({ id: showId, name })
        if (loaded?.content?.[1]) showToYDoc(loaded.content[1], doc, "hydrate")
        entry = { doc, name, saveTimer: null }
        docs.set(showId, entry)
    } else if (name && entry.name !== name) {
        entry.name = name
    }
    return entry.doc
}

export function schedulePersist(showId: string) {
    const entry = docs.get(showId)
    if (!entry) return
    if (entry.saveTimer) clearTimeout(entry.saveTimer)
    entry.saveTimer = setTimeout(() => {
        entry!.saveTimer = null
        try {
            const show = yDocToShow(entry!.doc)
            if (!show || !Object.keys(show).length) return
            const fileName = String(show.name || entry!.name || showId) + ".show"
            writeFile(joinPath(getDataFolderPath("shows"), fileName), JSON.stringify([showId, show]))
        } catch (err) {
            console.error(`Failed to persist show ${showId}:`, err)
        }
    }, PERSIST_DEBOUNCE)
}
