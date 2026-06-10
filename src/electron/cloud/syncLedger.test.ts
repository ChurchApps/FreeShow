import { describe, it, expect } from "vitest"
import { SyncLedger, type Changes } from "./syncLedger"

const ID = "SYNCED_SETTINGS"
const KEY = "scriptures/x"
const INST = "SYNCED_SETTINGS_scriptures/x"

function makeChanges(devices: string[], overrides: Partial<Changes> = {}): Changes {
    return { version: "0.1.1", devices, modified: {}, deleted: {}, created: {}, ...overrides }
}

describe("SyncLedger — per-item merge (#3335)", () => {
    describe("union (items unique to a device survive)", () => {
        it("a brand-new local item is uploaded and marked created", () => {
            const changes = makeChanges(["A", "B"])
            const a = new SyncLedger({ changes, deviceId: "A" })

            expect(a.resolveLocalEntry(ID, KEY).action).toBe("upload")
            expect(changes.created[INST]).toContain("A")
        })

        it("an item created by another device (cloud-only here) is downloaded, not dropped", () => {
            // local ledger already merged the cloud's "created by A"
            const changes = makeChanges(["A", "B"], { created: { [INST]: ["A"] } })
            const b = new SyncLedger({ changes, deviceId: "B" })

            expect(b.resolveCloudEntry(ID, KEY, /* localExists */ false).action).toBe("create")
        })

        it("two devices adding different items both keep theirs (no whole-file overwrite)", () => {
            const changes = makeChanges(["A", "B"])
            const a = new SyncLedger({ changes, deviceId: "A" })
            // A has item X (local only) and item Y (created by B, in cloud only)
            changes.created["SYNCED_SETTINGS_categories/y"] = ["B"]

            expect(a.resolveLocalEntry(ID, "categories/x").action).toBe("upload") // A's own survives
            expect(a.resolveCloudEntry(ID, "categories/y", false).action).toBe("create") // B's downloaded
        })
    })

    describe("deletion propagates (the maintainer's concern: a deleted item must not come back)", () => {
        it("an item marked deleted that still exists locally is deleted (propagated)", () => {
            const changes = makeChanges(["A", "B"], { deleted: { [INST]: ["A"] } })
            const b = new SyncLedger({ changes, deviceId: "B" })

            expect(b.resolveCloudEntry(ID, KEY, /* localExists */ true).action).toBe("delete")
        })

        it("an item marked deleted and missing locally is skipped (stays deleted, no resurrection)", () => {
            const changes = makeChanges(["A", "B"], { deleted: { [INST]: ["A"] } })
            const b = new SyncLedger({ changes, deviceId: "B" })

            expect(b.resolveCloudEntry(ID, KEY, /* localExists */ false).action).toBe("skip")
        })

        it("an item that exists on both sides and is not deleted is kept (upload) for the caller to tie-break by date", () => {
            const changes = makeChanges(["A", "B"])
            const b = new SyncLedger({ changes, deviceId: "B" })

            expect(b.resolveCloudEntry(ID, KEY, /* localExists */ true).action).toBe("upload")
        })
    })

    describe("tombstone vs re-create (the edge case we found with the re-imported bible)", () => {
        it("re-importing a tombstoned item, by a device that did NOT delete it, drops it (current behavior)", () => {
            // X was deleted by A; cloud ledger reflects that. B re-imports X locally.
            const changes = makeChanges(["A", "B"], { deleted: { [INST]: ["A"] } })
            const cloudChanges = makeChanges(["A", "B"], { deleted: { [INST]: ["A"] } })
            const b = new SyncLedger({ changes, cloudChanges, deviceId: "B" })

            expect(b.isDeletedLocally(ID, KEY)).toBe(false) // B never deleted it
            expect(b.resolveLocalEntry(ID, KEY).action).toBe("delete") // → dropped (the "phantom bible")
        })

        it("restoring an item the device itself deleted revives it", () => {
            // B deleted X (cloud ledger has B), then restores it locally
            const changes = makeChanges(["A", "B"], { deleted: { [INST]: ["B"] } })
            const cloudChanges = makeChanges(["A", "B"], { deleted: { [INST]: ["B"] } })
            const b = new SyncLedger({ changes, cloudChanges, deviceId: "B" })

            expect(b.isDeletedLocally(ID, KEY)).toBe(true)
            expect(b.resolveLocalEntry(ID, KEY).action).toBe("upload") // revived
            expect(changes.created[INST]).toContain("B")
        })
    })

    describe("ledger mechanics", () => {
        it("does not track changes with a single device", () => {
            const changes = makeChanges(["A"])
            const a = new SyncLedger({ changes, deviceId: "A" })
            a.markAsCreated(ID, KEY)
            expect(changes.created[INST]).toBeUndefined()
        })

        it("marking created clears a prior deleted mark (and vice versa)", () => {
            const changes = makeChanges(["A", "B"], { deleted: { [INST]: ["A"] } })
            const a = new SyncLedger({ changes, deviceId: "A" })
            a.markAsCreated(ID, KEY)
            expect(changes.deleted[INST]).toBeUndefined()
            expect(changes.created[INST]).toContain("A")
        })

        it("drops the entry once every device has acknowledged the change", () => {
            // A already marked deleted; when B (the last device) also marks it, the entry is removed
            const changes = makeChanges(["A", "B"], { deleted: { [INST]: ["A"] } })
            const b = new SyncLedger({ changes, deviceId: "B" })
            b.markAsDeleted(ID, KEY)
            expect(changes.deleted[INST]).toBeUndefined()
        })
    })

    describe("new device adopts everything (no deletions)", () => {
        it("creates cloud items and never deletes when isNewDevice", () => {
            const changes = makeChanges(["A", "B"], { deleted: { [INST]: ["A"] } })
            const fresh = new SyncLedger({ changes, deviceId: "C", isNewDevice: true })
            // even a tombstoned item present in the cloud is created, not skipped/deleted
            expect(fresh.resolveCloudEntry(ID, KEY, false).action).toBe("create")
        })
    })

    // The regression for #3335 itself: the SAME input that the old whole-file overwrite lost,
    // is now preserved by the per-item merge.
    describe("regression: the #3335 bug (whole-file overwrite dropped a device's items)", () => {
        // cloud (device A) is "rich": has an English bible 'eng' that device B never had.
        const cloud: Record<string, { name: string }> = { rv: { name: "Reina-Valera 1960" }, ntv: { name: "NTV" }, eng: { name: "King James" } }
        // device B is "poor" but added its own item 'zz'.
        const local: Record<string, { name: string }> = { rv: { name: "Reina-Valera 1960" }, ntv: { name: "NTV" }, zz: { name: "B's new bible" } }

        it("OLD behavior (whole-object overwrite, newest file wins) LOSES the other device's item", () => {
            // B's file is the most recent → it replaced the whole collection in the cloud
            const oldResult = { ...local }
            expect(oldResult.eng).toBeUndefined() // ← King James (A's) is gone: the bug
            expect(Object.keys(oldResult).sort()).toEqual(["ntv", "rv", "zz"])
        })

        it("NEW behavior (per-item ledger merge) keeps BOTH devices' items — bug fixed", () => {
            // in real use the ledger records who created what: A created 'eng', B created 'zz'
            const changes = makeChanges(["A", "B"], {
                created: {
                    "SYNCED_SETTINGS_scriptures/eng": ["A"],
                    "SYNCED_SETTINGS_scriptures/zz": ["B"]
                }
            })
            const ledger = new SyncLedger({ changes, deviceId: "B" })
            const merged = ledger.mergeCollection(ID, "scriptures", cloud, local)

            expect(merged.eng).toBeDefined() // A's King James survives
            expect(merged.zz).toBeDefined() // B's new bible survives
            expect(Object.keys(merged).sort()).toEqual(["eng", "ntv", "rv", "zz"]) // full union, no loss
        })

        it("NEW behavior still propagates a real deletion (doesn't blindly union)", () => {
            // 'eng' was actually deleted (marked in the ledger), B still has it locally
            const changes = makeChanges(["A", "B"], { deleted: { "SYNCED_SETTINGS_scriptures/eng": ["A"] } })
            const localWithEng = { rv: { name: "RV" }, eng: { name: "King James" } }
            const cloudWithoutEng = { rv: { name: "RV" } }
            const ledger = new SyncLedger({ changes, deviceId: "B" })
            const merged = ledger.mergeCollection(ID, "scriptures", cloudWithoutEng, localWithEng)

            expect(merged.eng).toBeUndefined() // deletion propagated, not resurrected
        })
    })
})
