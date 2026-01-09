export type ChurchAppsScopes = "plans"

export type ChurchAppsAuthData = {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: ChurchAppsScopes
} | null

export type ChurchAppsRequestData = {
    api: "doing" | "content" | "membership" | "lessons"
    scope: ChurchAppsScopes
    endpoint: string
    authenticated: boolean
    params?: Record<string, string>
    method?: "POST" | "GET"
    data?: any
}

// Prod URLs
export const CHURCHAPPS_API_URL = "https://api.churchapps.org"
export const CHURCHAPPS_APP_URL = "https://admin.b1.church"
export const LESSONS_API_URL = "https://api.lessons.church"

// export const DEFAULT_CHURCHAPPS_DATA: ChurchAppsAuthData = {
//     access_token: "",
//     refresh_token: "",
//     token_type: "Bearer",
//     created_at: 0,
//     expires_in: 0,
//     scope: "plans",
// }

export interface ChurchAppsSongData {
    freeShowId: string
    title: string
    artist: string
    lyrics: string
    ccliNumber: string
}

// Venue feed types
export interface FeedFile { name?: string; url?: string; streamUrl?: string; seconds?: number; fileType?: string; loopVideo?: boolean }
export interface FeedAction { id?: string; actionType?: string; content?: string; files?: FeedFile[] }
export interface FeedSection { id?: string; name?: string; actions?: FeedAction[] }
export interface FeedAddOn { id?: string; name?: string; files?: FeedFile[] }
export interface VenueFeed { sections?: FeedSection[]; files?: FeedAddOn[] }
