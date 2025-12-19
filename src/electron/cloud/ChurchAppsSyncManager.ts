import { type ChurchAppsProvider, ContentProviderRegistry } from "../contentProviders"
import { httpsRequest } from "../utils/requests"

class ChurchAppsSyncManager {
    provider: ChurchAppsProvider

    constructor(provider: ChurchAppsProvider) {
        this.provider = provider
    }

    hasValidConnection() {
        return this.provider.isConnected("plans")
    }

    async getTeams(): Promise<{ id: string; churchId: string; name: string }[]> {
        const response = await this.provider.apiRequest({ api: "membership", authenticated: true, scope: "plans", endpoint: "/groups/tag/team" })
        return response || []
    }

    async getData(churchId: string, teamId: string): Promise<any> {
        const randomNumber = Math.floor(Math.random() * 1000000)
        const hostname = "https://content.churchapps.org"
        const path = `/${churchId}/files/group/${teamId}/current.zip?cacheBuster=${randomNumber}`
        console.log(path)

        return new Promise((resolve) => {
            httpsRequest(hostname, path, "GET", {}, {}, (err, data) => {
                if (err) {
                    console.error("Failed to fetch ChurchApps content library:", err)
                    return resolve(null)
                }

                console.log("Downloaded data:", data)
                return resolve(data)
            })
        })
    }
}

let syncManager: ChurchAppsSyncManager | null = null
export function getChurchAppsSyncManager() {
    if (syncManager) return syncManager

    const provider = ContentProviderRegistry.getProvider<ChurchAppsProvider>("churchApps")
    if (!provider) return null

    syncManager = new ChurchAppsSyncManager(provider)
    return syncManager
}
