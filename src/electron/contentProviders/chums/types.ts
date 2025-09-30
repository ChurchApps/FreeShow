export type ChumsScopes = "plans"

export type ChumsAuthData = {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: ChumsScopes
} | null

export type ChumsRequestData = {
    api: "doing" | "content"
    scope: ChumsScopes
    endpoint: string
    authenticated: boolean
    params?: Record<string, string>
    method?: "POST" | "GET"
    data?: any
}

// Prod URLs
export const CHURCHAPPS_API_URL = "https://api.churchapps.org"
export const CHUMS_APP_URL = "https://app.chums.org"

// Dev URLs
/*
export const CHURCHAPPS_API_URL = "https://api.staging.churchapps.org"
export const CHUMS_APP_URL = "https://app.staging.chums.org"
*/

// export const DEFAULT_CHUMS_DATA: ChumsAuthData = {
//     access_token: "",
//     refresh_token: "",
//     token_type: "Bearer",
//     created_at: 0,
//     expires_in: 0,
//     scope: "plans",
// }

export interface ChumsSongData {
    freeShowId: string
    title: string
    artist: string
    lyrics: string
    ccliNumber: string
}
