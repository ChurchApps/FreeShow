// ----- FreeShow -----
// Client-side real-time co-editing bridge (web/remote only).
//
// Strategy (least-invasive): the Svelte `showsCache` store stays the source of
// truth for edits; this bridge diffs it into a per-show Yjs doc and relays doc
// updates to the server. Incoming remote updates are applied to the doc and
// written back into `showsCache` (guarded so they don't echo). None of the ~76
// existing edit sites change — they keep calling showsCache.update().
//
// IMPORTANT: the client does NOT hydrate its doc from local content up front.
// The server is authoritative: on open we take the server's state, and only seed
// from local content if the server has none (a brand-new show). Hydrating locally
// would create a competing Y.Map the server never sees, and Yjs's per-key
// last-writer-wins (keyed on random client-ids) would then non-deterministically
// drop remote edits.
//
// Merge granularity (currently per-slide; same-slide/text edits are last-writer-wins)
// is defined entirely in src/shared/crdt/showYjs.ts — see the FUTURE REFINEMENT note
// there for how to add character/text-level co-editing.

import { get } from "svelte/store"
import * as Y from "yjs"
import { applyShowDiffToYDoc, yDocToShow } from "../../../shared/crdt/showYjs"
import { YJS } from "../../../types/Channels"
import { activeShow, showsCache } from "../../stores"

const REMOTE = "remote"
const LOCAL = "local"

interface DocEntry {
    doc: Y.Doc
    prev: any // last-known show snapshot, for diffing local edits
    applyingRemote: boolean
    synced: boolean
}

const entries = new Map<string, DocEntry>()
let initialized = false
let currentShowId = ""

const clone = (o: any) => JSON.parse(JSON.stringify(o))
const hasContent = (show: any) => !!show && Object.keys(show).length > 0

export function initCrdtClient() {
    if (initialized || !window.api) return
    initialized = true

    window.api.receive(YJS, (msg: any) => {
        if (!msg?.showId || !msg.update) return
        const entry = entries.get(msg.showId)
        if (!entry) return

        entry.applyingRemote = true
        Y.applyUpdate(entry.doc, new Uint8Array(msg.update), REMOTE)
        entry.applyingRemote = false

        if (msg.action === "sync" && !entry.synced) {
            entry.synced = true
            onFirstSync(msg.showId, entry)
        } else {
            writeShowFromDoc(msg.showId, entry)
        }
    })

    // open a doc for whichever show becomes active
    activeShow.subscribe((a) => {
        const id = a?.id || ""
        if (id === currentShowId) return
        currentShowId = id
        if (id) openShowDoc(id)
    })

    // push local edits (from any edit site) into the active show's doc
    showsCache.subscribe((cache) => {
        const id = currentShowId
        if (!id) return
        const entry = entries.get(id)
        if (!entry || entry.applyingRemote || !entry.synced) return
        const next = cache[id]
        if (!next) return

        applyShowDiffToYDoc(entry.doc, entry.prev, next, LOCAL)
        entry.prev = clone(next)
    })
}

function openShowDoc(showId: string) {
    const existing = entries.get(showId)
    if (existing) {
        // re-open (e.g. reconnect): ask server for state again
        requestOpen(showId)
        return
    }

    const doc = new Y.Doc()
    const entry: DocEntry = { doc, prev: {}, applyingRemote: false, synced: false }
    entries.set(showId, entry)

    // relay local edits to the server (remote-origin updates are not relayed back)
    doc.on("update", (update: Uint8Array, origin: any) => {
        if (origin === REMOTE) return
        window.api.send(YJS, { action: "update", showId, update })
    })

    requestOpen(showId)
}

function requestOpen(showId: string) {
    const name = get(showsCache)[showId]?.name || ""
    window.api.send(YJS, { action: "open", showId, name })
}

// first sync response from the server: adopt server state, or seed it if empty
function onFirstSync(showId: string, entry: DocEntry) {
    const serverShow = yDocToShow(entry.doc)

    if (hasContent(serverShow)) {
        // server is authoritative — reflect its state into showsCache
        writeShowFromDoc(showId, entry)
        return
    }

    // server had nothing (brand-new show): seed it from our local copy
    const local = get(showsCache)[showId]
    if (hasContent(local)) {
        applyShowDiffToYDoc(entry.doc, {}, local, LOCAL) // relayed to server via doc.on("update")
        entry.prev = clone(local)
    }
}

// reflect the doc's current content into showsCache (without echoing back as a local edit)
function writeShowFromDoc(showId: string, entry: DocEntry) {
    const show = yDocToShow(entry.doc)
    if (!hasContent(show)) return

    entry.applyingRemote = true
    showsCache.update((c) => ({ ...c, [showId]: { ...c[showId], ...show } }))
    entry.prev = clone(show)
    entry.applyingRemote = false
}
