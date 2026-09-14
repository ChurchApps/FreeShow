// ----- FreeShow -----
// Pure per-item merge ledger for SYNCED_SETTINGS / collections.
//
// Extracts merge logic from syncManager to be unit-testable in isolation.
// All state is provided to constructor, with no module globals or I/O.

export type Changes = {
    version: string
    devices: string[]
    modified: { [key: string]: number }
    deleted: { [key: string]: string[] }
    created: { [key: string]: string[] }
    // Real last-edit time per full-file store (EVENTS/THEMES/MEDIA).
    // Used instead of file mtime to avoid false "newest wins" entries caused by sync writes.
    fileModified?: { [storeId: string]: number }
}

export type EntryAction = "create" | "download" | "upload" | "delete" | "skip"

export type LedgerInit = {
    changes: Changes // local ledger (mutated as items are marked created/deleted)
    cloudChanges?: Changes | null // ledger as it came from the cloud (read-only here)
    deviceId: string
    isNewDevice?: boolean
}

export class SyncLedger {
    changes: Changes
    cloudChanges: Changes | null
    readonly deviceId: string
    readonly isNewDevice: boolean

    // items deleted during THIS run; used so a same-run deletion isn't treated as "deleted locally"
    private deletedNow: string[] = []

    constructor(init: LedgerInit) {
        this.changes = init.changes
        this.cloudChanges = init.cloudChanges ?? null
        this.deviceId = init.deviceId
        this.isNewDevice = !!init.isNewDevice
    }

    static instanceId(storeId: string, key: string) {
        return `${storeId}_${key}`
    }

    // ----- ledger queries -----

    isDeleted(storeId: string, key: string): boolean {
        return !!this.changes.deleted?.[SyncLedger.instanceId(storeId, key)]
    }

    isCreated(storeId: string, key: string): boolean {
        return !!this.changes.created?.[SyncLedger.instanceId(storeId, key)]
    }

    // was the item already deleted by THIS device (per the cloud ledger), and not re-deleted this run
    isDeletedLocally(storeId: string, key: string): boolean {
        const instanceId = SyncLedger.instanceId(storeId, key)
        if (this.deletedNow.includes(instanceId)) return false
        return !!this.cloudChanges?.deleted?.[instanceId]?.includes(this.deviceId)
    }

    isCreatedLocally(storeId: string, key: string): boolean {
        const instanceId = SyncLedger.instanceId(storeId, key)
        return !!this.cloudChanges?.created?.[instanceId]?.includes(this.deviceId)
    }

    // ----- ledger mutations -----

    markAsDeleted(storeId: string, key: string) {
        const instanceId = SyncLedger.instanceId(storeId, key)
        this.unmarkAsCreated(storeId, key)
        this.markAs("deleted", instanceId)
        this.deletedNow.push(instanceId)
    }

    markAsCreated(storeId: string, key: string) {
        const instanceId = SyncLedger.instanceId(storeId, key)
        this.unmarkAsDeleted(storeId, key)
        this.markAs("created", instanceId)
    }

    private markAs(type: "deleted" | "created", instanceId: string) {
        // with a single device there's nothing to reconcile, so don't track
        if (this.changes.devices.length < 2) return

        if (!this.changes[type]) this.changes[type] = {}
        if (!this.changes[type][instanceId]) this.changes[type][instanceId] = []

        if (this.changes[type][instanceId].includes(this.deviceId)) return
        this.changes[type][instanceId].push(this.deviceId)

        // once every device has acknowledged the change, drop the entry
        if (this.changes[type][instanceId].length >= this.changes.devices.length) {
            delete this.changes[type][instanceId]
        }
    }

    private unmarkAsDeleted(storeId: string, key: string) {
        if (!this.changes.deleted) return
        delete this.changes.deleted[SyncLedger.instanceId(storeId, key)]
    }

    private unmarkAsCreated(storeId: string, key: string) {
        if (!this.changes.created) return
        delete this.changes.created[SyncLedger.instanceId(storeId, key)]
    }

    // ----- merge decisions (item-collections with no per-item "modified") -----

    // Resolves cloud entry status (create/skip/delete/download/upload) based on local existence.
    // Newest copy wins for items with "modified" fields; collections default to upload.
    resolveCloudEntry(storeId: string, key: string, localExists: boolean, cloudIsNewer = false): { action: EntryAction } {
        // exists only in cloud
        if (!localExists) {
            if (this.isNewDevice) return { action: "create" }

            if (this.isCreated(storeId, key) && this.isCreatedLocally(storeId, key)) {
                // previously created here but now missing → it was deleted locally
                this.markAsDeleted(storeId, key)
                return { action: "skip" }
            }
            if (this.isCreated(storeId, key)) {
                this.markAsCreated(storeId, key)
                return { action: "create" }
            }
            if (this.isDeleted(storeId, key)) {
                this.markAsDeleted(storeId, key)
                return { action: "skip" }
            }
            // absence with no ledger mark → treat as deleted locally
            this.markAsDeleted(storeId, key)
            return { action: "skip" }
        }

        // exists locally and in cloud, but is marked deleted → propagate the deletion
        if (this.isDeleted(storeId, key) && !this.isNewDevice) {
            this.markAsDeleted(storeId, key)
            return { action: "delete" }
        }
        if (this.isCreated(storeId, key)) this.markAsCreated(storeId, key)

        // exists on both sides and not deleted → newest wins (collections pass cloudIsNewer=false → keep local)
        return { action: cloudIsNewer ? "download" : "upload" }
    }

    // Item present only locally (not in cloud snapshot). Resolves actions based on deletion history.
    resolveLocalEntry(storeId: string, key: string): { action: EntryAction } {
        if (this.isNewDevice) {
            this.markAsCreated(storeId, key)
            return { action: "upload" }
        }

        if (this.isDeleted(storeId, key)) {
            // this device had deleted it then restored it → revive
            if (this.isDeletedLocally(storeId, key)) {
                this.markAsCreated(storeId, key)
                return { action: "upload" }
            }
            // someone else deleted it → propagate the deletion locally
            this.markAsDeleted(storeId, key)
            return { action: "delete" }
        }

        // brand-new local item → mark created so other devices download it
        this.markAsCreated(storeId, key)
        return { action: "upload" }
    }

    // Merges one item-collection (e.g. scriptures) per-item. Used to avoid whole-object overwrites.
    mergeCollection(storeId: string, type: string, cloudObj: Record<string, any>, localObj: Record<string, any>): Record<string, any> {
        const merged: Record<string, any> = { ...localObj }

        // items present in the cloud
        for (const [key, value] of Object.entries(cloudObj || {})) {
            const itemKey = `${type}/${key}`
            const action = this.resolveCloudEntry(storeId, itemKey, key in merged).action
            if (action === "delete") delete merged[key]
            else if (action === "create" || action === "download") merged[key] = value
        }

        // items present only locally
        for (const key of Object.keys(localObj || {})) {
            if (key in (cloudObj || {})) continue
            const itemKey = `${type}/${key}`
            const action = this.resolveLocalEntry(storeId, itemKey).action
            if (action === "delete") delete merged[key]
        }

        return merged
    }
}
