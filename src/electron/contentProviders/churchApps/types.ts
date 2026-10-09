import { config } from "../../data/store"

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
    api: "doing" | "content" | "membership" | "lessons" | "messaging"
    scope: ChurchAppsScopes
    endpoint: string
    authenticated: boolean
    params?: Record<string, string>
    method?: "POST" | "GET"
    data?: any
}

// ChurchApps API URLs
export const CHURCHAPPS_API_URL = "https://api.churchapps.org"
export const CHURCHAPPS_APP_URL = "https://admin.b1.church"
export const CHURCHAPPS_CONTENT_URL = "https://content.churchapps.org"
export const LESSONS_API_URL = "https://api.lessons.church"

export function getChurchAppsApiUrl(): string {
    return (config.get("churchAppsApiUrl") as string)?.trim() || CHURCHAPPS_API_URL
}
export function getChurchAppsAppUrl(): string {
    return (config.get("churchAppsAppUrl") as string)?.trim() || CHURCHAPPS_APP_URL
}
export function getChurchAppsContentUrl(): string {
    return (config.get("churchAppsContentUrl") as string)?.trim() || CHURCHAPPS_CONTENT_URL
}
export function getLessonsApiUrl(): string {
    return (config.get("churchAppsLessonsUrl") as string)?.trim() || LESSONS_API_URL
}

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
export interface FeedFile {
    name?: string
    url?: string
    streamUrl?: string
    seconds?: number
    fileType?: string
    loopVideo?: boolean
}
export interface FeedAction {
    id?: string
    actionType?: string
    content?: string
    files?: FeedFile[]
}
export interface FeedSection {
    id?: string
    name?: string
    actions?: FeedAction[]
}
export interface FeedAddOn {
    id?: string
    name?: string
    files?: FeedFile[]
}
export interface VenueFeed {
    sections?: FeedSection[]
    files?: FeedAddOn[]
}
