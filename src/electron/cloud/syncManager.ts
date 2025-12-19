import { getChurchAppsSyncManager } from "./ChurchAppsSyncManager"

export type SyncProviderId = "churchApps"
const getManager = {
    churchApps: getChurchAppsSyncManager
}

export function canSync({ id }: { id: SyncProviderId } = { id: "churchApps" }): boolean {
    const provider = getManager[id]()
    if (!provider) return false

    return provider.hasValidConnection()
}

export async function getSyncTeams({ id }: { id: SyncProviderId } = { id: "churchApps" }): Promise<{ id: string; churchId: string; name: string }[]> {
    const provider = getManager[id]()
    if (!provider) return []

    return provider.getTeams()
}

export function syncData(data: { id: SyncProviderId; churchId: string; teamId: string }) {
    console.log(data)

    // WIP download any existing data, merge with local, upload merged (or new)

    return Promise.resolve({ changedFiles: [] })
}
