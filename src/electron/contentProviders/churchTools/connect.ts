/**
 * WARNING: This file should ONLY be accessed through ChurchToolsProvider.
 * Do not import or use functions from this file directly in other parts of the application.
 * Use ContentProviderRegistry or ChurchToolsProvider instead.
 */

import { ToMain } from "../../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { httpsRequest } from "../../utils/requests"
import type { CTAuthData, CTScopes } from "./types"

export const CT_SCOPE: CTScopes = "services"

// In-memory cache for the current session
let CT_ACCESS: CTAuthData = null

function normalizeDomain(url: string): string {
    return url.trim().replace(/^https?:\/\//, "").replace(/\/api\/?$/, "").replace(/\/$/, "")
}

function whoami(domain: string, token: string): Promise<any> {
    return new Promise((resolve) => {
        const headers = { Authorization: `Login ${token}`, Accept: "application/json" }
        httpsRequest(domain, "/api/whoami", "GET", headers, {}, (err, result) => resolve(err ? null : result))
    })
}

export function ctInitialize(): void {
    CT_ACCESS = null
}

export function ctGetAccess(): CTAuthData {
    return CT_ACCESS ?? (getContentProviderAccess("churchtools", CT_SCOPE) as CTAuthData)
}

export async function ctConnect(data?: { url?: string; token?: string; sngFolder?: string; sngTranslationMethod?: string; weeksAhead?: number }): Promise<CTAuthData> {
    if (data?.url && data?.token) {
        const domain = normalizeDomain(data.url)
        const token = data.token.trim()

        const result = await whoami(domain, token)
        if (!result?.data?.id) {
            sendToMain(ToMain.ALERT, "Could not connect to ChurchTools — check your URL and API token.")
            return null
        }

        const authData: NonNullable<CTAuthData> = {
            access_token: token,
            refresh_token: "",
            token_type: "Bearer",
            created_at: Math.floor(Date.now() / 1000),
            expires_in: 3_153_600_000, // ~100 years; CT login tokens don't expire
            scope: CT_SCOPE,
            domain,
            sngFolder: data.sngFolder?.trim() || undefined,
            sngTranslationMethod: (data.sngTranslationMethod as "multiline" | "textboxes") ?? "textboxes",
            weeksAhead: data.weeksAhead ?? undefined
        }

        setContentProviderAccess("churchtools", CT_SCOPE, authData)
        CT_ACCESS = authData
        sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "churchtools", success: true, isFirstConnection: true })
        return authData
    }

    // Use stored credentials, updating sngFolder if it changed
    const stored = getContentProviderAccess("churchtools", CT_SCOPE) as CTAuthData
    if (stored?.access_token && stored?.domain) {
        const newSngFolder = data?.sngFolder?.trim() || undefined
        if (newSngFolder !== undefined && newSngFolder !== stored.sngFolder) {
            const updated = { ...stored, sngFolder: newSngFolder || undefined }
            setContentProviderAccess("churchtools", CT_SCOPE, updated)
            CT_ACCESS = updated
            return updated
        }
        if (data?.sngTranslationMethod !== undefined && data.sngTranslationMethod !== stored.sngTranslationMethod) {
            const updated = { ...stored, sngTranslationMethod: data.sngTranslationMethod as "multiline" | "textboxes" }
            setContentProviderAccess("churchtools", CT_SCOPE, updated)
            CT_ACCESS = updated
            return updated
        }
        if (data?.weeksAhead !== undefined && data.weeksAhead !== stored.weeksAhead) {
            const updated = { ...stored, weeksAhead: data.weeksAhead }
            setContentProviderAccess("churchtools", CT_SCOPE, updated)
            CT_ACCESS = updated
            return updated
        }
        CT_ACCESS = stored
        return stored
    }

    return null
}

export function ctDisconnect(): void {
    setContentProviderAccess("churchtools", CT_SCOPE, null)
    CT_ACCESS = null
}

export async function ctStartupLoad(loadFn: () => Promise<void>): Promise<void> {
    const stored = getContentProviderAccess("churchtools", CT_SCOPE) as CTAuthData
    if (!stored?.access_token || !stored?.domain) return

    CT_ACCESS = stored
    sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "churchtools", success: true, isFirstConnection: false })
    await loadFn()
}
